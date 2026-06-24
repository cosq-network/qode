# GitHub Copilot

Qode provider key: `GitHub Copilot`
Auth type: device code flow

Reference: https://github.com/login/device

## Intended use

Use this provider when you have a GitHub account with access to GitHub Models and want terminal-based sign-in without pasting a personal access token.

## Runtime auth behavior

- This provider uses GitHub's device code flow.
- Qode opens the GitHub device verification URL and polls for completion.
- No secret persistence is required beyond the resulting access token.

## Credential setup

```bash
qode auth
```

Then choose `GitHub Copilot`.

## Sign-in flow

1. Open `https://github.com/login/device`
2. Enter the user code shown in the terminal
3. Complete GitHub authorization in the browser

Qode attempts to open the current platform's browser automatically:
- macOS: `open`
- Windows: `start`
- Linux: `xdg-open`

## Environment variables

Environment variable authentication is not used for this provider.

## Which activation/payment sources apply

- Requires a GitHub account.
- Model access and rate limits depend on GitHub access state and GitHub Models support.

## Headless / server usability

Yes, but device code flow may not be practical for non-interactive hosts:
- A user must finish GitHub authorization manually on another device or in the browser.
- This provider is better for CLI/laptop use than for fully headless automation.

## Available models

Current integration focuses on device-code connected access.

## Switching models

Use Qode's model switch command once connected:
```text
/model <model-name>
```

## Limits and notes

- Device-code sessions expire after the provider-defined window.
- Polling stops on completion, error, or timeout.
