const NAMESPACE = "boobastudio";
const S = { enabled: "providerEnabled", protocol: "providerProtocol", baseUrl: "providerBaseUrl", apiKey: "openaiApiKey", model: "providerModel", imageModel: "imageModel", imageProvider: "imageProvider", replicateToken: "replicateApiToken", replicateModel: "replicateModel", replicateBaseUrl: "replicateBaseUrl", timeout: "providerTimeout", temperature: "providerTemperature", maxTokens: "providerMaxTokens", headers: "providerHeaders" };

const get = (key) => game.settings.get(NAMESPACE, key);
const isEnabled = () => get(S.enabled) === true;
const baseUrl = () => String(get(S.baseUrl) || "https://api.openai.com/v1").trim().replace(/\/+$/, "");

const protocol = () => String(get(S.protocol) || "openai").trim().toLowerCase();

function headers(kind = protocol()) {
  let custom = {};
  try {
    const parsed = JSON.parse(String(get(S.headers) || "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) custom = parsed;
  } catch {
    console.warn(`${NAMESPACE} | providerHeaders is not valid JSON; ignoring custom headers`);
  }
  const key = String(get(S.apiKey) || game.settings.get(NAMESPACE, "openaiApiKey") || "").trim();
  const auth = kind === "anthropic" ? (key ? { "x-api-key": key, "anthropic-version": "2023-06-01" } : { "anthropic-version": "2023-06-01" }) : kind === "gemini" ? (key ? { "x-goog-api-key": key } : {}) : (key ? { Authorization: `Bearer ${key}` } : {});
  return { ...custom, ...auth, "Content-Type": "application/json" };
}

function text(content) {
  if (typeof content === "string") return content;
  return Array.isArray(content) ? content.map((part) => typeof part === "string" ? part : String(part?.text ?? "")).join("") : "";
}

function messages(input) {
  return (Array.isArray(input) ? input : []).map((message) => ({
    role: message?.role === "assistant" ? "assistant" : message?.role === "system" ? "system" : "user",
    content: text(message?.content),
  })).filter((message) => message.content);
}

async function post(endpoint, body, fetcher = fetch, kind = protocol()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(get(S.timeout)) || 120000));
  try {
    return await fetcher(endpoint, { method: "POST", headers: headers(kind), body: JSON.stringify(body), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function replicateHeaders() {
  const configured = String(get(S.replicateToken) || "").trim();
  const shared = String(get(S.apiKey) || "").trim();
  const token = configured || (shared.startsWith("r8_") ? shared : "");
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" };
}

function replicateBaseUrl() {
  return String(get(S.replicateBaseUrl) || "https://api.replicate.com/v1").trim().replace(/\/+$/, "");
}

function replicateModel(body) {
  const configured = String(get(S.replicateModel) || "").trim();
  const shared = String(get(S.model) || "").trim();
  const requested = String(body.model || "").trim();
  return (configured && configured !== "black-forest-labs/flux-schnell" ? configured : (requested.includes("/") ? requested : (shared.includes("/") ? shared : configured || "black-forest-labs/flux-schnell"))).trim();
}

function replicateInput(body, model = replicateModel(body)) {
  const input = {};
  const size = String(body.size || "").match(/^(\d+)x(\d+)$/);
  if (size) {
    input.width = Number(size[1]);
    input.height = Number(size[2]);
  }
  const lower = model.toLowerCase();
  const isErase = /(^|\/)(eraser|rembg|removebackground|birefnet)$/.test(lower);
  const isExpand = lower === "bria/expand-image" || lower.endsWith("/flux-fill-pro-outpaint");
  if (isErase) {
    if (body.image !== undefined) input.image = body.image;
    if (lower === "bria/eraser" && body.mask !== undefined) input.mask = body.mask;
    if (lower === "bria/eraser") input.preserve_alpha = body.preserve_alpha ?? true;
    return input;
  }
  input.prompt = String(body.prompt || "");
  if (isExpand) {
    if (body.image !== undefined) input.image = body.image;
    for (const key of ["aspect_ratio", "canvas_size", "original_image_size", "original_image_location", "preserve_alpha", "seed", "negative_prompt", "outpaint"]) {
      if (body[key] !== undefined && body[key] !== null && body[key] !== "") input[key] = body[key];
    }
    return input;
  }
  for (const key of ["image", "mask", "negative_prompt", "strength", "image_prompt_strength", "guidance", "steps", "seed", "width", "height", "aspect_ratio", "output_format"]) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "") input[key] = body[key];
  }
  return input;
}

function providerError(error) {
  const message = String(error?.message || error || "Unknown provider error");
  if (error?.name === "AbortError" || /abort|timeout/i.test(message)) return `Timeout: provider request exceeded the configured timeout (${Number(get(S.timeout)) || 120000} ms)`;
  if (/failed to fetch|network|cors|cross-origin|dns|connection refused/i.test(message)) return `Network/CORS error: ${message}. Confirm the endpoint is reachable from the Foundry browser and permits this origin.`;
  return `Provider error: ${message}`;
}

function providerFailure(error, status = 502) {
  return new Response(JSON.stringify({ error: { message: providerError(error) } }), { status, headers: { "Content-Type": "application/json" } });
}

async function routeReplicateImages(body) {
  const model = replicateModel(body);
  const endpoint = `${replicateBaseUrl()}/models/${model}/predictions`;
  const controller = new AbortController();
  const timeout = Math.max(1000, Number(get(S.timeout)) || 120000);
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const started = await fetch(endpoint, { method: "POST", headers: replicateHeaders(), body: JSON.stringify({ input: replicateInput(body, model) }), signal: controller.signal });
    const prediction = await started.json().catch(() => null);
    if (!started.ok) return new Response(JSON.stringify(prediction || { error: { message: `Replicate request failed (${started.status})` } }), { status: started.status, headers: { "Content-Type": "application/json" } });
    let current = prediction;
    const deadline = Date.now() + timeout;
    while (current?.status && !["succeeded", "failed", "canceled"].includes(current.status) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const statusUrl = current.urls?.get || `${replicateBaseUrl()}/predictions/${current.id}`;
      const status = await fetch(statusUrl, { headers: replicateHeaders(), signal: controller.signal });
      current = await status.json().catch(() => null);
      if (!status.ok) return new Response(JSON.stringify(current || { error: { message: `Replicate status failed (${status.status})` } }), { status: status.status, headers: { "Content-Type": "application/json" } });
    }
    if (current?.status !== "succeeded") return new Response(JSON.stringify({ error: { message: current?.error || `Replicate prediction ended with status ${current?.status || "timeout"}` } }), { status: 502, headers: { "Content-Type": "application/json" } });
    const output = Array.isArray(current.output) ? current.output : [current.output];
    return new Response(JSON.stringify({ data: output.filter(Boolean).map((url) => ({ url: String(url) })) }), { status: 200, headers: { "Content-Type": "application/json" } });
  } finally {
    clearTimeout(timer);
  }
}

async function routeResponses(originalFetch, body) {
  const kind = protocol();
  const model = String(get(S.model) || body.model || "gpt-5-mini").trim();
  const input = messages(body.input);
  const temperature = Number(get(S.temperature));
  const maxTokens = Math.max(1, Number(get(S.maxTokens)) || 2048);
  let endpoint = `${baseUrl()}/chat/completions`;
  let payload = { model, messages: input, temperature, max_tokens: maxTokens };
  if (kind === "anthropic") {
    endpoint = `${baseUrl()}/messages`;
    const system = input.filter((message) => message.role === "system").map((message) => message.content).join("\n");
    payload = { model, messages: input.filter((message) => message.role !== "system"), max_tokens: maxTokens, temperature };
    if (system) payload.system = system;
  } else if (kind === "gemini") {
    endpoint = `${baseUrl()}/models/${encodeURIComponent(model)}:generateContent`;
    payload = { contents: input.filter((message) => message.role !== "system").map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })), generationConfig: { temperature, maxOutputTokens: maxTokens } };
    const system = input.filter((message) => message.role === "system").map((message) => message.content).join("\n");
    if (system) payload.systemInstruction = { parts: [{ text: system }] };
  }
  if (!Number.isFinite(payload.temperature)) delete payload.temperature;
  if (kind === "gemini" && !Number.isFinite(temperature)) delete payload.generationConfig.temperature;
  const response = await post(endpoint, payload, originalFetch, kind);
  if (!response.ok) return response;
  const result = await response.json();
  const content = kind === "anthropic" ? text(result?.content?.filter?.((part) => part?.type === "text").map((part) => part.text)) : kind === "gemini" ? text(result?.candidates?.[0]?.content?.parts?.map((part) => part.text)) : text(result?.choices?.[0]?.message?.content);
  if (!content) return new Response(JSON.stringify({ error: { message: "Provider response did not contain choices[0].message.content" } }), { status: 502, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ output: [{ role: "assistant", content: [{ type: "output_text", text: content }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function routeImages(body, originalFetch = globalThis.__boobastudioOriginalFetch || fetch) {
  const sharedKey = String(get(S.apiKey) || "").trim();
  if (String(get(S.imageProvider) || "openai") === "replicate" || sharedKey.startsWith("r8_")) return routeReplicateImages(body);
  return post(`${baseUrl()}/images/generations`, { ...body, model: String(get(S.imageModel) || body.model || "gpt-image-1").trim() }, originalFetch);
}

async function localQuery(prompt, behavior, callback) {
  if (!isEnabled()) return false;
  try {
    const response = await routeResponses(globalThis.__boobastudioOriginalFetch || fetch, { model: String(get(S.model) || "gpt-5-mini"), input: [{ role: "user", content: [{ type: "input_text", text: `${String(prompt ?? "").trim()}\n\nGeneration instructions:\n${String(behavior ?? "").trim()}` }] }] });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const message = result?.error?.message || `Provider request failed (${response.status})`;
      callback?.({ status: "error", errors: [providerError({ message })] });
      return true;
    }
    const content = text(result?.output?.[0]?.content?.map?.((part) => part.text));
    callback?.(content ? { status: "done", result: content } : { status: "error", errors: ["Provider response did not contain choices[0].message.content"] });
  } catch (error) {
    callback?.({ status: "error", errors: [providerError(error)] });
  }
  return true;
}

globalThis.__boobastudioLocalQuery = localQuery;
globalThis.__boobastudioLocalProviderConfigured = () => isEnabled() && Boolean(baseUrl());

Hooks.once("ready", () => {
  document.addEventListener("click", (event) => {
    if (!event.target.closest?.('[data-action="openModuleSettings"]')) return;
    event.preventDefault();
    game.settings.sheet?.render(true);
  }, { capture: true });
});

function install() {
  if (globalThis.__boobastudioOpenAICompatibleInstalled) return;
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.__boobastudioOriginalFetch = originalFetch;
  const responsesUrl = "https://api.openai.com/v1/responses";
  const imagesUrl = "https://api.openai.com/v1/images/generations";
  globalThis.fetch = async (input, init = {}) => {
    if (!isEnabled()) return originalFetch(input, init);
    const url = typeof input === "string" ? input : input?.url;
    if (url !== responsesUrl && url !== imagesUrl) return originalFetch(input, init);
    let body;
    try { body = JSON.parse(init.body); } catch { return originalFetch(input, init); }
    try {
      return url === responsesUrl ? await routeResponses(originalFetch, body) : await routeImages(body, originalFetch);
    } catch (error) {
      return providerFailure(error);
    }
  };
  globalThis.__boobastudioOpenAICompatibleInstalled = true;
}

Hooks.once("init", () => {
  game.settings.register(NAMESPACE, S.enabled, { name: "BoobaStudio: Enable OpenAI-compatible provider", hint: "Routes the existing client-only text and image workflows to your configured OpenAI-compatible endpoint.", scope: "client", config: true, type: Boolean, default: false });
  game.settings.register(NAMESPACE, S.protocol, { name: "BoobaStudio: Text provider protocol", hint: "Use OpenAI-compatible for OpenAI, OpenRouter, Ollama, and LM Studio; select Anthropic or Gemini for their native APIs.", scope: "client", config: true, type: String, default: "openai", choices: { openai: "OpenAI-compatible", anthropic: "Anthropic", gemini: "Google Gemini" } });
  game.settings.register(NAMESPACE, S.baseUrl, { name: "BoobaStudio: Provider base URL", hint: "For example https://api.openai.com/v1, http://localhost:11434/v1, or an OpenRouter-compatible URL.", scope: "client", config: true, type: String, default: "https://api.openai.com/v1" });
  game.settings.register(NAMESPACE, S.model, { name: "BoobaStudio: Provider model", scope: "client", config: true, type: String, default: "gpt-5-mini" });
  game.settings.register(NAMESPACE, S.imageModel, { name: "BoobaStudio: Image model", hint: "Model used by OpenAI-compatible image endpoints. Replicate uses its separate image model setting.", scope: "client", config: true, type: String, default: "gpt-image-1" });
  game.settings.register(NAMESPACE, S.imageProvider, { name: "BoobaStudio: Image provider", hint: "Enter openai for OpenAI-compatible Images or replicate for Replicate predictions.", scope: "client", config: true, type: String, default: "openai" });
  game.settings.register(NAMESPACE, S.replicateToken, { name: "BoobaStudio: Replicate API token", hint: "Client-scoped token used only for direct Replicate image requests.", scope: "client", config: true, type: String, default: "" });
  game.settings.register(NAMESPACE, S.replicateModel, { name: "BoobaStudio: Replicate image model", hint: "Replicate model in owner/name form, for example black-forest-labs/flux-schnell.", scope: "client", config: true, type: String, default: "black-forest-labs/flux-schnell" });
  game.settings.register(NAMESPACE, S.replicateBaseUrl, { name: "BoobaStudio: Replicate API base URL", hint: "Default: https://api.replicate.com/v1. Use a compatible CORS-enabled proxy or local endpoint if the provider blocks browser requests.", scope: "client", config: true, type: String, default: "https://api.replicate.com/v1" });
  game.settings.register(NAMESPACE, S.timeout, { name: "BoobaStudio: Provider timeout (ms)", scope: "client", config: true, type: Number, default: 120000, range: { min: 1000, max: 600000, step: 1000 } });
  game.settings.register(NAMESPACE, S.temperature, { name: "BoobaStudio: Provider temperature", scope: "client", config: true, type: Number, default: 0.7, range: { min: 0, max: 2, step: 0.05 } });
  game.settings.register(NAMESPACE, S.maxTokens, { name: "BoobaStudio: Provider maximum tokens", scope: "client", config: true, type: Number, default: 2048, range: { min: 1, max: 32768, step: 1 } });
  game.settings.register(NAMESPACE, S.headers, { name: "BoobaStudio: Provider custom headers (JSON)", hint: "Optional JSON object merged into provider request headers.", scope: "client", config: true, type: String, default: "{}" });
});

Hooks.once("ready", async () => {
  if (!game.settings.settings?.has?.(`${NAMESPACE}.${S.protocol}`)) game.settings.register(NAMESPACE, S.protocol, { name: "BoobaStudio: Text provider protocol", hint: "Use OpenAI-compatible for OpenAI, OpenRouter, Ollama, and LM Studio; select Anthropic or Gemini for their native APIs.", scope: "client", config: true, type: String, default: "openai", choices: { openai: "OpenAI-compatible", anthropic: "Anthropic", gemini: "Google Gemini" } });
  if (!game.settings.settings?.has?.(`${NAMESPACE}.${S.imageProvider}`)) {
    game.settings.register(NAMESPACE, S.imageProvider, { name: "BoobaStudio: Image provider", hint: "Enter openai for OpenAI-compatible Images or replicate for Replicate predictions.", scope: "client", config: true, type: String, default: "openai" });
    game.settings.register(NAMESPACE, S.replicateToken, { name: "BoobaStudio: Replicate API token", hint: "Client-scoped token used only for direct Replicate image requests.", scope: "client", config: true, type: String, default: "" });
    game.settings.register(NAMESPACE, S.replicateModel, { name: "BoobaStudio: Replicate image model", hint: "Replicate model in owner/name form, for example black-forest-labs/flux-schnell.", scope: "client", config: true, type: String, default: "black-forest-labs/flux-schnell" });
    game.settings.register(NAMESPACE, S.replicateBaseUrl, { name: "BoobaStudio: Replicate API base URL", hint: "Default: https://api.replicate.com/v1. Use a compatible CORS-enabled proxy or local endpoint if the provider blocks browser requests.", scope: "client", config: true, type: String, default: "https://api.replicate.com/v1" });
  }
  if (isEnabled() && baseUrl()) {
    await game.settings.set(NAMESPACE, "clientOnlyMode", true);
  }
  install();
});
