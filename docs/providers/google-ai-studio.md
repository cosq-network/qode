# Google AI Studio

Qode provider key: `Google AI Studio`

Reference pages:
- https://aistudio.google.com
- https://ai.google.dev/gemini-api/docs/api-key

## Intended use

This provider is for Google-hosted Gemini models accessed with a Google AI Studio API key.

## Credential setup

Save using Qode's interactive auth flow:
```bash
qode auth
```

Then choose `Google AI Studio` and paste an API key from https://aistudio.google.com/app/apikey.

## Runtime auth behavior

- `qode auth` stores the key in `~/.qode/auth.json` and can revalidate it.
- For non-interactive environments, set `GOOGLE_API_KEY`.
- Environmental `GOOGLE_API_KEY` is preferred by the runtime at launch if present.

## Environment variables

Preferred:
```text
GOOGLE_API_KEY=...
```

Value required by provider: a Google AI Studio API key.

## Which activation/payment sources apply

- Standard Google AI Studio pay-as-you-go is supported when billing is enabled on the Google project tied to the API key.
- Some access may be available through eligible Google accounts or credits.
- AI Ultra or Workspace-linked access may still use the same API key; provider eligibility is controlled from Google's side.

## Headless / server usability

Yes. This provider is appropriate for servers and CI when:
- `GOOGLE_API_KEY` is supplied through the environment or secret store,
- and outbound HTTPS to Google endpoints is allowed.

## Available models

Model options include:
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-3.1-pro-preview`

Choose with:
```text
/model gemini-2.5-flash
```

## Switching models

Change the active model for the current session:
```text
/model gemini-2.5-flash
```

## Limits and notes

- Context can be model-dependent; Flash/Pro-style models generally support large contexts.
- Rate limits and quotas depend on your Google AI Studio tier.
- API access can require an enabled billing account.
