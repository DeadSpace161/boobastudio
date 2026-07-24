import assert from "node:assert/strict";

const hooks = new Map();
const values = new Map();
const requests = [];
const localValues = new Map();
globalThis.localStorage = {
  getItem(key) { return localValues.get(key) ?? null; },
  setItem(key, value) { localValues.set(key, String(value)); },
};

globalThis.Hooks = { once(name, callback) { hooks.set(name, callback); } };
globalThis.game = {
  settings: {
    register(namespace, key, definition) { values.set(`${namespace}.${key}`, values.get(`${namespace}.${key}`) ?? definition.default); },
    get(namespace, key) { return values.get(`${namespace}.${key}`); },
    async set(namespace, key, value) { values.set(`${namespace}.${key}`, value); },
  },
};
globalThis.fetch = async (input, init) => {
  requests.push({ input, init });
  if (String(input).includes("network.test")) throw new TypeError("Failed to fetch");
  if (String(input).includes("status401.test")) return new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 });
  if (String(input).includes("status429.test")) return new Response(JSON.stringify({ error: { message: "slow down" } }), { status: 429 });
  if (String(input).endsWith("/prompt")) return new Response(JSON.stringify({ prompt_id: "comfy-prompt-1" }), { status: 200 });
  if (String(input).endsWith("/history/comfy-prompt-1")) return new Response(JSON.stringify({ "comfy-prompt-1": { outputs: { "9": { images: [{ filename: "generated.png", subfolder: "", type: "output" }] } } } }), { status: 200 });
  if (String(input).endsWith("/generate/core")) return new Response(JSON.stringify({ image: "c3RhYmlsaXR5" }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (String(input).endsWith("/audio/speech")) return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
  if (String(input).includes("/text-to-speech/voice-1")) return new Response(new Uint8Array([4, 5, 6]), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
  if (String(input).includes("/models/") && String(input).endsWith("/predictions") || String(input).endsWith("/predictions/prediction-1")) {
    if (init?.method === "POST") return new Response(JSON.stringify({ id: "prediction-1", status: "starting", urls: { get: "https://api.replicate.com/v1/predictions/prediction-1" } }), { status: 201 });
    return new Response(JSON.stringify({ id: "prediction-1", status: "succeeded", output: ["https://cdn.test/generated.png"] }), { status: 200 });
  }
  if (String(input).endsWith("/chat/completions")) {
    const requestBody = JSON.parse(init?.body || "{}");
    const content = Array.isArray(requestBody.messages?.[0]?.content) && requestBody.messages[0].content.some((part) => part?.type === "image_url") ? "image description" : requestBody.messages?.[0]?.content === "array-content" ? [{ type: "text", text: "array " }, { type: "text", text: "response" }] : "provider response";
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  }
  if (String(input).endsWith("/messages")) return new Response(JSON.stringify({ content: [{ type: "text", text: "anthropic response" }] }), { status: 200 });
  if (String(input).includes(":generateContent")) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "gemini response" }] } }] }), { status: 200 });
  if (String(input).endsWith("/images/generations")) return new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] }), { status: 200 });
  return new Response(JSON.stringify({ error: { message: "unexpected request" } }), { status: 500 });
};

await import("../bundle/modules/boobastudio-provider.js");
await hooks.get("init")();
values.set("boobastudio.providerEnabled", true);
values.set("boobastudio.providerBaseUrl", "http://provider.test/v1");
values.set("boobastudio.openaiApiKey", "test-key");
values.set("boobastudio.imageProvider", "openai");
values.set("boobastudio.providerModel", "local-model");
values.set("boobastudio.providerJsonMode", true);
values.set("boobastudio.imageModel", "local-image-model");
values.set("boobastudio.providerHeaders", JSON.stringify({ "X-Test": "yes" }));
await hooks.get("ready")();
assert.equal(globalThis.__boobastudioLocalProviderConfigured(), true);

const textResponse = await fetch("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({ model: "gpt-5", input: [{ role: "user", content: [{ type: "input_text", text: "hello" }] }] }) });
assert.equal((await textResponse.json()).output[0].content[0].text, "provider response");
assert.equal(requests[0].input, "http://provider.test/v1/chat/completions");
assert.equal(JSON.parse(requests[0].init.body).model, "local-model");
assert.deepEqual(JSON.parse(requests[0].init.body).response_format, { type: "json_object" });
assert.equal(requests[0].init.headers.Authorization, "Bearer test-key");
assert.equal(requests[0].init.headers["X-Test"], "yes");

const imageResponse = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ model: "gpt-image-1", prompt: "a castle" }) });
assert.equal((await imageResponse.json()).data[0].b64_json, "aGVsbG8=");
assert.equal(requests[1].input, "http://provider.test/v1/images/generations");
assert.equal(JSON.parse(requests[1].init.body).model, "local-image-model");

