# Local model

Qode provider key: `local`
Runtime: `llama-server` from `llama.cpp`
Default bind: `http://127.0.0.1:8080/v1`

## API key

No API key required.

## Requirements

You need:
- a downloaded GGUF model in your configured local-model directory
- `llama-server` installed and on PATH

Enable local model support in your config:
- `localModel.enabled = true`
- optionally `localModel.autoStart = true`

## Switching models

Use Qode's model switch command with the local model name configured for your download.

## Subscription / sign-in

No account or subscription is required for local inference.

## Limits

- Limits depend on your hardware and the GGUF model.
- If you run out of RAM/VRAM or CPU performance, throughput or context size will decrease.
