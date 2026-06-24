# Z.ai

Qode provider key: `Z.ai`

## Intended use

Use this provider for Z.ai-hosted models once available.

## Credential setup

Save using Qode's interactive auth flow:
```bash
qode auth
```

Then choose `Z.ai` if listed by your loaded auth providers.

## Runtime auth behavior

- `qode auth` stores credentials in `~/.qode/auth.json`.
- For automation, provide configuration via supported environment variables if implemented for this provider.

## Environment variables

Use any documented environment variable names from Z.ai or Qode's provider mapping if available.

## Which activation/payment sources apply

- Requires a Z.ai account and access eligibility.
- Activation or payment details are provider-specific.

## Headless / server usability

Use on servers or CI only when the supported auth and endpoint requirements are satisfied.

## Available models

Current integration includes:
- `GLM-4.7-Flash`
- `GLM-5.2`

Choose with:
```text
/model GLM-4.7-Flash
```

## Switching models

Change the active model for the current session:
```text
/model GLM-4.7-Flash
```

## Limits and notes

- Limits depend on model and account state.
- If the provider flow changes, check the provider docs again.