let descriptionResult;
await globalThis.__boobastudioLocalDescribe({ image: "data:image/png;base64,abc" }, (result) => { descriptionResult = result; });
assert.deepEqual(descriptionResult, { status: "done", result: "image description" });
assert.equal(requests[2].input, "http://provider.test/v1/chat/completions");
assert.equal(JSON.parse(requests[2].init.body).messages[0].content[1].image_url.url, "data:image/png;base64,abc");

let vectorCallback;
let vectorProgress;
const vectorHandled = await globalThis.__boobastudioLocalVectorize({ get() { return { name: "lore.txt", size: 9, text: async () => "local lore" }; } }, (result) => { vectorCallback = result; }, (progress) => { vectorProgress = progress; });
assert.equal(vectorHandled, true);
assert.equal(vectorProgress, 100);
assert.equal(vectorCallback.status, "done");
let vectorPage;
await globalThis.__boobastudioLocalVectorList((result) => { vectorPage = result; });
assert.equal(vectorPage.included.find((item) => item.type === "vector_store_file").attributes.uploaded_file_name, "lore.txt");
const vectorId = vectorPage.included.find((item) => item.type === "vector_store_file").id;
let vectorDelete;
await globalThis.__boobastudioLocalVectorDelete(vectorId, (result) => { vectorDelete = result; });
assert.equal(vectorDelete.status, "done");
let galleryShare;
await globalThis.__boobastudioLocalGalleryShare((result) => { galleryShare = result; });
assert.equal(galleryShare.status, "error");
assert.match(galleryShare.errors[0], /unavailable in local mode/i);
values.set("boobastudio.imageProvider", "replicate");
values.set("boobastudio.replicateApiToken", "replicate-test-token");
values.set("boobastudio.replicateModel", "black-forest-labs/flux-schnell");
const replicateImageResponse = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ model: "black-forest-labs/flux-fill-pro", prompt: "a tavern", image: "data:image/png;base64,abc", mask: "data:image/png;base64,mask" }) });
assert.equal((await replicateImageResponse.json()).data[0].url, "https://cdn.test/generated.png");
assert.equal(requests[3].input, "https://api.replicate.com/v1/models/black-forest-labs/flux-fill-pro/predictions");
assert.equal(requests[3].init.headers.Authorization, "Bearer replicate-test-token");
assert.equal(JSON.parse(requests[3].init.body).input.image, "data:image/png;base64,abc");
assert.equal(JSON.parse(requests[3].init.body).input.mask, "data:image/png;base64,mask");

values.set("boobastudio.replicateBaseUrl", "https://replicate-proxy.test/v1");
values.set("boobastudio.replicateModel", "bria/eraser");
const eraseResponse = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ prompt: "ignored", image: "data:image/png;base64,abc", mask: "data:image/png;base64,mask" }) });
assert.equal((await eraseResponse.json()).data[0].url, "https://cdn.test/generated.png");
assert.equal(requests[5].input, "https://replicate-proxy.test/v1/models/bria/eraser/predictions");
const eraseInput = JSON.parse(requests[5].init.body).input;
assert.equal(eraseInput.image, "data:image/png;base64,abc");
assert.equal(eraseInput.mask, "data:image/png;base64,mask");
assert.equal(eraseInput.preserve_alpha, true);
assert.equal(Object.hasOwn(eraseInput, "prompt"), false);

values.set("boobastudio.replicateModel", "cjwbw/rembg");
await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ prompt: "ignored", image: "data:image/png;base64,abc", mask: "data:image/png;base64,mask" }) });
const rembgInput = JSON.parse(requests[7].init.body).input;
assert.deepEqual(rembgInput, { image: "data:image/png;base64,abc" });

values.set("boobastudio.replicateModel", "bria/expand-image");
await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ prompt: "expand", image: "data:image/png;base64,abc", aspect_ratio: "16:9", canvas_size: 1024 }) });
const expandInput = JSON.parse(requests[9].init.body).input;
assert.equal(expandInput.image, "data:image/png;base64,abc");
assert.equal(expandInput.aspect_ratio, "16:9");
assert.equal(expandInput.canvas_size, 1024);

