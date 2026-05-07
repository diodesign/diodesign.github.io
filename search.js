/**
 * diodesign.org Search Logic: Graceful AI Lifecycle
 * Optimized for Chrome 147 (2026) Native LanguageModel API
 */

document.addEventListener('DOMContentLoaded', async () => {
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
    let searchIndex = [];

    // 2. Silent Detection (Circuit Breaker)
    let aiModel = null;
    if (window.LanguageModel) {
        aiModel = window.LanguageModel;
    } else if (window.ai && window.ai.languageModel) {
        aiModel = window.ai.languageModel;
    } else if (window.ai && window.ai.assistant) {
        aiModel = window.ai.assistant;
    }

    if (!aiModel) {
        return;
    }

    /**
     * Initializes the LanguageModel session using the Singleton Pattern.
     * Persists the session object to avoid redundant 25s cold-start lags.
     */
    async function initializeAI() {
        statusOverlay.style.display = 'flex';
        statusOverlay.innerHTML = '<span><div class="search-spinner"></div>Initializing AI Model (may take a few moments)...</span>';
        statusOverlay.style.cursor = 'wait';
        searchInput.disabled = true;

        try {
            // Initialize with schema compliance
            session = await aiModel.create({
                systemPrompt: "You are the diodesign lab AI. Answer using the provided technical archives. Maintain a concise, technical, and objective voice. It's OK to match the user's tone with your own but NEVER be offensive nor unprofessional."
            });

            statusOverlay.style.display = 'none';
            cloudFallback.style.display = 'none';
            searchInput.disabled = false;
            searchInput.placeholder = "Ask the lab anything...";
            searchInput.focus();
        } catch (e) {
            console.error('AI Initialization failed:', e);
            statusOverlay.style.display = 'none';

            // Cloud Fallback on failure
            cloudFallback.style.display = 'block';
            cloudFallback.innerHTML = 'Neural link stalled. <a href="https://www.google.com/">Use Cloud Search &rarr;</a>';
        }
    }

    /**
     * Initial lifecycle check
     */
    async function startLifecycle() {
        try {
            const isNewApi = typeof aiModel.capabilities === 'function';
            let status;
            if (isNewApi) {
                const caps = await aiModel.capabilities();
                status = caps.available;
            } else {
                status = await aiModel.availability();
            }

            if (status === 'no') {
                return; // Silent abort: completely unavailable
            }

            searchContainer.style.display = 'block';

            if (status !== 'readily' && status !== 'available') {
                statusOverlay.style.display = 'flex';
                statusOverlay.innerHTML = '<span><div class="search-spinner"></div>Downloading model... please wait.</span>';
                statusOverlay.style.cursor = 'wait';
                searchInput.disabled = true;

                // Poll every 5 seconds until ready or downloaded
                const interval = setInterval(async () => {
                    const checkStatus = isNewApi ? (await aiModel.capabilities()).available : await aiModel.availability();
                    if (checkStatus === 'readily' || checkStatus === 'available' || checkStatus === 'after-download') {
                        clearInterval(interval);
                        await initializeAI();
                    }
                }, 5000);
            } else {
                await initializeAI();
            }
        } catch (e) {
            console.error('Lifecycle check failed', e);
        }
    }

    // Load search-index.json context
    try {
        const response = await fetch('/search-index.json');
        if (response.ok) {
            searchIndex = await response.json();
        }
    } catch (e) { }

    /**
     * Handles query submission with streaming logic and async iteration
     */
    async function submitQuery(query) {
        if (!query.trim() || !session) return;

        // Context filtering
        const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
        const scoredEntries = searchIndex.map(entry => {
            let score = 0;
            const contentLower = entry.content.toLowerCase();
            const titleLower = entry.title.toLowerCase();
            keywords.forEach(kw => {
                if (titleLower.includes(kw)) score += 10;
                const matches = contentLower.match(new RegExp(kw, 'gi'));
                if (matches) score += (matches ? matches.length : 0);
            });
            return { ...entry, score };
        });

        const context = scoredEntries
            .filter(e => e.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(e => `[Source: ${e.title}] ${e.content}`)
            .join('\n\n') || "No archived lab data found for this query.";

        if (!splashWrapper.classList.contains('collapsed')) {
            splashWrapper.classList.add('collapsed');
        }
        if (splashText && !splashText.classList.contains('collapsed')) {
            splashText.classList.add('collapsed');
        }

        searchResults.style.display = 'block';
        searchBox.classList.remove('complete');
        searchReset.classList.remove('visible');

        // User feedback for cold-start latency
        searchResults.innerHTML = '<p class="status"><div class="search-spinner"></div><em>Consulting neural archives... (Cold start can take ~25s)</em></p>';

        try {
            const prompt = `LAB ARCHIVES:\n${context}\n\nQUERY: ${query}\n\nRESPONSE:`;

            // Streaming Logic: Async Iterator for search results
            const stream = session.promptStreaming(prompt);

            searchResults.innerHTML = '';
            let currentText = '';

            for await (const chunk of stream) {
                // Handle both cumulative and delta-based streaming
                if (chunk.startsWith(currentText)) {
                    currentText = chunk;
                } else {
                    currentText += chunk;
                }

                if (typeof marked !== 'undefined') {
                    searchResults.innerHTML = marked.parse(currentText);
                } else {
                    searchResults.innerHTML = currentText
                        .split('\n\n')
                        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                        .join('');
                }
                searchResults.scrollTop = searchResults.scrollHeight;
            }

            // Mark as complete once the stream finishes
            searchBox.classList.add('complete');
            searchReset.classList.add('visible');
            searchReset.innerHTML = '<a href="/">Ask another question &rarr;</a>';
        } catch (err) {
            console.error('Inference failed');
            searchContainer.style.display = 'none';
            cloudFallback.style.display = 'block';
            splashWrapper.classList.remove('collapsed');
            if (splashText) splashText.classList.remove('collapsed');
        }
    }

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !searchInput.disabled) {
            e.preventDefault();
            submitQuery(searchInput.value);
        }
    });

    // Execute lifecycle start
    startLifecycle();
});
