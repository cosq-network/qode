# Qode Authentication

Qode provides an encrypted interactive auth flow and optional environment-variable access for providers.

## Secure interactive auth

From inside Qode, use:
```text
/auth status
/auth list
/auth set <provider>
/auth clear <provider>
```

Examples:
```text
/auth set openai
/auth set gemini
/auth set anthropic
/auth clear openrouter
```

Provider keys are entered through a masked prompt and stored encrypted.

From the system shell, use:
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
/auth clear <provider>
```

Examples:
```text
/auth clear openai
/auth clear gemini
/auth clear anthropic
/auth clear copilot
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


- DeepSeek API
- OpenRouter

- OpenCode Zen
- Z.ai

## Server and headless usage

For servers and CI:
- prefer environment variables
- ensure outbound HTTPS to the provider endpoints is allowed
- avoid interactive `qode auth` flows in non-interactive environments