values.set("boobastudio.imageProvider", "openai");
values.set("boobastudio.replicateApiToken", "");
values.set("boobastudio.replicateBaseUrl", "https://api.replicate.com/v1");
values.set("boobastudio.replicateModel", "black-forest-labs/flux-schnell");
values.set("boobastudio.openaiApiKey", "r8_fallback-token");
const fallbackImageResponse = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ prompt: "a fallback tavern" }) });
assert.equal((await fallbackImageResponse.json()).data[0].url, "https://cdn.test/generated.png");
assert.equal(requests[11].input, "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions");
assert.equal(requests[11].init.headers.Authorization, "Bearer r8_fallback-token");

values.set("boobastudio.imageProvider", "comfyui");
values.set("boobastudio.comfyuiBaseUrl", "http://comfyui.test");
values.set("boobastudio.comfyuiWorkflow", JSON.stringify({ "6": { inputs: { text: "{{prompt}}" } } }));
const comfyResponse = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ prompt: "a forest shrine" }) });
assert.equal((await comfyResponse.json()).data[0].url, "http://comfyui.test/view?filename=generated.png&subfolder=&type=output");
assert.equal(requests[13].input, "http://comfyui.test/prompt");
assert.equal(JSON.parse(requests[13].init.body).prompt["6"].inputs.text, "a forest shrine");

values.set("boobastudio.imageProvider", "stability");
values.set("boobastudio.stabilityBaseUrl", "https://stability.test/v2beta/stable-image/generate");
values.set("boobastudio.stabilityModel", "core");
values.set("boobastudio.stabilityApiKey", "stability-key");
const stabilityResponse = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ prompt: "a moonlit ruin", size: "1024x1024" }) });
assert.equal((await stabilityResponse.json()).data[0].b64_json, "c3RhYmlsaXR5");
assert.equal(requests.at(-1).input, "https://stability.test/v2beta/stable-image/generate/core");
assert.equal(requests.at(-1).init.headers.Authorization, "Bearer stability-key");

values.set("boobastudio.ttsProvider", "openai");
values.set("boobastudio.ttsBaseUrl", "https://tts.test/v1");
values.set("boobastudio.ttsApiKey", "tts-key");
const openaiTTS = await fetch("https://app.cibola.world/api/v1/tts", { method: "POST", body: JSON.stringify({ prompt: JSON.stringify({ speechcontent: "Read this aloud", voice: "nova", speed: "1.1" }) }) });
const openaiTTSBody = await openaiTTS.json();
assert.equal(openaiTTSBody.success, true);
assert.equal(openaiTTSBody.result, "data:audio/mpeg;base64,AQID");
assert.equal(requests.at(-1).input, "https://tts.test/v1/audio/speech");
assert.equal(requests.at(-1).init.headers.Authorization, "Bearer tts-key");

values.set("boobastudio.ttsProvider", "elevenlabs");
values.set("boobastudio.elevenlabsBaseUrl", "https://eleven.test/v1");
values.set("boobastudio.elevenlabsApiKey", "eleven-key");
const elevenTTS = await fetch("https://app.cibola.world/api/v1/tts", { method: "POST", body: JSON.stringify({ prompt: JSON.stringify({ speechcontent: "Read this with ElevenLabs", voice_id: "voice-1", model: "eleven_turbo_v2_5" }) }) });
const elevenTTSBody = await elevenTTS.json();
assert.equal(elevenTTSBody.success, true);
assert.equal(elevenTTSBody.result, "data:audio/mpeg;base64,BAUG");
assert.equal(requests.at(-1).input, "https://eleven.test/v1/text-to-speech/voice-1");
assert.equal(requests.at(-1).init.headers["xi-api-key"], "eleven-key");

values.set("boobastudio.openaiApiKey", "test-key");

