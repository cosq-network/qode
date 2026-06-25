---
name: browser
version: 0.1.0
description: "Browse and debug HTML/web documents: render, inspect accessibility, capture screenshots, analyze UI state, and debug rendering."
---

Use this when the user asks to inspect, render, debug, or capture a web document or UI. Maps from the registered browser tools. Preferred sources of truth:
- local registered tools: browser_debug_html, browser_navigate, browser_press, browser_type, browser_snapshot, browser_vision
Every browser_run request must map directly to one of those tools.
