---
name: grep
version: 0.1.0
description: "Search file contents with grep or lexical search, replace text, and batch-update matching results."
---

Use this when the user asks to search/review/replace across files. Maps from the registered grep tools. Preferred sources of truth:
- local registered tools: grep_regex, grep_find_and_replace, grep_stream_file_updates, grep_search_then_replace
Every grep_run request must map directly to one of those tools.