let queryResult;
await globalThis.__boobastudioLocalQuery("Write a tavern description", "{\"type\":\"object\"}", (result) => { queryResult = result; });
assert.deepEqual(queryResult, { status: "done", result: "provider response" });
assert.equal(requests.at(-1).input, "http://provider.test/v1/chat/completions");
const arrayResponse = await fetch("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({ input: [{ role: "user", content: [{ type: "input_text", text: "array-content" }] }] }) });
assert.equal((await arrayResponse.json()).output[0].content[0].text, "array response");

values.set("boobastudio.providerProtocol", "anthropic");
values.set("boobastudio.providerBaseUrl", "https://api.anthropic.test/v1");
values.set("boobastudio.openaiApiKey", "anthropic-key");
const anthropicResponse = await fetch("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({ input: [{ role: "system", content: [{ type: "input_text", text: "system rule" }] }, { role: "user", content: [{ type: "input_text", text: "hello" }] }] }) });
assert.equal((await anthropicResponse.json()).output[0].content[0].text, "anthropic response");
assert.equal(requests.at(-1).input, "https://api.anthropic.test/v1/messages");
assert.equal(requests.at(-1).init.headers["x-api-key"], "anthropic-key");
assert.equal(JSON.parse(requests.at(-1).init.body).system, "system rule");

values.set("boobastudio.providerProtocol", "gemini");
values.set("boobastudio.providerBaseUrl", "https://generativelanguage.googleapis.com/v1beta");
values.set("boobastudio.providerModel", "gemini-2.5-flash");
values.set("boobastudio.openaiApiKey", "gemini-key");
const geminiResponse = await fetch("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({ input: [{ role: "user", content: [{ type: "input_text", text: "hello" }] }] }) });
assert.equal((await geminiResponse.json()).output[0].content[0].text, "gemini response");
assert.equal(requests.at(-1).input, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
assert.equal(requests.at(-1).init.headers["x-goog-api-key"], "gemini-key");

values.set("boobastudio.providerBaseUrl", "http://network.test/v1");
values.set("boobastudio.providerProtocol", "openai");
const networkResponse = await fetch("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({ input: [{ role: "user", content: [{ type: "input_text", text: "network" }] }] }) });
const networkError = await networkResponse.json();
assert.equal(networkResponse.status, 502);
assert.match(networkError.error.message, /^Network\/CORS error:/);
let localNetworkResult;
await globalThis.__boobastudioLocalQuery("network", "", (result) => { localNetworkResult = result; });
assert.equal(localNetworkResult.status, "error");
assert.match(localNetworkResult.errors[0], /^Network\/CORS error:/);

for (const base of ["https://openrouter.ai/api/v1", "http://localhost:11434/v1", "http://127.0.0.1:1234/v1"]) {
  values.set("boobastudio.providerBaseUrl", base);
  values.set("boobastudio.providerModel", "compatibility-model");
  let compatibilityResult;
  await globalThis.__boobastudioLocalQuery("compatibility probe", "", (result) => { compatibilityResult = result; });
  assert.deepEqual(compatibilityResult, { status: "done", result: "provider response" });
  assert.equal(requests.at(-1).input, `${base}/chat/completions`);
}

values.set("boobastudio.providerBaseUrl", "https://status401.test/v1");
const authFailure = await fetch("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({ input: [{ role: "user", content: [{ type: "input_text", text: "auth" }] }] }) });
assert.equal(authFailure.status, 401);
assert.match((await authFailure.json()).error.message, /^Invalid API key/);
values.set("boobastudio.providerBaseUrl", "https://status429.test/v1");
const rateFailure = await fetch("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({ input: [{ role: "user", content: [{ type: "input_text", text: "rate" }] }] }) });
assert.equal(rateFailure.status, 429);
assert.match((await rateFailure.json()).error.message, /^Provider rate limit exceeded/);

const localStorageValues = new Map();
globalThis.localStorage = {
  getItem(key) { return localStorageValues.get(key) ?? null; },
  setItem(key, value) { localStorageValues.set(key, String(value)); },
};
values.set("boobastudio.providerBaseUrl", "http://provider.test/v1");
values.set("boobastudio.imageProvider", "openai");
await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ prompt: "local gallery probe" }) });
let localGalleryPage;
await globalThis.__boobastudioLocalGalleryPage(1, (page) => { localGalleryPage = page; }, {});
assert.equal(localGalleryPage.data.length, 1);
assert.equal(localGalleryPage.data[0].attributes.prompt, "local gallery probe");
await globalThis.__boobastudioLocalGalleryDelete(localGalleryPage.data[0].id, () => {});
let emptyLocalGallery;
await globalThis.__boobastudioLocalGalleryPage(1, (page) => { emptyLocalGallery = page; }, {});
assert.equal(emptyLocalGallery.data.length, 0);

let enhanced;
await globalThis.__boobastudioLocalVectorize({ get() { return { name: "campaign.txt", size: 32, text: async () => "tavern lore local context" }; } }, () => {}, () => {});
await globalThis.__boobastudioLocalEnhance("tavern lore prompt", JSON.stringify({ type: "improvisePrompt" }), (result) => { enhanced = result; });
assert.equal(enhanced.status, "done");
assert.equal(enhanced.result, "provider response");
assert.match(String(requests.at(-1).init.body), /tavern lore local context/);

console.log("BoobaStudio provider smoke test passed");
