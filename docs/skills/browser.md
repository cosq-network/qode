# Browser skill

## What it does
The browser skill lets Qode inspect web pages, navigate the DOM, fill forms, press keys, take screenshots, and view images or accessibility snapshots.

## Tools
Web browsing tools locally include `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_press`, `browser_vision`, `browser_back`, `browser_get_images`, and `browser_console`.

## How to use
Use the browser skill when you want Qode to:
- open a website and see page structure,
- read an accessibility tree,
- click buttons or fill forms,
- take a screenshot or inspect a rendered page,
- inspect console errors from a page.

**Examples**

- Open https://example.com and take a screenshot.
- Go to https://example.com, inspect the accessibility tree, then click the first link in the main content.
- Open the login page, fill the username and password fields, and report whether a submit button is enabled.
