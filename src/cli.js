import { parseArgs } from "./args.js";
import {
  formatCurrencyPerMillion,
  formatInteger,
  formatLatencySeconds,
  formatPercent,
  renderKeyValueBlock,
  renderTable,
} from "./format.js";
import {
  renderEndpointsHelp,
  renderKeyHelp,
  renderMainHelp,
  renderModelsListHelp,
} from "./help.js";
import { applyModelFilters, sortEndpoints } from "./models.js";
import { OpenRouterClient, resolveBaseUrl } from "./openrouter-api.js";

function write(message, stream = process.stdout) {
  stream.write(`${message}\n`);
}

function writeError(message) {
  process.stderr.write(`Error: ${message}\n`);
}

function buildClient(options) {
  const baseUrl = resolveBaseUrl({
    baseUrl: options["base-url"] || process.env.OPENROUTER_BASE_URL,
    region: options.region || process.env.OPENROUTER_REGION,
  });

  return new OpenRouterClient({
    apiKey: options["api-key"] || process.env.OPENROUTER_API_KEY,
    baseUrl,
    referer: process.env.OPENROUTER_HTTP_REFERER,
    appTitle: process.env.OPENROUTER_APP_TITLE || "openrouter-cli",
  });
}

function renderModelRows(models) {
  return renderTable(models, [
    { label: "Model", value: (model) => model.id },
    {
      label: "Prompt",
      value: (model) =>
        model.prompt_price_is_special
          ? "router"
          : formatCurrencyPerMillion(model.prompt_price_per_million),
    },
    {
      label: "Completion",
      value: (model) =>
        model.completion_price_is_special
          ? "router"
          : formatCurrencyPerMillion(model.completion_price_per_million),
    },
    { label: "Context", value: (model) => formatInteger(model.context_length) },
    { label: "Outputs", value: (model) => model.output_modalities.join(",") || "-" },
    { label: "Moderated", value: (model) => (model.is_moderated ? "yes" : "no") },
  ]);
}

function renderEndpointRows(endpoints) {
  return renderTable(endpoints, [
    { label: "Provider", value: (endpoint) => endpoint.provider_name || endpoint.name },
    { label: "Prompt", value: (endpoint) => formatCurrencyPerMillion(endpoint.prompt_price_per_million) },
    {
      label: "Completion",
      value: (endpoint) => formatCurrencyPerMillion(endpoint.completion_price_per_million),
    },
    { label: "Latency", value: (endpoint) => formatLatencySeconds(endpoint.latency_p50) },
    { label: "Throughput", value: (endpoint) => endpoint.throughput_p50?.toFixed(1) ?? "-" },
    { label: "Uptime", value: (endpoint) => formatPercent(endpoint.uptime_last_30m) },
    { label: "Context", value: (endpoint) => formatInteger(endpoint.context_length) },
  ]);
}

async function handleModels(command, options) {
  const client = buildClient(options);

  if (command === "list") {
    const query = {};
    if (options.category) {
      query.category = options.category;
    }
    if (options.support) {
      query.supported_parameters = Array.isArray(options.support)
        ? options.support.join(",")
        : options.support;
    }
    if (options.modality) {
      query.output_modalities = Array.isArray(options.modality)
        ? options.modality.join(",")
        : options.modality;
    }

    const payload = await client.getModels(query);
    const models = applyModelFilters(payload.data || [], options);
    if (options.json) {
      write(JSON.stringify({ data: models }, null, 2));
      return 0;
    }
    write(renderModelRows(models));
    return 0;
  }

  if (command === "user") {
    const payload = await client.getUserModels();
    const models = applyModelFilters(payload.data || [], options);
    if (options.json) {
      write(JSON.stringify({ data: models }, null, 2));
      return 0;
    }
    write(renderModelRows(models));
    return 0;
  }

  if (command === "endpoints") {
    const modelId = options._modelId;
    if (!modelId) {
      write(renderEndpointsHelp());
      return 1;
    }
    const payload = await client.getModelEndpoints(modelId);
    const data = payload.data || {};
    const endpoints = sortEndpoints(data.endpoints || [], options.sort || "latency");
    if (options.json) {
      write(JSON.stringify({ ...data, endpoints }, null, 2));
      return 0;
    }
    write(`${data.id || modelId}`);
    write(renderEndpointRows(endpoints));
    return 0;
  }

  write(renderModelsListHelp());
  return 1;
}

async function handleKey(command, options) {
  if (command !== "info") {
    write(renderKeyHelp());
    return 1;
  }

  const client = buildClient(options);
  const payload = await client.getCurrentKey();
  const keyInfo = payload.data || {};

  if (options.json) {
    write(JSON.stringify(payload, null, 2));
    return 0;
  }

  write(
    renderKeyValueBlock([
      ["label", keyInfo.label ?? "-"],
      ["limit", keyInfo.limit ?? "-"],
      ["limit_remaining", keyInfo.limit_remaining ?? "-"],
      ["usage", keyInfo.usage ?? "-"],
      ["usage_daily", keyInfo.usage_daily ?? "-"],
      ["usage_monthly", keyInfo.usage_monthly ?? "-"],
      ["free_tier", keyInfo.is_free_tier ? "yes" : "no"],
      ["management_key", keyInfo.is_management_key ? "yes" : "no"],
      ["provisioning_key", keyInfo.is_provisioning_key ? "yes" : "no"],
      ["expires_at", keyInfo.expires_at ?? "-"],
    ]),
  );
  return 0;
}

function resolveHelpTarget(positionals) {
  return positionals.join(" ").trim();
}

export async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    writeError(error.message);
    write(renderMainHelp());
    return 1;
  }

  const { options, positionals } = parsed;

  if (options.help || positionals.length === 0) {
    const target = resolveHelpTarget(positionals);
    if (target === "models list" || target === "models user" || target === "models") {
      write(renderModelsListHelp());
      return 0;
    }
    if (target === "models endpoints") {
      write(renderEndpointsHelp());
      return 0;
    }
    if (target === "key" || target === "key info") {
      write(renderKeyHelp());
      return 0;
    }
    write(renderMainHelp());
    return 0;
  }

  if (positionals[0] === "help") {
    const target = resolveHelpTarget(positionals.slice(1));
    if (target === "models" || target === "models list" || target === "models user") {
      write(renderModelsListHelp());
      return 0;
    }
    if (target === "models endpoints") {
      write(renderEndpointsHelp());
      return 0;
    }
    if (target === "key" || target === "key info") {
      write(renderKeyHelp());
      return 0;
    }
    write(renderMainHelp());
    return 0;
  }

  try {
    if (positionals[0] === "models") {
      const [_, subcommand, maybeModelId] = positionals;
      options._modelId = maybeModelId;
      return await handleModels(subcommand, options);
    }

    if (positionals[0] === "key") {
      const [_, subcommand] = positionals;
      return await handleKey(subcommand, options);
    }

    writeError(`Unknown command: ${positionals.join(" ")}`);
    write(renderMainHelp());
    return 1;
  } catch (error) {
    writeError(error.message);
    return 1;
  }
}
