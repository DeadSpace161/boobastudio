const NAMESPACE = "boobastudio";
const S = { enabled: "providerEnabled", protocol: "providerProtocol", baseUrl: "providerBaseUrl", apiKey: "openaiApiKey", model: "providerModel", jsonMode: "providerJsonMode", localVectorContext: "localVectorContext", imageModel: "imageModel", imageProvider: "imageProvider", ttsProvider: "ttsProvider", ttsApiKey: "ttsApiKey", ttsModel: "ttsModel", ttsVoice: "ttsVoice", ttsBaseUrl: "ttsBaseUrl", elevenlabsApiKey: "elevenlabsApiKey", elevenlabsModel: "elevenlabsModel", elevenlabsBaseUrl: "elevenlabsBaseUrl", musicModel: "musicModel", musicBaseUrl: "musicBaseUrl", musicInput: "musicInput", replicateToken: "replicateApiToken", replicateModel: "replicateModel", replicateBaseUrl: "replicateBaseUrl", stabilityApiKey: "stabilityApiKey", stabilityModel: "stabilityModel", stabilityBaseUrl: "stabilityBaseUrl", comfyuiBaseUrl: "comfyuiBaseUrl", comfyuiWorkflow: "comfyuiWorkflow", timeout: "providerTimeout", temperature: "providerTemperature", maxTokens: "providerMaxTokens", headers: "providerHeaders" };

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

function comfyuiBaseUrl() {
  return String(get(S.comfyuiBaseUrl) || "http://127.0.0.1:8188").trim().replace(/\/+$/, "");
}

function replacePrompt(value, prompt) {
  if (typeof value === "string") return value.replaceAll("{{prompt}}", String(prompt || ""));
  if (Array.isArray(value)) return value.map((item) => replacePrompt(item, prompt));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replacePrompt(item, prompt)]));
  return value;
}

async function routeComfyUIImages(body) {
  let workflow;
  try { workflow = JSON.parse(String(get(S.comfyuiWorkflow) || "{}")); } catch { return new Response(JSON.stringify({ error: { message: "ComfyUI workflow is not valid JSON" } }), { status: 400, headers: { "Content-Type": "application/json" } }); }
  const controller = new AbortController();
  const timeout = Math.max(1000, Number(get(S.timeout)) || 120000);
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const started = await fetch(`${comfyuiBaseUrl()}/prompt`, { method: "POST", headers: headers("openai"), body: JSON.stringify({ prompt: replacePrompt(workflow, body.prompt) }), signal: controller.signal });
    const accepted = await started.json().catch(() => null);
    if (!started.ok || !accepted?.prompt_id) return new Response(JSON.stringify(accepted || { error: { message: `ComfyUI request failed (${started.status})` } }), { status: started.ok ? 502 : started.status, headers: { "Content-Type": "application/json" } });
    const deadline = Date.now() + timeout;
    let history = null;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response = await fetch(`${comfyuiBaseUrl()}/history/${encodeURIComponent(accepted.prompt_id)}`, { headers: headers("openai"), signal: controller.signal });
      history = await response.json().catch(() => null);
      if (!response.ok) return new Response(JSON.stringify(history || { error: { message: `ComfyUI history request failed (${response.status})` } }), { status: response.status, headers: { "Content-Type": "application/json" } });
      if (history?.[accepted.prompt_id]?.outputs) break;
    }
    const outputs = history?.[accepted.prompt_id]?.outputs || {};
    const images = Object.values(outputs).flatMap((node) => node?.images || []).filter((image) => image?.filename).map((image) => `${comfyuiBaseUrl()}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder || "")}&type=${encodeURIComponent(image.type || "output")}`);
    if (!images.length) return new Response(JSON.stringify({ error: { message: "ComfyUI timed out or returned no images" } }), { status: 502, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ data: images.map((url) => ({ url })) }), { status: 200, headers: { "Content-Type": "application/json" } });
  } finally { clearTimeout(timer); }
}

