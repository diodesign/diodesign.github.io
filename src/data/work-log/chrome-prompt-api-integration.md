---
title: "Integrating the Chrome Prompt API"
date: "2026-05-02"
byline: "Chris Williams"
permalink: "chrome-prompt-api-integration.html"
summary: "Implementing local AI search using Chrome's native LanguageModel API."
---

For fun, I implemented a client-side AI-powered site search feature on diodeaign.org called [ask the lab](/). It uses the experimental [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) built natively [into Chrome](https://developer.chrome.com/docs/ai/get-started), starting with Chrome Canary. You ask this website a question using the text box on the homepage, and it uses an on-device large language model, currently [Gemini Nano](https://developer.android.com/ai/gemini-nano), if available, to answer those queries using the website's static archives, eliminating cloud latency and privacy concerns. It avoids sending anything to any server for processing.

The feature works by combining the archives with the user's query and a system prompt, then sending that payload to the on-device model and displaying the answer in the page.

The primary challenge was managing the lifecycle of the 4GB neural weight component (`OptimizationGuideOnDeviceModel`) tied to the browser's profile directory. I wanted to avoid making people download the model over and over, so I implemented logic to persist the model across sessions. Initial implementations ran afoul of both the API namespace changing overnight (from `window.LanguageModel` to `window.ai.languageModel`) and silent schema changes that caused the browser's ML execution service to fatally hang during initialization.

The final architecture uses a graceful fallback approach:

1. Probe the API namespace to ensure the device even supports the local model. There
   are hardware requirements, and if these aren't met, then the query box never even appears.
1. Intercept the `downloading` status to provide user feedback while Chrome silently
   fetches the 4GB of weights in the background.
1. Manage the initial "cold start" latency (telling the visitor the page is hydrating
   the weights from disk to RAM) when the AI is first invoked.
1. Stream the output chunks directly into the UI alongside a dynamic DOM collapse,
   creating a chat experience that's all too familiar these days.

If you have Chrome or Chrome Canary suitably configured, you can test it by clicking the search box on the homepage. If your browser or system doesn't support the API yet, the site appears exactly as it did before without the search box appearing.

As I said, this was for fun to get a handle on the new API, and add a bit more functionality for free to the site.