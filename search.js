/**
 * diodesign.org Search Logic: Graceful AI Lifecycle + RAG
 * Optimized for Chrome 147 (2026) Native LanguageModel API
 */

(async function () {
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const splashWrapper = document.getElementById('splash-canvas-wrapper');
    const splashText = document.getElementById('splash-text');
    const statusOverlay = document.getElementById('search-status-overlay');
    const cloudFallback = document.getElementById('search-cloud-fallback');
    const searchReset = document.getElementById('search-reset');
    const searchBox = document.querySelector('.search-box');

    let session = null;
    let oramaDb = null;
    let oramaAPI = null;
    let allChunks = [];

    let aiModel = window.ai?.languageModel || window.ai?.assistant || window.LanguageModel;

    if (!aiModel) {
        console.log("AI Search: No native AI model found in window.ai or window.LanguageModel.");
        return;
    }

    /**
     * Initializes Orama database and indexes site content chunks
     */
    async function initializeSearchIndex() {
        try {
            console.log("AI Search: Loading Orama...");
            const oramaModule = await import('https://cdn.jsdelivr.net/npm/@orama/orama@latest/dist/index.js');
            oramaAPI = oramaModule;

            const response = await fetch('/search-index.json');
            if (!response.ok) return;
            allChunks = await response.json();

            oramaDb = await oramaAPI.create({
                schema: {
                    title: 'string',
                    content: 'string',
                    url: 'string',
                    chunk: 'number'
                }
            });

            for (const chunk of allChunks) {
                await oramaAPI.insert(oramaDb, chunk);
            }
            console.log(`AI Search: Orama indexed ${allChunks.length} chunks.`);
        } catch (e) {
            console.error('AI Search: Failed to initialize search index:', e);
        }
    }

    /**
     * Initializes the LanguageModel session using the Singleton Pattern.
     */
    async function initializeAI() {
        statusOverlay.style.display = 'flex';
        statusOverlay.innerHTML = '<span><div class="search-spinner"></div>Initializing AI Model...</span>';
        statusOverlay.style.cursor = 'wait';
        searchInput.disabled = true;

        try {
            session = await aiModel.create({
                systemPrompt: "You are the diodesign lab AI. Answer using the provided technical archives. When responding, try to cite the source title if possible (e.g., 'According to the [Title] log...'). Maintain a professional, objective, yet helpful tone. Use ONLY the provided archives. If the archives don't contain the answer, say you don't know based on the lab records.",
                expectedOutputLanguage: 'en'
            });

            statusOverlay.style.display = 'none';
            cloudFallback.style.display = 'none';
            searchInput.disabled = false;
            searchInput.placeholder = "Ask the lab anything...";
            searchInput.focus();
            console.log("AI Search: Session initialized.");
        } catch (e) {
            console.error('AI Search: Initialization failed:', e);
            statusOverlay.style.display = 'none';
            cloudFallback.style.display = 'block';
            cloudFallback.innerHTML = 'Neural link stalled. <a href="https://www.google.com/">Use Cloud Search &rarr;</a>';
        }
    }

    /**
     * Initial lifecycle check
     */
    async function startLifecycle() {
        try {
            let status;
            if (typeof aiModel.capabilities === 'function') {
                const caps = await aiModel.capabilities();
                status = caps.available || caps.availability;
            } else if (typeof aiModel.availability === 'function') {
                status = await aiModel.availability();
            }

            console.log(`AI Search: Availability status is "${status}"`);

            if (status === 'no') return;

            searchContainer.style.display = 'block';

            const indexPromise = initializeSearchIndex();

            if (status !== 'readily' && status !== 'available') {
                statusOverlay.style.display = 'flex';
                statusOverlay.innerHTML = '<span><div class="search-spinner"></div>Downloading model weights (4GB)... please wait.</span>';
                statusOverlay.style.cursor = 'wait';
                searchInput.disabled = true;

                const interval = setInterval(async () => {
                    let checkStatus;
                    if (typeof aiModel.capabilities === 'function') {
                        const caps = await aiModel.capabilities();
                        checkStatus = caps.available || caps.availability;
                    } else {
                        checkStatus = await aiModel.availability();
                    }

                    if (checkStatus === 'readily' || checkStatus === 'available' || checkStatus === 'after-download') {
                        clearInterval(interval);
                        await initializeAI();
                    }
                }, 5000);
            } else {
                await initializeAI();
            }
            await indexPromise;
        } catch (e) {
            console.error('AI Search: Lifecycle check failed', e);
        }
    }

    /**
     * Handles query submission with RAG logic
     */
    async function submitQuery(query) {
        if (!query.trim() || !session) return;

        // Disable input during and after search to prevent interference
        searchInput.disabled = true;

        if (!splashWrapper.classList.contains('collapsed')) {
            splashWrapper.classList.add('collapsed');
        }
        if (splashText && !splashText.classList.contains('collapsed')) {
            splashText.classList.add('collapsed');
        }

        searchResults.style.display = 'block';
        searchBox.classList.remove('complete');
        searchReset.classList.remove('visible');
        searchResults.innerHTML = '<p class="status"><div class="search-spinner"></div><em>Retrieving archives and consulting neural core...</em></p>';

        try {
            // Use a broader search to ensure we don't miss relevant chunks
            console.log(`AI Search: Retrieving context for query: "${query}"`);
            let results = await oramaAPI.search(oramaDb, {
                term: query,
                limit: 10,
                boost: { title: 2 },
                threshold: 0,
                operator: 'or'
            });

            console.log("AI Search: Retrieval results:", results.hits);

            let currentHits = [];
            if (results.hits.length > 0) {
                currentHits = results.hits;
            } else {
                // Manual Fallback for small index: simple keyword matching with ranking
                console.log("AI Search: Orama returned no hits. Falling back to ranked keyword search.");
                const keywords = query.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(k => k.length > 2);

                currentHits = allChunks.map(c => {
                    const contentLower = (c.title + " " + c.content).toLowerCase();
                    const score = keywords.reduce((s, kw) => s + (contentLower.includes(kw) ? 1 : 0), 0);
                    return { ...c, score };
                }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

                if (currentHits.length > 0) {
                    console.log(`AI Search: Fallback found ${currentHits.length} matches. Top score: ${currentHits[0].score}`);
                }
            }

            if (currentHits.length === 0) {
                searchResults.innerHTML = '<p class="status">No relevant archives found in the lab records for this query.</p>';
                searchBox.classList.add('complete');
                searchReset.classList.add('visible');
                // Re-enable if nothing was found to allow retry
                searchInput.disabled = false;
                return;
            }

            // Build the prompt with token budget check
            const maxTokens = session.maxTokens || 4096;
            const safetyMargin = 500;

            async function buildPrompt(hits) {
                const contextStr = hits.map(h => {
                    const title = h.document ? h.document.title : h.title;
                    const url = h.document ? h.document.url : h.url;
                    const content = h.document ? h.document.content : h.content;
                    return `[Source: ${title} (${url})] ${content}`;
                }).join('\n\n');
                return `LAB ARCHIVES:\n${contextStr}\n\nQUERY: ${query}\n\nRESPONSE:`;
            }

            let prompt = await buildPrompt(currentHits);
            let tokenCount = 0;

            try {
                tokenCount = await session.countPromptTokens(prompt);
                console.log(`AI Search: Initial token count: ${tokenCount}/${maxTokens}`);

                // If too large, drop chunks from the bottom until it fits
                while (tokenCount > (maxTokens - safetyMargin) && currentHits.length > 1) {
                    console.warn('AI Search: Context too large, dropping a chunk...');
                    currentHits.pop();
                    prompt = await buildPrompt(currentHits);
                    tokenCount = await session.countPromptTokens(prompt);
                    console.log(`AI Search: Revised token count: ${tokenCount}/${maxTokens}`);
                }
            } catch (e) {
                tokenCount = prompt.length / 4;
            }

            console.log("AI Search: Final prompt to model:", prompt);

            const stream = session.promptStreaming(prompt);
            searchResults.innerHTML = '';
            let currentText = '';

            for await (const chunk of stream) {
                if (chunk.startsWith(currentText)) {
                    currentText = chunk;
                } else {
                    currentText += chunk;
                }

                if (window.marked) {
                    searchResults.innerHTML = window.marked.parse(currentText);
                } else {
                    searchResults.innerHTML = currentText.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
                }
                searchResults.scrollTop = searchResults.scrollHeight;
            }

            searchBox.classList.add('complete');
            searchReset.classList.add('visible');
            searchReset.innerHTML = '<a href="/">Ask another question &rarr;</a>';
        } catch (err) {
            console.error('AI Search: Inference failed', err);
            searchResults.innerHTML = '<p class="status">Neural link error. The lab core is unreachable.</p>';
            searchReset.classList.add('visible');
            searchInput.disabled = false; // Re-enable on error
        }
    }

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !searchInput.disabled) {
            e.preventDefault();
            submitQuery(searchInput.value);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startLifecycle);
    } else {
        startLifecycle();
    }
})();
