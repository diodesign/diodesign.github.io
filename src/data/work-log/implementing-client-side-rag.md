---
title: "Implementing client-side RAG"
date: "2026-05-06"
byline: "Chris Williams"
permalink: "implementing-client-side-rag.html"
summary: "Surviving a 6,144 token limit with Orama and a fail-safe retrieval pipeline."
---

After [integrating the Chrome Prompt API](/work-log/chrome-prompt-api-integration.html) with diodeaign.org to provide client-side AI site search, I quickly ran into an interesting brick wall of a challenge: the (right now) 6,144-token context window of the on-device Gemini Nano model. While 6K tokens might sound generous for a quick chat, it's nowhere near enough to hold the entire archive of the site to interrogate.

If I just dumped every log entry into the combined user prompt and system prompt, the model would simply choke or truncate the most important bits.

The solution is a client-side Retrieval-Augmented Generation (RAG) architecture. Instead of giving the AI everything when you're trying to search the site's archives, I only give it the snippets, or "chunks", that are actually relevant to your query.

### The indexing pipeline

The first step happens at build time. I updated the `build.py` script to process every Markdown file and "chunk" the text into 5,000-character segments. I also made sure to inject each text's metadata, such as the byline and summary, into each chunk so the search engine knows who wrote what and why. 

These chunks are exported into a `search-index.json` file, which is fetched by the browser when the "Lab AI" initializes.

### Retrieval: Orama and the fail-safe fallback

For the retrieval engine, I'm using [Orama](https://docs.orama.com/), a lightweight, WASM-based search engine that runs entirely in the browser. It handles the heavy lifting of indexing the site's content on the fly and performing ranked keyword searches.

However, natural language is messy. I found that a strict search engine sometimes penalizes conversational queries. To combat this, I implemented a two-stage retrieval pipeline:

1. As the primary search, Orama attempts a ranked search across all chunks.
2. As a keyword fallback, if Orama returns zero hits, the system triggers a fail-safe manual scan. It breaks the query into individual keywords and ranks every chunk by how many unique terms it matches.

This ensures that if you ask about a specific data point, such as which riots did I cover while working in the media, the system will find it even if the rest of the query is noisy.

### Staying within the token budget

Once the relevant chunks are found, I have to ensure they actually fit in the 6,144-token window. The system now performs a token budget check before every inference:

- It uses `session.countPromptTokens()` to measure the size of the combined prompt.
- If the count exceeds the limit (with a safety margin), it iteratively drops the least relevant chunks from the context until it fits.
- The maximum number of tokens is defined by `session.maxTokens`, which is used as the limit.

### Citing sources

Finally, I tuned the system prompt to make the AI more academic. Instead of vague summaries, it's now instructed to cite its sources directly, such as: "According to the [Title] log..." This makes the answers feel less like a hallucination and more like a genuine research assistant tapping into the lab's archives.

The result is a search experience that's private, kinda fast on my laptop, and hopefully knows what it's talking about.
