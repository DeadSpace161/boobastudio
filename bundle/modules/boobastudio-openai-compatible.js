const NAMESPACE = "boobastudio";
const S = { enabled: "providerEnabled", baseUrl: "providerBaseUrl", apiKey: "providerApiKey", model: "providerModel", imageProvider: "imageProvider", replicateToken: "replicateApiToken", replicateModel: "replicateModel", timeout: "providerTimeout", temperature: "providerTemperature", maxTokens: "providerMaxTokens", headers: "providerHeaders" };

const get = (key) => game.settings.get(NAMESPACE, key);
const isEnabled = () => get(S.enabled) === true;
const baseUrl = () => String(get(S.baseUrl) || "https://api.openai.com/v1").trim().replace(/\/+$/, "");

function headers() {
  let custom = {};
  try {
    const parsed = JSON.parse(String(get(S.headers) || "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) custom = parsed;
  } catch {
    console.warn(`${NAMESPACE} | providerHeaders is not valid JSON; ignoring custom headers`);
  }
  const key = String(get(S.apiKey) || game.settings.get(NAMESPACE, "openaiApiKey") || "").trim();
  return { ...custom, ...(key ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json" };
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

async function post(endpoint, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(get(S.timeout)) || 120000));
  try {
    return await fetch(endpoint, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function replicateHeaders() {
  const token = String(get(S.replicateToken) || "").trim();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" };
}

function replicateInput(body) {
  const input = { prompt: String(body.prompt || "") };
  const size = String(body.size || "").match(/^(\d+)x(\d+)$/);
  if (size) {
    input.width = Number(size[1]);
    input.height = Number(size[2]);
  }
  return input;
}

async function routeReplicateImages(body) {
  const model = String(get(S.replicateModel) || "black-forest-labs/flux-schnell").trim();
  const endpoint = `https://api.replicate.com/v1/models/${model}/predictions`;
  const controller = new AbortController();
  const timeout = Math.max(1000, Number(get(S.timeout)) || 120000);
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const started = await fetch(endpoint, { method: "POST", headers: replicateHeaders(), body: JSON.stringify({ input: replicateInput(body) }), signal: controller.signal });
    const prediction = await started.json().catch(() => null);
    if (!started.ok) return new Response(JSON.stringify(prediction || { error: { message: `Replicate request failed (${started.status})` } }), { status: started.status, headers: { "Content-Type": "application/json" } });
    let current = prediction;
    const deadline = Date.now() + timeout;
    while (current?.status && !["succeeded", "failed", "canceled"].includes(current.status) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const statusUrl = current.urls?.get || `https://api.replicate.com/v1/predictions/${current.id}`;
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
  const payload = {
    model: String(get(S.model) || body.model || "gpt-5-mini").trim(),
    messages: messages(body.input),
    temperature: Number(get(S.temperature)),
    max_tokens: Math.max(1, Number(get(S.maxTokens)) || 2048),
  };
  if (!Number.isFinite(payload.temperature)) delete payload.temperature;
  const response = await post(`${baseUrl()}/chat/completions`, payload);
  if (!response.ok) return response;
  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return new Response(JSON.stringify({ error: { message: "Provider response did not contain choices[0].message.content" } }), { status: 502, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ output: [{ role: "assistant", content: [{ type: "output_text", text: content }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function routeImages(body) {
  if (String(get(S.imageProvider) || "openai") === "replicate") return routeReplicateImages(body);
  return post(`${baseUrl()}/images/generations`, { ...body, model: String(get(S.model) || body.model || "gpt-image-1") });
}

async function localQuery(prompt, behavior, callback) {
  if (!isEnabled()) return false;
  try {
    const response = await post(`${baseUrl()}/chat/completions`, {
      model: String(get(S.model) || "gpt-5-mini"),
      messages: [{ role: "user", content: `${String(prompt ?? "").trim()}\n\nGeneration instructions:\n${String(behavior ?? "").trim()}` }],
      temperature: Number(get(S.temperature)),
      max_tokens: Math.max(1, Number(get(S.maxTokens)) || 2048),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      callback?.({ status: "error", errors: [result?.error?.message || `Provider request failed (${response.status})`] });
      return true;
    }
    const content = result?.choices?.[0]?.message?.content;
    callback?.(typeof content === "string" ? { status: "done", result: content } : { status: "error", errors: ["Provider response did not contain choices[0].message.content"] });
  } catch (error) {
    callback?.({ status: "error", errors: [String(error?.message || error)] });
  }
  return true;
}

globalThis.__boobastudioLocalQuery = localQuery;
globalThis.__boobastudioLocalProviderConfigured = () => isEnabled() && Boolean(String(get(S.apiKey) || game.settings.get(NAMESPACE, "openaiApiKey") || "").trim());

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
  const responsesUrl = "https://api.openai.com/v1/responses";
  const imagesUrl = "https://api.openai.com/v1/images/generations";
  globalThis.fetch = async (input, init = {}) => {
    if (!isEnabled()) return originalFetch(input, init);
    const url = typeof input === "string" ? input : input?.url;
    if (url !== responsesUrl && url !== imagesUrl) return originalFetch(input, init);
    let body;
    try { body = JSON.parse(init.body); } catch { return originalFetch(input, init); }
    return url === responsesUrl ? routeResponses(originalFetch, body) : routeImages(body);
  };
  globalThis.__boobastudioOpenAICompatibleInstalled = true;
}

Hooks.once("init", () => {
  game.settings.register(NAMESPACE, S.enabled, { name: "BoobaStudio: Enable OpenAI-compatible provider", hint: "Routes the existing client-only text and image workflows to your configured OpenAI-compatible endpoint.", scope: "client", config: true, type: Boolean, default: false });
  game.settings.register(NAMESPACE, S.baseUrl, { name: "BoobaStudio: Provider base URL", hint: "For example https://api.openai.com/v1, http://localhost:11434/v1, or an OpenRouter-compatible URL.", scope: "client", config: true, type: String, default: "https://api.openai.com/v1" });
  game.settings.register(NAMESPACE, S.apiKey, { name: "BoobaStudio: Provider API key", hint: "Stored in this Foundry client; browser-side keys can be read by other modules.", scope: "client", config: true, type: String, default: "" });
  game.settings.register(NAMESPACE, S.model, { name: "BoobaStudio: Provider model", scope: "client", config: true, type: String, default: "gpt-5-mini" });
  game.settings.register(NAMESPACE, S.imageProvider, { name: "BoobaStudio: Image provider", hint: "Choose OpenAI-compatible Images or Replicate predictions for the existing image workflow.", scope: "client", config: true, type: String, choices: { openai: "OpenAI-compatible", replicate: "Replicate" }, default: "openai" });
  game.settings.register(NAMESPACE, S.replicateToken, { name: "BoobaStudio: Replicate API token", hint: "Client-scoped token used only for direct Replicate image requests.", scope: "client", config: true, type: String, default: "" });
  game.settings.register(NAMESPACE, S.replicateModel, { name: "BoobaStudio: Replicate image model", hint: "Replicate model in owner/name form, for example black-forest-labs/flux-schnell.", scope: "client", config: true, type: String, default: "black-forest-labs/flux-schnell" });
  game.settings.register(NAMESPACE, S.timeout, { name: "BoobaStudio: Provider timeout (ms)", scope: "client", config: true, type: Number, default: 120000, range: { min: 1000, max: 600000, step: 1000 } });
  game.settings.register(NAMESPACE, S.temperature, { name: "BoobaStudio: Provider temperature", scope: "client", config: true, type: Number, default: 0.7, range: { min: 0, max: 2, step: 0.05 } });
  game.settings.register(NAMESPACE, S.maxTokens, { name: "BoobaStudio: Provider maximum tokens", scope: "client", config: true, type: Number, default: 2048, range: { min: 1, max: 32768, step: 1 } });
  game.settings.register(NAMESPACE, S.headers, { name: "BoobaStudio: Provider custom headers (JSON)", hint: "Optional JSON object merged into provider request headers.", scope: "client", config: true, type: String, default: "{}" });
});

Hooks.once("ready", async () => {
  if (isEnabled() && String(get(S.apiKey) || "").trim()) {
    await game.settings.set(NAMESPACE, "openaiApiKey", String(get(S.apiKey)).trim());
    await game.settings.set(NAMESPACE, "clientOnlyMode", true);
  }
  install();
});
