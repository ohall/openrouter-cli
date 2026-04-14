function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPerMillion(price) {
  const numeric = toNumber(price);
  return numeric === null ? null : numeric * 1_000_000;
}

function arrayify(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    return value.split(",").map((part) => part.trim()).filter(Boolean);
  }
  return [];
}

function hasAllParameters(model, requiredParameters) {
  if (requiredParameters.length === 0) {
    return true;
  }

  const supported = new Set(model.supported_parameters || []);
  return requiredParameters.every((parameter) => supported.has(parameter));
}

function compareValues(left, right, direction = "asc") {
  const multiplier = direction === "desc" ? -1 : 1;
  if (left === right) {
    return 0;
  }
  if (left === null || left === undefined) {
    return 1;
  }
  if (right === null || right === undefined) {
    return -1;
  }
  return left > right ? multiplier : -multiplier;
}

export function normalizeModel(model) {
  return {
    ...model,
    prompt_price_per_million: toPerMillion(model.pricing?.prompt),
    completion_price_per_million: toPerMillion(model.pricing?.completion),
    request_price: toNumber(model.pricing?.request),
    image_price: toNumber(model.pricing?.image),
    input_modalities: model.architecture?.input_modalities || [],
    output_modalities: model.architecture?.output_modalities || [],
    is_moderated: Boolean(model.top_provider?.is_moderated),
  };
}

export function applyModelFilters(models, options = {}) {
  const normalized = models.map(normalizeModel);
  const requiredParameters = arrayify(options.support);
  const requestedModalities = arrayify(options.modality);
  const limit = options.limit ? Number(options.limit) : null;
  const search = typeof options.search === "string" ? options.search.toLowerCase() : null;
  const maxPromptPrice = options["max-prompt-price"] ? Number(options["max-prompt-price"]) : null;
  const maxCompletionPrice = options["max-completion-price"]
    ? Number(options["max-completion-price"])
    : null;
  const minContext = options["min-context"] ? Number(options["min-context"]) : null;
  const freeOnly = Boolean(options["free-only"]);

  const filtered = normalized.filter((model) => {
    if (search) {
      const haystack = [model.id, model.name, model.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (maxPromptPrice !== null && (model.prompt_price_per_million ?? Infinity) > maxPromptPrice) {
      return false;
    }

    if (
      maxCompletionPrice !== null &&
      (model.completion_price_per_million ?? Infinity) > maxCompletionPrice
    ) {
      return false;
    }

    if (minContext !== null && (model.context_length ?? 0) < minContext) {
      return false;
    }

    if (requestedModalities.length > 0) {
      const outputs = new Set(model.output_modalities);
      if (!requestedModalities.every((modality) => outputs.has(modality))) {
        return false;
      }
    }

    if (!hasAllParameters(model, requiredParameters)) {
      return false;
    }

    if (freeOnly) {
      const priceValues = [
        model.prompt_price_per_million,
        model.completion_price_per_million,
        model.request_price,
        model.image_price,
      ].filter((value) => value !== null);

      if (priceValues.some((value) => value !== 0)) {
        return false;
      }
    }

    return true;
  });

  const sort = options.sort || "prompt-price";
  filtered.sort((left, right) => {
    switch (sort) {
      case "completion-price":
        return compareValues(left.completion_price_per_million, right.completion_price_per_million);
      case "context":
        return compareValues(left.context_length, right.context_length, "desc");
      case "newest":
        return compareValues(left.created, right.created, "desc");
      case "name":
        return compareValues(left.id, right.id);
      case "prompt-price":
      default:
        return compareValues(left.prompt_price_per_million, right.prompt_price_per_million);
    }
  });

  return limit && Number.isFinite(limit) ? filtered.slice(0, limit) : filtered;
}

export function normalizeEndpoint(endpoint) {
  return {
    ...endpoint,
    prompt_price_per_million: toPerMillion(endpoint.pricing?.prompt),
    completion_price_per_million: toPerMillion(endpoint.pricing?.completion),
    latency_p50: toNumber(endpoint.latency_last_30m?.p50),
    latency_p90: toNumber(endpoint.latency_last_30m?.p90),
    throughput_p50: toNumber(endpoint.throughput_last_30m?.p50),
    throughput_p90: toNumber(endpoint.throughput_last_30m?.p90),
    uptime_last_30m: toNumber(endpoint.uptime_last_30m),
  };
}

export function sortEndpoints(endpoints, sort = "latency") {
  const normalized = endpoints.map(normalizeEndpoint);

  normalized.sort((left, right) => {
    switch (sort) {
      case "throughput":
        return compareValues(left.throughput_p50, right.throughput_p50, "desc");
      case "uptime":
        return compareValues(left.uptime_last_30m, right.uptime_last_30m, "desc");
      case "prompt-price":
        return compareValues(left.prompt_price_per_million, right.prompt_price_per_million);
      case "completion-price":
        return compareValues(left.completion_price_per_million, right.completion_price_per_million);
      case "context":
        return compareValues(left.context_length, right.context_length, "desc");
      case "latency":
      default:
        return compareValues(left.latency_p50, right.latency_p50);
    }
  });

  return normalized;
}
