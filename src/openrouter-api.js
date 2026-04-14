const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const EU_BASE_URL = "https://eu.openrouter.ai/api/v1";

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function joinUrl(baseUrl, path, query = {}) {
  const url = new URL(`${trimTrailingSlash(baseUrl)}${path}`);
  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }
    url.searchParams.set(key, String(rawValue));
  }
  return url;
}

export function resolveBaseUrl({ baseUrl, region }) {
  if (baseUrl) {
    return trimTrailingSlash(baseUrl);
  }
  if (region === "eu") {
    return EU_BASE_URL;
  }
  return DEFAULT_BASE_URL;
}

export class OpenRouterClient {
  constructor({
    apiKey,
    baseUrl,
    appTitle = "openrouter-cli",
    referer,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new Error("A fetch implementation is required.");
    }

    this.apiKey = apiKey;
    this.baseUrl = resolveBaseUrl({ baseUrl });
    this.appTitle = appTitle;
    this.referer = referer;
    this.fetchImpl = fetchImpl;
  }

  async request(path, { query, requireAuth = false } = {}) {
    if (requireAuth && !this.apiKey) {
      throw new Error("This command requires OPENROUTER_API_KEY or --api-key.");
    }

    const headers = {
      Accept: "application/json",
      "X-OpenRouter-Title": this.appTitle,
    };

    if (this.referer) {
      headers["HTTP-Referer"] = this.referer;
    }

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await this.fetchImpl(joinUrl(this.baseUrl, path, query), {
      method: "GET",
      headers,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        `${response.status} ${response.statusText}`;
      throw new Error(message);
    }

    return payload;
  }

  getModels(query = {}) {
    return this.request("/models", { query });
  }

  getUserModels() {
    return this.request("/models/user", { requireAuth: true });
  }

  getModelEndpoints(modelId) {
    const [author, ...slugParts] = modelId.split("/");
    if (!author || slugParts.length === 0) {
      throw new Error(
        `Model id "${modelId}" must be in "author/slug" format, for example "openai/gpt-4o-mini".`,
      );
    }
    return this.request(`/models/${author}/${slugParts.join("/")}/endpoints`);
  }

  getCurrentKey() {
    return this.request("/key", { requireAuth: true });
  }
}
