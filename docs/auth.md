# Qode Authentication

Qode provides an encrypted interactive auth flow and optional environment-variable access for providers.

## Secure interactive auth

Use:
```bash
qode auth
qode auth --reset
```

Credential storage:
- `~/.qode/auth.json`

This file should be treated as sensitive.

Saved credentials may include:
- API keys
- Device code tokens
- Other accepted provider types

Qode attempts to validate credentials before saving them when the provider supports validation.

## Disconnecting

From inside Qode:
```text
/auth logout <provider>
```

Examples:
```text
/auth logout OpenAI
/auth logout Google AI Studio
/auth logout Anthropic
/auth logout GitHub Copilot
```

Also remove:
```bash
qode auth --reset
```

This removes all stored API keys.

## Providers by auth method

Interactive auth flow:
- Google AI Studio
- OpenAI
- Anthropic
- GitHub Copilot

Environment-variable / API-key auth without `qode auth`:
- GitHub Models
- DeepSeek API
- OpenRouter
- GroqCloud
- OpenCode Zen

## Server and headless usage

For servers and CI:
- prefer environment variables
- ensure outbound HTTPS to the provider endpoints is allowed
- avoid interactive `qode auth` flows in non-interactive environments
