/**
 * diodesign.org — On-Device AI Search
 * Architecture: Local RAG via Orama + Chrome Prompt API (window.LanguageModel / window.ai.languageModel)
 *
 * Design principles:
 *  - One stateless session per query to avoid context accumulation and C++ inference crashes.
 *  - Token budget enforced programmatically via countPromptTokens + inputQuota before inference.
 *  - Orama BM25 handles semantic chunk retrieval; ranked keyword search is the fallback.
 *  - Streaming output for real-time feel; non-streaming fallback if the stream API is absent.
 */

(async function () {
    // -------------------------------------------------------------------------
    // DOM references
    // -------------------------------------------------------------------------
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const splashWrapper = document.getElementById('splash-canvas-wrapper');
    const splashText = document.getElementById('splash-text');
    const statusOverlay = document.getElementById('search-status-overlay');
    const searchReset = document.getElementById('search-reset');
    const searchBox = document.querySelector('.search-box');

    // -------------------------------------------------------------------------
    // Prompt API detection
    // Supports: Chrome 128+ (window.LanguageModel), older trial builds (window.ai.languageModel)
    // -------------------------------------------------------------------------
    const LanguageModel = window.LanguageModel || window.ai?.languageModel;
    if (!LanguageModel) {
        console.log('AI Search: Prompt API not available in this browser.');
        return;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    let oramaDb = null;   // Orama database instance
    let oramaAPI = null;   // Orama module exports
    let allChunks = [];     // Raw flat array of all index chunks (keyword fallback)
    let isReady = false;  // True once the model and index are both ready
    let cachedInputQuota = 6144;  // Gemini Nano context window fallback (tokens); updated at startup if the API exposes it

    // -------------------------------------------------------------------------
    // UI helpers
    // -------------------------------------------------------------------------

    /** Show a loading overlay message inside the search box. */
    const setStatus = (msg) => {
        statusOverlay.style.display = 'flex';
        statusOverlay.style.cursor = 'wait';
        statusOverlay.innerHTML = `<span><div class="search-spinner"></div>${msg}</span>`;
    };

    /** Hide the overlay and re-enable the input field. */
    const clearStatus = () => {
        statusOverlay.style.display = 'none';
        searchInput.disabled = false;
        searchInput.placeholder = 'Ask the lab anything…';
        searchInput.focus();
    };

    /** Silently remove the search UI — called when the model is unavailable. */
    const hideSearch = (reason, err) => {
        console.warn(`AI Search: ${reason}`, err ?? '');
        searchContainer.style.display = 'none';
    };

    // -------------------------------------------------------------------------
    // Session options — expectedOutputLanguage is required by Chrome to select the
    // correct output safety classifier; omitting it causes a warning and may reduce
    // model stability.
    // -------------------------------------------------------------------------
    const SESSION_OPTIONS = { expectedOutputLanguage: 'en' };

    // -------------------------------------------------------------------------
    // System prompt — kept intentionally terse to preserve context for content.
    // -------------------------------------------------------------------------
    const SYSTEM_PROMPT =
        'You are the diodesign lab AI assistant. Answer the user\'s query using only the ' +
        'provided archive excerpts. Cite sources by name, e.g. "According to the [Title] log…". ' +
        'Be concise and technical. If the archives do not contain the answer, say so clearly.';

    /** Returns true if the error is Chrome's crash-loop circuit-breaker. */
    const isCrashLoopError = (e) =>
        e instanceof DOMException &&
        e.name === 'NotSupportedError' &&
        e.message?.toLowerCase().includes('crashed');

    // -------------------------------------------------------------------------
    // Search index initialisation (Orama BM25)
    // Pin to the jsDelivr /+esm endpoint — it resolves the correct ESM entry point
    // for the latest Orama release, avoiding the need to track specific version paths
    // (which differ across major versions and caused 404s when pinned manually).
    const ORAMA_CDN = 'https://cdn.jsdelivr.net/npm/@orama/orama/+esm';

    async function initSearchIndex() {
        oramaAPI = await import(ORAMA_CDN);

        const resp = await fetch('/search-index.json');
        if (!resp.ok) throw new Error(`Index fetch failed: ${resp.status}`);
        allChunks = await resp.json();

        oramaDb = await oramaAPI.create({
            schema: {
                title: 'string',
                content: 'string',
                url: 'string',
                chunk: 'number',
            }
        });

        // insertMultiple is far faster than sequential insert() calls — it batches
        // tokenisation and index construction in one pass.
        await oramaAPI.insertMultiple(oramaDb, allChunks);
        console.log(`AI Search: Orama indexed ${allChunks.length} chunks.`);
    }

    // -------------------------------------------------------------------------
    // RAG retrieval
    // Returns up to `limit` hit objects, each with a `.document` field.
    // Falls back to a ranked keyword scan when Orama returns zero hits.
    // -------------------------------------------------------------------------
    async function retrieveChunks(query, limit = 8) {
        // Primary: Orama BM25 with title boost
        const result = await oramaAPI.search(oramaDb, {
            term: query,
            limit,
            boost: { title: 2 },
            operator: 'or',
        });

        if (result.hits?.length) return result.hits;

        // Fallback: ranked keyword overlap
        const keywords = query
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(k => k.length > 2);

        if (!keywords.length) return [];

        return allChunks
            .map(chunk => {
                const haystack = (chunk.title + ' ' + chunk.content).toLowerCase();
                const score = keywords.reduce((s, kw) => s + (haystack.includes(kw) ? 1 : 0), 0);
                return { document: chunk, score };
            })
            .filter(c => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    // -------------------------------------------------------------------------
    // Prompt assembly
    // -------------------------------------------------------------------------
    function buildPrompt(hits, query) {
        if (!hits.length) return `QUERY: ${query}\n\nRESPONSE:`;
        const archives = hits
            .map(h => {
                const doc = h.document || h;
                return `[${doc.title}]\n${doc.content}`;
            })
            .join('\n\n---\n\n');
        return `LAB ARCHIVES:\n\n${archives}\n\n---\n\nQUERY: ${query}\n\nRESPONSE:`;
    }

    // -------------------------------------------------------------------------
    // Token-budget enforcement
    //
    // Strategy:
    //  1. Create a throwaway session just to read its inputQuota (the API's hard
    //     context-window size in tokens).
    //  2. Reserve headroom for the system prompt + expected response.
    //  3. Use countPromptTokens to measure the assembled user prompt.
    //  4. Iteratively drop the least-relevant chunk until it fits.
    //
    // We do NOT reuse sessions across queries — each query gets a fresh session
    // to prevent accumulated context from causing inference crashes.
    // -------------------------------------------------------------------------
    async function fitPromptToWindow(hits, query) {
        // Use the quota captured at startup — avoids creating an extra session
        // per query, which was the biggest remaining source of crash pressure.
        const budget = Math.floor(cachedInputQuota * 0.85);
        let currentHits = [...hits];

        // Fast path: estimate token count from character length (~4 chars/token).
        // If the full prompt is comfortably under budget, skip the expensive
        // countPromptTokens API round-trip entirely.
        const initialPrompt = buildPrompt(currentHits, query);
        const CHARS_PER_TOKEN = 4;
        if (initialPrompt.length <= budget * CHARS_PER_TOKEN * 0.7) {
            return currentHits;
        }

        // Prompt may be too large — use the API for a precise count.
        while (currentHits.length > 0) {
            const prompt = buildPrompt(currentHits, query);
            let tokens = 0;

            try {
                // Prefer the static countPromptTokens if available (no session needed).
                const counted = typeof LanguageModel.countPromptTokens === 'function'
                    ? await LanguageModel.countPromptTokens(prompt)
                    : null;
                tokens = typeof counted === 'number' ? counted : (counted?.tokens ?? 0);
            } catch {
                // Counter threw — treat as oversized and drop a chunk.
                tokens = budget + 1;
            }

            if (tokens <= budget) break;
            currentHits.pop();
        }

        return currentHits;
    }

    // -------------------------------------------------------------------------
    // Markdown rendering (uses marked.js if loaded, plain paragraph split otherwise)
    // -------------------------------------------------------------------------
    function renderMarkdown(text, container) {
        if (window.marked) {
            container.innerHTML = window.marked.parse(text);
        } else {
            container.innerHTML = text
                .split(/\n\n+/)
                .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                .join('');
        }
    }

    // -------------------------------------------------------------------------
    // Streaming inference
    // Returns true on success, false if streaming is unavailable (triggers fallback).
    // -------------------------------------------------------------------------
    async function runStreamingInference(session, prompt) {
        const streamFn = session.promptStreaming ??
            session.executeStream ??
            session.promptStream;

        if (typeof streamFn !== 'function') return false;

        const stream = streamFn.call(session, prompt);
        searchResults.innerHTML = '';
        let accumulated = '';
        let renderPending = false;

        for await (const chunk of stream) {
            // Some builds emit delta strings, others emit cumulative strings.
            const next = typeof chunk === 'string' ? chunk : (chunk.response ?? chunk.text ?? '');
            accumulated = next.startsWith(accumulated) ? next : accumulated + next;

            // Throttle re-renders to one per animation frame. marked.parse() is
            // O(n) in text length — calling it on every chunk would re-parse the
            // entire accumulated string potentially hundreds of times per response.
            if (!renderPending) {
                renderPending = true;
                requestAnimationFrame(() => {
                    renderMarkdown(accumulated, searchResults);
                    renderPending = false;
                });
            }
        }

        // Final render to ensure the last chunk is always displayed.
        renderMarkdown(accumulated, searchResults);

        return true;
    }

    // -------------------------------------------------------------------------
    // Non-streaming inference (fallback)
    // -------------------------------------------------------------------------
    async function runBlockingInference(session, prompt) {
        const promptFn = session.prompt ?? session.execute;
        if (typeof promptFn !== 'function') throw new Error('No prompt method on session.');

        const response = await promptFn.call(session, prompt);
        const text = typeof response === 'string' ? response : (response.response ?? response.text ?? '');
        renderMarkdown(text, searchResults);
    }

    // -------------------------------------------------------------------------
    // Graceful degradation: render Orama hits as plain links if AI fails.
    // -------------------------------------------------------------------------
    function renderFallbackResults(hits, note) {
        let html = `<p class="status" style="font-style:italic;color:var(--highlight-color);">${note}</p>`;
        for (const hit of hits) {
            const doc = hit.document ?? hit;
            html += `<div style="margin-bottom:1em;">
                <strong><a href="${doc.url}">${doc.title}</a></strong><br>
                <small>${doc.content.slice(0, 180)}…</small>
            </div>`;
        }
        searchResults.innerHTML = html;
    }

    // -------------------------------------------------------------------------
    // Query handler — the main pipeline
    // -------------------------------------------------------------------------
    async function submitQuery(query) {
        query = query.trim();
        if (!query || !isReady) return;

        searchInput.disabled = true;
        [splashWrapper, splashText].forEach(el => el?.classList.add('collapsed'));

        searchResults.style.display = 'block';
        searchResults.innerHTML = '<p class="status"><div class="search-spinner"></div><em>Consulting neural core…</em></p>';
        searchBox.classList.remove('complete');
        searchReset.classList.remove('visible');

        let inferenceSession = null;

        try {
            if (!oramaDb) throw new Error('Search index not ready.');

            // 1. Retrieve relevant chunks via Orama BM25.
            let hits = await retrieveChunks(query);

            if (!hits.length) {
                searchResults.innerHTML = '<p class="status">No relevant archives found for that query.</p>';
                finalizeUI(false);
                return;
            }

            // 2 & 3. Run token budgeting and session creation in parallel —
            // LanguageModel.create() is the most expensive step (~5-15s on laptop);
            // running it alongside fitPromptToWindow hides that cost on the critical path.
            const [fittedHits, inferenceSession_] = await Promise.all([
                fitPromptToWindow(hits, query),
                LanguageModel.create({ ...SESSION_OPTIONS, systemPrompt: SYSTEM_PROMPT }),
            ]);
            hits = fittedHits;
            inferenceSession = inferenceSession_;

            if (!hits.length) {
                searchResults.innerHTML = '<p class="status">Context window too small to include any archive excerpts.</p>';
                finalizeUI(false);
                return;
            }

            const prompt = buildPrompt(hits, query);

            // 4. Run inference — prefer streaming, fall back to blocking.
            const didStream = await runStreamingInference(inferenceSession, prompt);
            if (!didStream) await runBlockingInference(inferenceSession, prompt);

            finalizeUI(true);

        } catch (err) {
            console.error('AI Search: Inference error', err);

            // Best-effort: show raw Orama results so the user still gets something.
            try {
                const fallbackHits = await retrieveChunks(query, 5);
                if (fallbackHits.length) {
                    renderFallbackResults(fallbackHits, 'AI response interrupted. Showing raw search results:');
                } else {
                    searchResults.innerHTML = '<p class="status">A system error occurred. Please try again.</p>';
                }
            } catch {
                searchResults.innerHTML = '<p class="status">A system error occurred. Please try again.</p>';
            }

            finalizeUI(false);
        } finally {
            // Always destroy the per-query session to free GPU/memory.
            inferenceSession?.destroy?.();
        }
    }

    /** Marks the search as complete and shows the reset link. */
    function finalizeUI(showDisclaimer) {
        searchBox.classList.add('complete');
        searchReset.classList.add('visible');

        if (showDisclaimer) {
            searchReset.innerHTML =
                '<p class="ai-disclaimer">This response is AI-generated by a model within your browswr, and may be inaccurate.</p>' +
                '<p><a href="/">Ask another question &rarr;</a></p>';
        } else {
            searchReset.innerHTML = '<p><a href="/">Ask another question &rarr;</a></p>';
        }

        searchInput.disabled = false;
    }

    // -------------------------------------------------------------------------
    // Initialisation
    // -------------------------------------------------------------------------
    async function start() {
        // Check model availability before showing any UI.
        let availability = 'no';
        try {
            if (typeof LanguageModel.availability === 'function') {
                // Pass SESSION_OPTIONS so Chrome picks the correct output language
                // classifier on this first API call — without it Chrome warns regardless
                // of what options subsequent create() calls use.
                availability = (await LanguageModel.availability(SESSION_OPTIONS)).toLowerCase().trim();
            } else if (typeof LanguageModel.capabilities === 'function') {
                const caps = await LanguageModel.capabilities(SESSION_OPTIONS);
                availability = (caps?.available ?? caps?.availability ?? 'no').toLowerCase().trim();
            }
        } catch (e) {
            console.warn('AI Search: Could not determine model availability.', e);
        }

        if (availability === 'no') {
            // Model not present and not downloadable on this device; stay hidden.
            return;
        }

        // Show the search container.
        searchContainer.style.display = 'block';

        // Kick off index loading in the background while the model warms up.
        const indexPromise = initSearchIndex().catch(e => hideSearch('Index load failed', e));

        // Attempt to initialise the AI session.
        searchInput.disabled = true;
        setStatus('Initializing local AI core…');

        try {
            // Startup probe: verify the model runs AND cache its context window size.
            // This is the only LanguageModel.create() call outside of inference,
            // keeping total session count per query at exactly 1.
            const probe = await LanguageModel.create({ ...SESSION_OPTIONS, systemPrompt: SYSTEM_PROMPT });
            cachedInputQuota = probe.inputQuota ?? probe.maxTokens ?? cachedInputQuota;
            probe.destroy?.();
            console.log(`AI Search: Model ready. inputQuota=${cachedInputQuota} tokens. Availability: ${availability}`);
        } catch (e) {
            if (isCrashLoopError(e)) {
                // Chrome has circuit-broken the model sub-process for this session.
                // Show the search box with an actionable message instead of hiding it.
                console.warn('AI Search: Model crash-loop detected.', e);
                searchContainer.style.display = 'block';
                setStatus('Neural core unstable — please restart Chrome to reset.');
                statusOverlay.style.cursor = 'default';
            } else {
                // Model needs a user gesture (download not yet triggered) or truly unavailable.
                hideSearch('Model unavailable or requires download gesture', e);
            }
            return;
        }

        // Wait for the index to finish loading.
        await indexPromise;

        if (!oramaDb) {
            // Index failed to load; search is pointless.
            hideSearch('Search index unavailable.');
            return;
        }

        isReady = true;
        clearStatus();
    }

    // -------------------------------------------------------------------------
    // Event binding
    // -------------------------------------------------------------------------
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !searchInput.disabled) {
            submitQuery(searchInput.value);
        }
    });

    // Bootstrap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
