import test from "node:test";
import assert from "node:assert/strict";

import { applyModelFilters, normalizeEndpoint, normalizeModel, sortEndpoints } from "../src/models.js";

const baseModel = {
  id: "openai/gpt-4o-mini",
  name: "GPT-4o mini",
  description: "Fast and cheap",
  context_length: 128000,
  created: 1700000000,
  pricing: {
    prompt: "0.00000015",
    completion: "0.0000006",
    request: "0",
    image: "0",
  },
  supported_parameters: ["tools", "response_format"],
  architecture: {
    input_modalities: ["text"],
    output_modalities: ["text"],
  },
  top_provider: {
    is_moderated: true,
  },
};

test("normalizeModel adds per-million price fields", () => {
  const model = normalizeModel(baseModel);
  assert.equal(model.prompt_price_per_million, 0.15);
  assert.equal(model.completion_price_per_million, 0.6);
  assert.equal(model.is_moderated, true);
});

test("applyModelFilters filters on price, context, and supported parameters", () => {
  const models = applyModelFilters(
    [
      baseModel,
      {
        ...baseModel,
        id: "anthropic/claude-expensive",
        pricing: { ...baseModel.pricing, prompt: "0.00001" },
        context_length: 32000,
        supported_parameters: ["temperature"],
      },
    ],
    {
      "max-prompt-price": "1",
      "min-context": "100000",
      support: "tools",
    },
  );

  assert.deepEqual(models.map((model) => model.id), ["openai/gpt-4o-mini"]);
});

test("sortEndpoints orders by latency ascending", () => {
  const endpoints = sortEndpoints(
    [
      {
        provider_name: "Slow",
        latency_last_30m: { p50: 1.4 },
        throughput_last_30m: { p50: 20 },
        pricing: { prompt: "0.000001", completion: "0.000002" },
      },
      {
        provider_name: "Fast",
        latency_last_30m: { p50: 0.2 },
        throughput_last_30m: { p50: 45 },
        pricing: { prompt: "0.000001", completion: "0.000002" },
      },
    ],
    "latency",
  );

  assert.deepEqual(endpoints.map((endpoint) => endpoint.provider_name), ["Fast", "Slow"]);
  assert.equal(normalizeEndpoint(endpoints[0]).latency_p50, 0.2);
});
