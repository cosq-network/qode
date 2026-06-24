# OpenAI

Qode provider key: `OpenAI`

Reference page: https://platform.openai.com

## Intended use

Use this provider for OpenAI-hosted models with a standard OpenAI API key.

## Credential setup

Save using Qode's interactive auth flow:
```bash
qode auth
```

Then choose `OpenAI` and paste an API key from https://platform.openai.com/api-keys.

## Runtime auth behavior

- `qode auth` stores the key in `~/.qode/auth.json` and can revalidate it when possible.
- For automation, set `OPENAI_API_KEY`.
- The runtime prefers `OPENAI_API_KEY` from the environment when present.

## Environment variables

Preferred:
```text
OPENAI_API_KEY=...
```

Value required by provider: an OpenAI API key.

## Which activation/payment sources apply

- This provider is not free by default.
- Use requires an OpenAI account with billing and available credits.
- In some programs, ChatGPT Plus/Pro/Team benefits do not automatically include API credits.

## Headless / server usability

Yes. This provider is suitable for servers and CI when:
- `OPENAI_API_KEY` is provided via environment or secret store,
- and outbound HTTPS to OpenAI endpoints is allowed.

## Available models

Current integration includes:
- `gpt-5-mini`

Choose with:
```text
/model gpt-5-mini
```

Additional compatible OpenAI model IDs may be usable depending on account access and provider mapping.

## Switching models

Change the active model for the current session:
```text
/model gpt-5-mini
```

## Limits and notes

- Limits depend on the selected model and your OpenAI account tier.
- If validation or completion fails, confirm the key on https://platform.openai.com/api-keys and rerun `qode auth` if needed.
