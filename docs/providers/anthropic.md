# Anthropic / Claude

Qode provider key: `Anthropic`

Reference pages:
- https://console.anthropic.com
- https://docs.anthropic.com

## Intended use

Use this provider for Anthropic's Claude models accessed by API key.

## Credential setup

Save using Qode's interactive auth flow:
```bash
qode auth
```

Then choose `Anthropic` and paste an API key from https://console.anthropic.com.

## Runtime auth behavior

- `qode auth` stores the key in `~/.qode/auth.json` and revalidates it.
- For non-interactive environments, set `ANTHROPIC_API_KEY`.
- The runtime prefers `ANTHROPIC_API_KEY` from the environment when present.

## Environment variables

Preferred:
```text
ANTHROPIC_API_KEY=...
```

Value required by provider: an Anthropic API key.

## Which activation/payment sources apply

- Requires an Anthropic account with API access enabled.
- Access may require credits or an eligible Claude subscription depending on account state.
- Verification is attempted through the Messages API using a small probe request.

## Headless / server usability

Yes. This provider is suitable for servers and CI when:
- `ANTHROPIC_API_KEY` is provided via environment or secret store,
- and outbound HTTPS to Anthropic endpoints is allowed.

## Available models

Current integration includes:
- `claude-3-haiku-20240307`

Choose with:
```text
/model claude-3-haiku-20240307
```

Additional Claude model IDs may be usable depending on your Anthropic Console access and provider mapping.

## Switching models

Change the active model for the current session:
```text
/model claude-3-haiku-20240307
```

## Limits and notes

- API access eligibility depends on account tier and billing status.
- Validation uses a minimal Messages API request.