async function routeStabilityImages(body) {
  const key = String(get(S.stabilityApiKey) || get(S.apiKey) || "").trim();
  const endpoint = `${String(get(S.stabilityBaseUrl) || "https://api.stability.ai/v2beta/stable-image/generate").trim().replace(/\/+$/, "")}/${String(get(S.stabilityModel) || "core").trim()}`;
  const form = new FormData();
  form.append("prompt", String(body.prompt || ""));
  form.append("output_format", "png");
  if (body.negative_prompt) form.append("negative_prompt", String(body.negative_prompt));
  const size = String(body.size || "").match(/^(\d+)x(\d+)$/);
  if (size) form.append("aspect_ratio", `${size[1]}:${size[2]}`);
  const response = await fetch(endpoint, { method: "POST", headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), Accept: "application/json" }, body: form });
  if (!response.ok) return providerResponse(response);
  const type = response.headers.get("content-type") || "";
  if (type.includes("json")) {
    const result = await response.json();
    const encoded = result?.image || result?.base64 || result?.data?.[0]?.b64_json;
    if (!encoded) return new Response(JSON.stringify({ error: { message: "Stability response did not contain image data" } }), { status: 502, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ data: [{ b64_json: String(encoded).replace(/^data:image\/\w+;base64,/, "") }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const encoded = await arrayBufferToBase64(await response.arrayBuffer());
  return new Response(JSON.stringify({ data: [{ b64_json: encoded }] }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function routeTTS(body) {
  let fields = body?.prompt;
  try { fields = typeof fields === "string" ? JSON.parse(fields) : fields || {}; } catch { fields = {}; }
  const textInput = String(fields.speechcontent || fields.text || "").trim();
  const kind = String(get(S.ttsProvider) || "openai").toLowerCase();
  const key = String(get(kind === "elevenlabs" ? S.elevenlabsApiKey : S.ttsApiKey) || get(S.apiKey) || "").trim();
  let endpoint, requestBody, requestHeaders;
  if (kind === "elevenlabs") {
    const voice = String(fields.voice_id || get(S.ttsVoice) || "21m00Tcm4TlvDq8ikWAM");
    endpoint = `${String(get(S.elevenlabsBaseUrl) || "https://api.elevenlabs.io/v1").trim().replace(/\/+$/, "")}/text-to-speech/${encodeURIComponent(voice)}`;
    requestBody = { text: textInput, model_id: String(fields.model || get(S.elevenlabsModel) || "eleven_multilingual_v2"), voice_settings: { stability: Number(fields.stability ?? 0.5), similarity_boost: Number(fields.similarity_boost ?? 0.75) } };
    requestHeaders = { ...(key ? { "xi-api-key": key } : {}), "Content-Type": "application/json", Accept: "audio/mpeg" };
  } else {
    endpoint = `${String(get(S.ttsBaseUrl) || "https://api.openai.com/v1").trim().replace(/\/+$/, "")}/audio/speech`;
    requestBody = { model: String(fields.model || get(S.ttsModel) || "tts-1"), voice: String(fields.voice || get(S.ttsVoice) || "onyx"), input: textInput, response_format: "mp3", speed: Number(fields.speed || 1) };
    requestHeaders = { ...(key ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Accept: "audio/mpeg" };
  }
  const response = await fetch(endpoint, { method: "POST", headers: requestHeaders, body: JSON.stringify(requestBody) });
  if (!response.ok) return providerResponse(response);
  const type = response.headers.get("content-type") || "audio/mpeg";
  const encoded = type.includes("json") ? String((await response.json())?.audio || "") : await arrayBufferToBase64(await response.arrayBuffer());
  if (!encoded) return new Response(JSON.stringify({ success: false, error: { message: "TTS response did not contain audio data" } }), { status: 502, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ success: true, result: `data:audio/mpeg;base64,${encoded.replace(/^data:audio\/\w+;base64,/, "")}` }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function localGenerateTTS(textInput, behavior, model, callback) {
  if (!isEnabled()) return false;
  try {
    let fields = {};
    try { fields = typeof behavior === "string" ? JSON.parse(behavior) : behavior || {}; } catch { fields = {}; }
    const response = await routeTTS({ prompt: JSON.stringify({ ...fields, model: fields.model || model, speechcontent: String(textInput || "") }) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.success === false || !result?.result) {
      callback?.({ status: "error", errors: [providerError({ message: result?.error?.message || `TTS request failed (${response.status})` })] });
      return true;
    }
    callback?.({ status: "done", result: String(result.result) });
  } catch (error) {
    callback?.({ status: "error", errors: [providerError(error)] });
  }
  return true;
}

globalThis.__boobastudioLocalGenerateTTS = localGenerateTTS;

async function localGenerateSong(input, behavior, callback, options = {}) {
  if (!isEnabled()) return false;
  const requestedModel = String(options?.model || "").trim();
  const model = String(get(S.musicModel) || (requestedModel.includes("/") ? requestedModel : "")).trim();
  if (!model) {
    callback?.({ status: "error", errors: ["Configure a Replicate music model before generating a song."] });
    return true;
  }
  const controller = new AbortController();
  const timeout = Math.max(1000, Number(get(S.timeout)) || 120000);
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const base = String(get(S.musicBaseUrl) || "https://api.replicate.com/v1").trim().replace(/\/+$/, "");
    const endpoint = `${base}/models/${model}/predictions`;
    const started = await fetch(endpoint, { method: "POST", headers: replicateHeaders(), body: JSON.stringify({ input: musicInput(input) }), signal: controller.signal });
    let current = await started.json().catch(() => null);
    if (!started.ok) {
      callback?.({ status: "error", errors: [providerStatusMessage(started.status, String(current?.detail || current?.error || "").trim())] });
      return true;
    }
    const deadline = Date.now() + timeout;
    while (current?.status && !["succeeded", "failed", "canceled"].includes(current.status) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const statusUrl = current.urls?.get || `${base}/predictions/${current.id}`;
      const status = await fetch(statusUrl, { headers: replicateHeaders(), signal: controller.signal });
      current = await status.json().catch(() => null);
      if (!status.ok) {
        callback?.({ status: "error", errors: [providerStatusMessage(status.status)] });
        return true;
      }
    }
    if (current?.status !== "succeeded") {
      callback?.({ status: "error", errors: [String(current?.error || `Music prediction ended with status ${current?.status || "timeout"}`)] });
      return true;
    }
    const output = Array.isArray(current.output) ? current.output[0] : current.output;
    const audioUrl = typeof output === "string" ? output : output?.audio_url || output?.url || output?.audio || output?.output;
    if (!audioUrl || typeof audioUrl !== "string") {
      callback?.({ status: "error", errors: ["Music provider response did not contain an audio URL."] });
      return true;
    }
    const id = current.id || globalThis.crypto?.randomUUID?.() || `boobastudio-song-${Date.now()}`;
    callback?.({ status: "done", result: JSON.stringify([{ id, title: String(input?.songtitle || "BoobaStudio Song"), lyric: String(input?.lyrics || ""), audio_url: audioUrl, image_url: "" }]) });
  } catch (error) {
    callback?.({ status: "error", errors: [providerError(error)] });
  } finally {
    clearTimeout(timer);
  }
  return true;
}

globalThis.__boobastudioLocalGenerateSong = localGenerateSong;

async function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
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

function musicInput(data) {
  const fields = data && typeof data === "object" ? data : {};
  const prompt = [fields.style, fields.lyrics, fields.songtitle].map((value) => String(value || "").trim()).filter(Boolean).join("\n");
  const defaults = { prompt, lyrics: String(fields.lyrics || ""), title: String(fields.songtitle || "") };
  if (fields.length_seconds !== undefined && fields.length_seconds !== "") defaults.duration = Number(fields.length_seconds);
  let configured = {};
  try { configured = JSON.parse(String(get(S.musicInput) || "{}")); } catch { configured = {}; }
  const replace = (value) => {
    if (typeof value === "string") return value.replaceAll("{{prompt}}", prompt).replaceAll("{{lyrics}}", defaults.lyrics).replaceAll("{{title}}", defaults.title).replaceAll("{{style}}", String(fields.style || ""));
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    return value;
  };
  return { ...defaults, ...replace(configured) };
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

function providerStatusMessage(status, detail = "") {
  const suffix = detail ? `: ${detail}` : "";
  if (status === 401) return `Invalid API key or authentication failed${suffix}`;
  if (status === 403) return `Provider access denied${suffix}`;
  if (status === 408 || status === 504) return `Provider timeout${suffix}`;
  if (status === 429) return `Provider rate limit exceeded${suffix}`;
  return `Provider returned HTTP ${status}${suffix}`;
}

async function providerResponse(response) {
  if (response.ok) return response;
  let detail = "";
  try {
    const payload = await response.clone().json();
    detail = String(payload?.error?.message || payload?.message || payload?.detail || "").trim();
  } catch {
    try { detail = (await response.clone().text()).trim().slice(0, 300); } catch { /* ignore unreadable error bodies */ }
  }
  return new Response(JSON.stringify({ error: { message: providerStatusMessage(response.status, detail) } }), { status: response.status, headers: { "Content-Type": "application/json" } });
}

function localGalleryStorageKey() {
  return `${NAMESPACE}-local-gallery-${globalThis.game?.world?.id || "world"}`;
}

function readLocalGallery() {
  try {
    const value = globalThis.localStorage?.getItem(localGalleryStorageKey());
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeLocalGallery(entries) {
  try { globalThis.localStorage?.setItem(localGalleryStorageKey(), JSON.stringify(entries.slice(0, 50))); } catch { /* quota or unavailable storage */ }
}

async function rememberLocalGallery(body, response) {
  if (!isEnabled() || !response.ok || !globalThis.localStorage) return response;
  try {
    const payload = await response.clone().json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const entries = readLocalGallery();
    for (const item of items) {
      const encoded = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : String(item?.url || "");
      if (!encoded) continue;
      entries.unshift({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        attributes: { result: encoded, thumbnail: encoded, prompt: String(body?.prompt || ""), model: String(body?.model || get(S.imageModel) || ""), created_at: new Date().toISOString() },
      });
    }
    writeLocalGallery(entries);
  } catch { /* preserve the provider response if local indexing is unavailable */ }
  return response;
}

async function localGalleryPage(page, callback, filters = {}) {
  if (!isEnabled()) return false;
  let entries = readLocalGallery();
  const search = String(filters?.search || "").trim().toLowerCase();
  if (search) entries = entries.filter((entry) => String(entry.attributes?.prompt || "").toLowerCase().includes(search));
  const pageSize = 20;
  const pageNumber = Math.max(1, Number(page) || 1);
  callback?.({ data: entries.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), meta: { total: entries.length, page: pageNumber, per_page: pageSize } }, {});
  return true;
}

async function localGalleryDelete(id, callback) {
  if (!isEnabled()) return false;
  writeLocalGallery(readLocalGallery().filter((entry) => entry.id !== id));
  callback?.({ data: { attributes: { status: "success" } } });
  return true;
}

async function localGallerySharingUnavailable(callback) {
  if (!isEnabled()) return false;
  callback?.({ status: "error", errors: ["Public gallery sharing is unavailable in local mode."] });
  return true;
}

globalThis.__boobastudioLocalGalleryPage = localGalleryPage;
globalThis.__boobastudioLocalGalleryDelete = localGalleryDelete;
globalThis.__boobastudioLocalGalleryShare = localGallerySharingUnavailable;
globalThis.__boobastudioLocalGalleryTogglePublic = localGallerySharingUnavailable;

// Keep the existing vector-store UI usable without Cibola's hosted index.
// This is deliberately a browser-local document library, not a new database
// or service. The stored text is available for future local retrieval work;
// binary documents retain metadata only when browser storage would be too large.
function localVectorStorageKey() {
  return `${NAMESPACE}-local-vectors-${globalThis.game?.world?.id || "world"}`;
}

function readLocalVectors() {
  try {
    const value = globalThis.localStorage?.getItem(localVectorStorageKey());
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeLocalVectors(entries) {
  try { globalThis.localStorage?.setItem(localVectorStorageKey(), JSON.stringify(entries.slice(0, 100))); } catch { /* quota or unavailable storage */ }
}

function localVectorPayload() {
  const gameId = String(globalThis.game?.system?.id || "world");
  const gameTitle = String(globalThis.game?.system?.title || gameId);
  const files = readLocalVectors();
  return {
    data: [{ id: `local-store-${gameId}`, relationships: { gamesystem: { data: { id: gameId } }, vector_store_files: { data: files.map((file) => ({ id: file.id })) } } }],
    included: [
      { type: "gamesystem", id: gameId, attributes: { title: gameTitle } },
      ...files.map((file) => ({ type: "vector_store_file", id: file.id, attributes: { uploaded_file_name: file.name, status: file.status, usage_bytes: file.size, local: true } })),
    ],
  };
}

async function localVectorize(formData, callback, progress) {
  if (!isEnabled()) return false;
  const file = formData?.get?.("file_upload");
  if (!file?.name) { callback?.(false); return true; }
  const entry = { id: `local-vector-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: String(file.name), size: Number(file.size) || 0, status: "completed", created_at: new Date().toISOString() };
  if (typeof file.text === "function" && entry.size <= 1024 * 1024) {
    try { entry.text = await file.text(); } catch { /* retain metadata when text extraction is unavailable */ }
  }
  const entries = readLocalVectors().filter((item) => item.name !== entry.name);
  entries.unshift(entry);
  writeLocalVectors(entries);
  progress?.(100);
  callback?.({ status: "done", data: { id: entry.id } });
  return true;
}

async function localVectorList(callback) {
  if (!isEnabled()) return false;
  callback?.(localVectorPayload());
  return true;
}

async function localVectorDelete(id, callback) {
  if (!isEnabled()) return false;
  writeLocalVectors(readLocalVectors().filter((entry) => entry.id !== id));
  callback?.({ status: "done" });
  return true;
}

globalThis.__boobastudioLocalVectorize = localVectorize;
globalThis.__boobastudioLocalVectorList = localVectorList;
globalThis.__boobastudioLocalVectorDelete = localVectorDelete;

function withLocalVectorContext(input) {
  if (!isEnabled() || get(S.localVectorContext) === false || !Array.isArray(input)) return input;
  const userIndex = input.map((message, index) => ({ message, index })).reverse().find(({ message }) => message.role === "user" && message.content)?.index;
  if (userIndex == null) return input;
  const query = String(input[userIndex].content).toLowerCase();
  const terms = new Set(query.match(/[a-z0-9]{4,}/g) || []);
  if (!terms.size) return input;
  const matches = readLocalVectors().map((entry) => {
    const content = String(entry.text || "");
    const entryTerms = new Set(content.toLowerCase().match(/[a-z0-9]{4,}/g) || []);
    const score = [...terms].reduce((total, term) => total + (entryTerms.has(term) ? 1 : 0), 0);
    return { entry, score };
  }).filter((item) => item.score > 0 && item.entry.text).sort((left, right) => right.score - left.score).slice(0, 3);
  if (!matches.length) return input;
  const context = matches.map(({ entry }) => `### ${entry.name}\n${String(entry.text).slice(0, 2400)}`).join("\n\n");
  return input.map((message, index) => index === userIndex ? { ...message, content: `${message.content}\n\nRelevant local library context (use only when helpful):\n${context}` } : message);
}

globalThis.__boobastudioLocalVectorContext = withLocalVectorContext;

async function routeReplicateImages(body) {
  const model = replicateModel(body);
  const endpoint = `${replicateBaseUrl()}/models/${model}/predictions`;
  const controller = new AbortController();
  const timeout = Math.max(1000, Number(get(S.timeout)) || 120000);
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const started = await fetch(endpoint, { method: "POST", headers: replicateHeaders(), body: JSON.stringify({ input: replicateInput(body, model) }), signal: controller.signal });
    const prediction = await started.json().catch(() => null);
    if (!started.ok) {
      const detail = String(prediction?.error?.message || prediction?.error || prediction?.detail || "").trim();
      return new Response(JSON.stringify({ error: { message: providerStatusMessage(started.status, detail) } }), { status: started.status, headers: { "Content-Type": "application/json" } });
    }
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
  const input = withLocalVectorContext(messages(body.input));
  const temperature = Number(get(S.temperature));
  const maxTokens = Math.max(1, Number(get(S.maxTokens)) || 2048);
  let endpoint = `${baseUrl()}/chat/completions`;
  let payload = { model, messages: input, temperature, max_tokens: maxTokens };
  if (kind === "openai" && get(S.jsonMode) === true && body.jsonMode !== false) payload.response_format = { type: "json_object" };
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
  if (!response.ok) return providerResponse(response);
  const result = await response.json();
  const content = kind === "anthropic" ? text(result?.content?.filter?.((part) => part?.type === "text").map((part) => part.text)) : kind === "gemini" ? text(result?.candidates?.[0]?.content?.parts?.map((part) => part.text)) : text(result?.choices?.[0]?.message?.content);
  if (!content) return new Response(JSON.stringify({ error: { message: "Provider response did not contain choices[0].message.content" } }), { status: 502, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ output: [{ role: "assistant", content: [{ type: "output_text", text: content }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function localDescribe(image, callback) {
  if (!isEnabled()) return false;
  try {
    if (protocol() !== "openai") {
      callback?.({ status: "error", errors: ["Image description currently requires an OpenAI-compatible provider."] });
      return true;
    }
    const response = await post(`${baseUrl()}/chat/completions`, {
      model: String(get(S.model) || "gpt-4o-mini"),
      messages: [{ role: "user", content: [
        { type: "text", text: "Describe this image for a tabletop roleplaying game. Return only a concise, useful description of the visible subject, setting, composition, and notable details." },
        { type: "image_url", image_url: { url: String(image?.image || "") } },
      ] }],
      max_tokens: Math.max(1, Number(get(S.maxTokens)) || 1024),
    }, globalThis.__boobastudioOriginalFetch || fetch, "openai");
    if (!response.ok) {
      const result = await response.clone().json().catch(() => null);
      callback?.({ status: "error", errors: [providerError({ message: result?.error?.message || `Provider request failed (${response.status})` })] });
      return true;
    }
    const result = await response.json();
    const content = text(result?.choices?.[0]?.message?.content);
    callback?.(content ? { status: "done", result: content } : { status: "error", errors: ["Provider response did not contain an image description."] });
  } catch (error) {
    callback?.({ status: "error", errors: [providerError(error)] });
  }
  return true;
}

globalThis.__boobastudioLocalDescribe = localDescribe;

async function localBuildPrompts(input, callback) {
  if (!isEnabled()) return false;
  const command = String(input?.command || "").trim();
  const amount = Math.min(20, Math.max(1, Number.parseInt(input?.amount, 10) || 1));
  if (!command) {
    callback?.({ status: "error", errors: ["A prompt-building command is required."] });
    return true;
  }
  await localQuery(command, `Generate exactly ${amount} distinct image prompts. Return only a valid JSON array of strings, with no markdown fences or explanation.`, (result) => {
    if (result?.status !== "done") {
      callback?.(result);
      return;
    }
    try {
      const parsed = JSON.parse(String(result.result).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
      if (!Array.isArray(parsed) || parsed.some((prompt) => typeof prompt !== "string")) throw new Error("not an array of strings");
      callback?.({ status: "done", result: JSON.stringify(parsed.slice(0, amount)) });
    } catch {
      callback?.({ status: "error", errors: ["Provider returned invalid prompt-builder JSON."] });
    }
  }, { jsonMode: false });
  return true;
}

globalThis.__boobastudioLocalBuildPrompts = localBuildPrompts;

async function routeImages(body, originalFetch = globalThis.__boobastudioOriginalFetch || fetch) {
  const sharedKey = String(get(S.apiKey) || "").trim();
  let response;
  if (String(get(S.imageProvider) || "openai") === "stability") response = await routeStabilityImages(body);
  else if (String(get(S.imageProvider) || "openai") === "comfyui") response = await routeComfyUIImages(body);
  else if (String(get(S.imageProvider) || "openai") === "replicate" || sharedKey.startsWith("r8_")) response = await routeReplicateImages(body);
  else response = await providerResponse(await post(`${baseUrl()}/images/generations`, { ...body, model: String(get(S.imageModel) || body.model || "gpt-image-1").trim() }, originalFetch));
  return rememberLocalGallery(body, response);
}

async function localQuery(prompt, behavior, callback, options = {}) {
  if (!isEnabled()) return false;
  try {
    const response = await routeResponses(globalThis.__boobastudioOriginalFetch || fetch, { model: String(get(S.model) || "gpt-5-mini"), input: [{ role: "user", content: [{ type: "input_text", text: `${String(prompt ?? "").trim()}\n\nGeneration instructions:\n${String(behavior ?? "").trim()}` }] }], ...(options.jsonMode === false ? { jsonMode: false } : {}) });
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
globalThis.__boobastudioLocalEnhance = localQuery;
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
    if (url !== responsesUrl && url !== imagesUrl && !String(url || "").replace(/\/+$/, "").endsWith("/tts")) return originalFetch(input, init);
    let body;
    try { body = JSON.parse(init.body); } catch { return originalFetch(input, init); }
    try {
      return url === responsesUrl ? await routeResponses(originalFetch, body) : url === imagesUrl ? await routeImages(body, originalFetch) : await routeTTS(body);
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
  game.settings.register(NAMESPACE, S.jsonMode, { name: "BoobaStudio: JSON response mode", hint: "Request JSON object responses from OpenAI-compatible text providers when supported.", scope: "client", config: true, type: Boolean, default: false });
  game.settings.register(NAMESPACE, S.localVectorContext, { name: "BoobaStudio: Include local library context", hint: "Add relevant text from browser-local vector files to local provider prompts.", scope: "client", config: true, type: Boolean, default: true });
  game.settings.register(NAMESPACE, S.imageModel, { name: "BoobaStudio: Image model", hint: "Model used by OpenAI-compatible image endpoints. Replicate uses its separate image model setting.", scope: "client", config: true, type: String, default: "gpt-image-1" });
  game.settings.register(NAMESPACE, S.imageProvider, { name: "BoobaStudio: Image provider", hint: "Enter openai for OpenAI-compatible Images, replicate for Replicate predictions, stability for Stability AI, or comfyui for a local ComfyUI server.", scope: "client", config: true, type: String, default: "openai", choices: { openai: "OpenAI-compatible", replicate: "Replicate", stability: "Stability AI", comfyui: "ComfyUI" } });
  game.settings.register(NAMESPACE, S.ttsProvider, { name: "BoobaStudio: TTS provider", hint: "Use OpenAI or ElevenLabs for the existing narration and audio workflow.", scope: "client", config: true, type: String, default: "openai", choices: { openai: "OpenAI", elevenlabs: "ElevenLabs" } });
  game.settings.register(NAMESPACE, S.ttsApiKey, { name: "BoobaStudio: TTS API key", hint: "Client-scoped OpenAI TTS key; falls back to the shared OpenAI-compatible key.", scope: "client", config: true, type: String, default: "" });
  game.settings.register(NAMESPACE, S.ttsModel, { name: "BoobaStudio: OpenAI TTS model", scope: "client", config: true, type: String, default: "tts-1" });
  game.settings.register(NAMESPACE, S.ttsVoice, { name: "BoobaStudio: TTS voice", scope: "client", config: true, type: String, default: "onyx" });
  game.settings.register(NAMESPACE, S.ttsBaseUrl, { name: "BoobaStudio: OpenAI TTS base URL", hint: "Default: https://api.openai.com/v1.", scope: "client", config: true, type: String, default: "https://api.openai.com/v1" });
  game.settings.register(NAMESPACE, S.elevenlabsApiKey, { name: "BoobaStudio: ElevenLabs API key", scope: "client", config: true, type: String, default: "" });
  game.settings.register(NAMESPACE, S.elevenlabsModel, { name: "BoobaStudio: ElevenLabs model", scope: "client", config: true, type: String, default: "eleven_multilingual_v2" });
  game.settings.register(NAMESPACE, S.elevenlabsBaseUrl, { name: "BoobaStudio: ElevenLabs base URL", hint: "Default: https://api.elevenlabs.io/v1.", scope: "client", config: true, type: String, default: "https://api.elevenlabs.io/v1" });
  game.settings.register(NAMESPACE, S.musicModel, { name: "BoobaStudio: Replicate music model", hint: "Replicate owner/model identifier for the existing song generator. Leave blank to keep hosted song generation disabled in local mode.", scope: "client", config: true, type: String, default: "" });
  game.settings.register(NAMESPACE, S.musicBaseUrl, { name: "BoobaStudio: Music provider base URL", hint: "Default: https://api.replicate.com/v1. Use a CORS-enabled compatible endpoint if necessary.", scope: "client", config: true, type: String, default: "https://api.replicate.com/v1" });
  game.settings.register(NAMESPACE, S.musicInput, { name: "BoobaStudio: Music model input JSON", hint: "Optional JSON object merged into Replicate input. Use {{prompt}}, {{lyrics}}, {{title}}, and {{style}} placeholders.", scope: "client", config: true, type: String, default: "{}" });
  game.settings.register(NAMESPACE, S.replicateToken, { name: "BoobaStudio: Replicate API token", hint: "Client-scoped token used only for direct Replicate image requests.", scope: "client", config: true, type: String, default: "" });
  game.settings.register(NAMESPACE, S.replicateModel, { name: "BoobaStudio: Replicate image model", hint: "Replicate model in owner/name form, for example black-forest-labs/flux-schnell.", scope: "client", config: true, type: String, default: "black-forest-labs/flux-schnell" });
  game.settings.register(NAMESPACE, S.replicateBaseUrl, { name: "BoobaStudio: Replicate API base URL", hint: "Default: https://api.replicate.com/v1. Use a compatible CORS-enabled proxy or local endpoint if the provider blocks browser requests.", scope: "client", config: true, type: String, default: "https://api.replicate.com/v1" });
  game.settings.register(NAMESPACE, S.stabilityApiKey, { name: "BoobaStudio: Stability AI API key", hint: "Client-scoped key used for direct Stability image requests.", scope: "client", config: true, type: String, default: "" });
  game.settings.register(NAMESPACE, S.stabilityModel, { name: "BoobaStudio: Stability AI model", hint: "Path segment after the Stability generate endpoint, for example core.", scope: "client", config: true, type: String, default: "core" });
  game.settings.register(NAMESPACE, S.stabilityBaseUrl, { name: "BoobaStudio: Stability AI base URL", hint: "Default: https://api.stability.ai/v2beta/stable-image/generate.", scope: "client", config: true, type: String, default: "https://api.stability.ai/v2beta/stable-image/generate" });
  game.settings.register(NAMESPACE, S.comfyuiBaseUrl, { name: "BoobaStudio: ComfyUI base URL", hint: "For example http://127.0.0.1:8188. The Foundry browser must be able to reach this endpoint and CORS must permit the Foundry origin.", scope: "client", config: true, type: String, default: "http://127.0.0.1:8188" });
  game.settings.register(NAMESPACE, S.comfyuiWorkflow, { name: "BoobaStudio: ComfyUI workflow JSON", hint: "Paste an API-format workflow JSON. Use {{prompt}} in a text field where the image prompt should be inserted.", scope: "client", config: true, type: String, default: "{}" });
  game.settings.register(NAMESPACE, S.timeout, { name: "BoobaStudio: Provider timeout (ms)", scope: "client", config: true, type: Number, default: 120000, range: { min: 1000, max: 600000, step: 1000 } });
  game.settings.register(NAMESPACE, S.temperature, { name: "BoobaStudio: Provider temperature", scope: "client", config: true, type: Number, default: 0.7, range: { min: 0, max: 2, step: 0.05 } });
  game.settings.register(NAMESPACE, S.maxTokens, { name: "BoobaStudio: Provider maximum tokens", scope: "client", config: true, type: Number, default: 2048, range: { min: 1, max: 32768, step: 1 } });
  game.settings.register(NAMESPACE, S.headers, { name: "BoobaStudio: Provider custom headers (JSON)", hint: "Optional JSON object merged into provider request headers.", scope: "client", config: true, type: String, default: "{}" });
});

Hooks.once("ready", async () => {
  if (!game.settings.settings?.has?.(`${NAMESPACE}.${S.protocol}`)) game.settings.register(NAMESPACE, S.protocol, { name: "BoobaStudio: Text provider protocol", hint: "Use OpenAI-compatible for OpenAI, OpenRouter, Ollama, and LM Studio; select Anthropic or Gemini for their native APIs.", scope: "client", config: true, type: String, default: "openai", choices: { openai: "OpenAI-compatible", anthropic: "Anthropic", gemini: "Google Gemini" } });
  if (!game.settings.settings?.has?.(`${NAMESPACE}.${S.imageProvider}`)) {
    game.settings.register(NAMESPACE, S.imageProvider, { name: "BoobaStudio: Image provider", hint: "Enter openai for OpenAI-compatible Images, replicate for Replicate predictions, stability for Stability AI, or comfyui for a local ComfyUI server.", scope: "client", config: true, type: String, default: "openai", choices: { openai: "OpenAI-compatible", replicate: "Replicate", stability: "Stability AI", comfyui: "ComfyUI" } });
    game.settings.register(NAMESPACE, S.ttsProvider, { name: "BoobaStudio: TTS provider", hint: "Use OpenAI or ElevenLabs for the existing narration and audio workflow.", scope: "client", config: true, type: String, default: "openai", choices: { openai: "OpenAI", elevenlabs: "ElevenLabs" } });
    game.settings.register(NAMESPACE, S.ttsApiKey, { name: "BoobaStudio: TTS API key", hint: "Client-scoped OpenAI TTS key; falls back to the shared OpenAI-compatible key.", scope: "client", config: true, type: String, default: "" });
    game.settings.register(NAMESPACE, S.ttsModel, { name: "BoobaStudio: OpenAI TTS model", scope: "client", config: true, type: String, default: "tts-1" });
    game.settings.register(NAMESPACE, S.ttsVoice, { name: "BoobaStudio: TTS voice", scope: "client", config: true, type: String, default: "onyx" });
    game.settings.register(NAMESPACE, S.ttsBaseUrl, { name: "BoobaStudio: OpenAI TTS base URL", hint: "Default: https://api.openai.com/v1.", scope: "client", config: true, type: String, default: "https://api.openai.com/v1" });
    game.settings.register(NAMESPACE, S.elevenlabsApiKey, { name: "BoobaStudio: ElevenLabs API key", scope: "client", config: true, type: String, default: "" });
    game.settings.register(NAMESPACE, S.elevenlabsModel, { name: "BoobaStudio: ElevenLabs model", scope: "client", config: true, type: String, default: "eleven_multilingual_v2" });
    game.settings.register(NAMESPACE, S.elevenlabsBaseUrl, { name: "BoobaStudio: ElevenLabs base URL", hint: "Default: https://api.elevenlabs.io/v1.", scope: "client", config: true, type: String, default: "https://api.elevenlabs.io/v1" });
    game.settings.register(NAMESPACE, S.musicModel, { name: "BoobaStudio: Replicate music model", hint: "Replicate owner/model identifier for the existing song generator. Leave blank to keep hosted song generation disabled in local mode.", scope: "client", config: true, type: String, default: "" });
    game.settings.register(NAMESPACE, S.musicBaseUrl, { name: "BoobaStudio: Music provider base URL", hint: "Default: https://api.replicate.com/v1. Use a CORS-enabled compatible endpoint if necessary.", scope: "client", config: true, type: String, default: "https://api.replicate.com/v1" });
    game.settings.register(NAMESPACE, S.musicInput, { name: "BoobaStudio: Music model input JSON", hint: "Optional JSON object merged into Replicate input. Use {{prompt}}, {{lyrics}}, {{title}}, and {{style}} placeholders.", scope: "client", config: true, type: String, default: "{}" });
    game.settings.register(NAMESPACE, S.replicateToken, { name: "BoobaStudio: Replicate API token", hint: "Client-scoped token used only for direct Replicate image requests.", scope: "client", config: true, type: String, default: "" });
    game.settings.register(NAMESPACE, S.replicateModel, { name: "BoobaStudio: Replicate image model", hint: "Replicate model in owner/name form, for example black-forest-labs/flux-schnell.", scope: "client", config: true, type: String, default: "black-forest-labs/flux-schnell" });
    game.settings.register(NAMESPACE, S.replicateBaseUrl, { name: "BoobaStudio: Replicate API base URL", hint: "Default: https://api.replicate.com/v1. Use a compatible CORS-enabled proxy or local endpoint if the provider blocks browser requests.", scope: "client", config: true, type: String, default: "https://api.replicate.com/v1" });
    game.settings.register(NAMESPACE, S.stabilityApiKey, { name: "BoobaStudio: Stability AI API key", hint: "Client-scoped key used for direct Stability image requests.", scope: "client", config: true, type: String, default: "" });
    game.settings.register(NAMESPACE, S.stabilityModel, { name: "BoobaStudio: Stability AI model", hint: "Path segment after the Stability generate endpoint, for example core.", scope: "client", config: true, type: String, default: "core" });
    game.settings.register(NAMESPACE, S.stabilityBaseUrl, { name: "BoobaStudio: Stability AI base URL", hint: "Default: https://api.stability.ai/v2beta/stable-image/generate.", scope: "client", config: true, type: String, default: "https://api.stability.ai/v2beta/stable-image/generate" });
    game.settings.register(NAMESPACE, S.comfyuiBaseUrl, { name: "BoobaStudio: ComfyUI base URL", hint: "For example http://127.0.0.1:8188. The Foundry browser must be able to reach this endpoint and CORS must permit the Foundry origin.", scope: "client", config: true, type: String, default: "http://127.0.0.1:8188" });
    game.settings.register(NAMESPACE, S.comfyuiWorkflow, { name: "BoobaStudio: ComfyUI workflow JSON", hint: "Paste an API-format workflow JSON. Use {{prompt}} in a text field where the image prompt should be inserted.", scope: "client", config: true, type: String, default: "{}" });
  }
  if (isEnabled() && baseUrl()) {
    await game.settings.set(NAMESPACE, "clientOnlyMode", true);
  }
  install();
});
