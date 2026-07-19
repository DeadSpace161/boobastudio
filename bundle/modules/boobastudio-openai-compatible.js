const NAMESPACE = "boobastudio";
const S = { enabled: "providerEnabled", baseUrl: "providerBaseUrl", apiKey: "providerApiKey", model: "providerModel", timeout: "providerTimeout", temperature: "providerTemperature", maxTokens: "providerMaxTokens", headers: "providerHeaders" };

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
