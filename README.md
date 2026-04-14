# openrouter-cli

Small Node.js CLI for OpenRouter model discovery with no runtime dependencies.

## Quick start

```bash
npm install
OPENROUTER_API_KEY=sk-or-v1-... node ./bin/openrouter.js models user
```

## Common commands

```bash
# cheapest tool-capable text models
node ./bin/openrouter.js models list --support tools --sort prompt-price --limit 10

# privacy-aware models for the current API key
node ./bin/openrouter.js models user --json

# EU in-region filtered view
node ./bin/openrouter.js models user --region eu

# compare provider endpoint performance for one model
node ./bin/openrouter.js models endpoints openai/gpt-4o-mini --sort latency

# inspect the current key
node ./bin/openrouter.js key info
```

Run `node ./bin/openrouter.js --help` for the full command reference.
