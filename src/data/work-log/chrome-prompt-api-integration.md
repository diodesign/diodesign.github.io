---
title: "Integrating the Chrome Prompt API"
date: "2026-05-02"
byline: "Chris Williams"
permalink: "chrome-prompt-api-integration.html"
summary: "Implementing local AI search using Chrome's native LanguageModel API."
---

This past weekend, I implemented a fully local AI search interface for diodeaign.org called "Ask the lab anything" using the experimental [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) built natively [into Chrome](https://developer.chrome.com/docs/ai/get-started), starting with Chrome Canary.

My goal was simple: use an on-device Large Language Model ([Gemini Nano](https://developer.android.com/ai/gemini-nano)) to answer user queries based on the static lab archives, completely eliminating cloud latency, subscription fees, and privacy concerns.

The primary challenge was managing the lifecycle of the 4GB neural weight component (`OptimizationGuideOnDeviceModel`) tied to the browser's profile directory. Initial implementations ran afoul of both the API namespace changing overnight (from `window.LanguageModel` to `window.ai.languageModel`) and silent schema changes that caused the browser's ML execution service to fatally hang during initialization.

The final architecture uses a graceful fallback approach:

1. Probe the API namespace to ensure the device supports the local model.
1. Intercept the `downloading` status to provide user feedback while Chrome silently fetches the 4GB weights in the background.
1. Manage the 25-second "cold start" latency (hydrating weights from disk to RAM) exclusively when the AI is first invoked.
1. Stream the output chunks directly into the UI alongside a dynamic DOM collapse, creating an organic chat experience.

If you have Chrome Canary properly configured, you can test it by clicking the search box on the homepage. If you don't, the site gracefully degrades, ensuring the core experience remains untouched.