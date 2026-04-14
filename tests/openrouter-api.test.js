import test from "node:test";
import assert from "node:assert/strict";

import { OpenRouterClient } from "../src/openrouter-api.js";

test("OpenRouterClient passes AbortSignal timeout to fetch", async () => {
  let receivedSignal = null;
  const client = new OpenRouterClient({
    timeoutMs: 1234,
    fetchImpl: async (_url, init) => {
      receivedSignal = init.signal;
      return {
        ok: true,
        json: async () => ({ data: [] }),
      };
    },
  });

  await client.getModels();

  assert.ok(receivedSignal);
  assert.equal(typeof receivedSignal.aborted, "boolean");
});
