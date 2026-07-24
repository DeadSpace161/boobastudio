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
    const messageContent = Array.isArray(requestBody.messages?.[0]?.content) ? requestBody.messages[0].content.map((part) => part?.text || "").join(" ") : requestBody.messages?.[0]?.content;
    const content = Array.isArray(requestBody.messages?.[0]?.content) && requestBody.messages[0].content.some((part) => part?.type === "image_url") ? "image description" : String(messageContent || "").includes("Return only a valid JSON array") ? '["prompt one", "prompt two"]' : requestBody.messages?.[0]?.content === "array-content" ? [{ type: "text", text: "array " }, { type: "text", text: "response" }] : "provider response";
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  }
  if (String(input).endsWith("/messages")) return new Response(JSON.stringify({ content: [{ type: "text", text: "anthropic response" }] }), { status: 200 });
  if (String(input).includes(":generateContent")) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "gemini response" }] } }] }), { status: 200 });
  if (String(input).endsWith("/images/generations")) return new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] }), { status: 200 });
  if (String(input).endsWith("/images/edits")) return new Response(JSON.stringify({ data: [{ b64_json: "ZWRpdGVk" }] }), { status: 200 });
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
values.set("boobastudio.localTtsVoices", JSON.stringify([{ voice_id: "local-voice", name: "Local Voice" }]));
assert.equal((await globalThis.__boobastudioLocalVoices(false)).voices[0].voice_id, "local-voice");
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
assert.equal(localGalleryPage.data[0].attributes.type, "image");
assert.equal(localGalleryPage.data[0].attributes.publicstate, "self_only");
assert.equal(localGalleryPage.data[0].attributes.llmjobid, localGalleryPage.data[0].id);
assert.equal(localGalleryPage.data[0].attributes.provider, "openai");
const localPackCreate = await globalThis.__boobastudioLocalPackCreate({ name: "Smoke Pack", description: "Local pack persistence" });
assert.equal(localPackCreate.data.attributes.name, "Smoke Pack");
const localPackId = localPackCreate.data.id;
const localPackAdd = await globalThis.__boobastudioLocalPackAddImage(localPackId, localGalleryPage.data[0].id);
assert.equal(localPackAdd.ok, true);
const localPackList = await globalThis.__boobastudioLocalPackMyPacks();
assert.equal(localPackList.data.length, 1);
assert.equal(localPackList.data[0].attributes.image_count, 1);
const localPackImages = await globalThis.__boobastudioLocalPackImages(localPackId, 1);
assert.equal(localPackImages.data[0].id, localGalleryPage.data[0].id);
const localPackCover = await globalThis.__boobastudioLocalPackUpdateImage(localPackId, localGalleryPage.data[0].id, { is_cover: true });
assert.equal(localPackCover.success, true);
const localPackDetail = await globalThis.__boobastudioLocalPackDetail(localPackId);
assert.equal(localPackDetail.data.attributes.image_count, 1);
assert.equal(localPackDetail.data.attributes.preview_thumbnails.length, 1);
const localPackUpdate = await globalThis.__boobastudioLocalPackUpdate(localPackId, { tagline: "Smoke" });
assert.equal(localPackUpdate.data.attributes.tagline, "Smoke");
const localPackRemove = await globalThis.__boobastudioLocalPackRemoveImage(localPackId, localGalleryPage.data[0].id);
assert.equal(localPackRemove.success, true);
const localPackDelete = await globalThis.__boobastudioLocalPackDelete(localPackId);
assert.equal(localPackDelete.success, true);
let deletedGallery;
await globalThis.__boobastudioLocalGalleryDelete(localGalleryPage.data[0].id, (result) => { deletedGallery = result; });
assert.equal(deletedGallery.success, true);
let emptyLocalGallery;
await globalThis.__boobastudioLocalGalleryPage(1, (page) => { emptyLocalGallery = page; }, {});
assert.equal(emptyLocalGallery.data.length, 0);
for (let index = 0; index < 21; index++) await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ prompt: `pagination probe ${index}` }) });
let paginatedGallery;
await globalThis.__boobastudioLocalGalleryPage(1, (page) => { paginatedGallery = page; }, {});
assert.equal(paginatedGallery.data.length, 20);
assert.equal(paginatedGallery.pagy.next, 2);

let enhanced;
await globalThis.__boobastudioLocalVectorize({ get() { return { name: "campaign.txt", size: 32, text: async () => "tavern lore local context" }; } }, () => {}, () => {});
await globalThis.__boobastudioLocalEnhance("tavern lore prompt", JSON.stringify({ type: "improvisePrompt" }), (result) => { enhanced = result; });
assert.equal(enhanced.status, "done");
assert.equal(enhanced.result, "provider response");
assert.match(String(requests.at(-1).init.body), /tavern lore local context/);

let promptBuilderResult;
await globalThis.__boobastudioLocalBuildPrompts({ command: "fantasy tavern", amount: 2 }, (result) => { promptBuilderResult = result; });
assert.deepEqual(promptBuilderResult, { status: "done", result: '["prompt one","prompt two"]' });
assert.equal(Object.hasOwn(JSON.parse(requests.at(-1).init.body), "response_format"), false);

values.set("boobastudio.ttsProvider", "openai");
values.set("boobastudio.ttsBaseUrl", "http://tts.test/v1");
values.set("boobastudio.ttsApiKey", "tts-key");
let localTTSResult;
await globalThis.__boobastudioLocalGenerateTTS("Narrate the tavern", JSON.stringify({ type: "tts", voice: "nova" }), "tts-1", (result) => { localTTSResult = result; });
assert.deepEqual(localTTSResult, { status: "done", result: "data:audio/mpeg;base64,AQID" });
assert.equal((await globalThis.__boobastudioLocalVoices(false)).voices.length, 11);
assert.equal((await globalThis.__boobastudioLocalVoicePage({ search: "nova" }, false)).voices[0].voice_id, "nova");
values.set("boobastudio.ttsProvider", "elevenlabs");
assert.equal((await globalThis.__boobastudioLocalVoices(false)).voices[0].voice_id, "local-voice");

values.set("boobastudio.musicModel", "test/music-model");
values.set("boobastudio.musicBaseUrl", "https://music.test/v1");
values.set("boobastudio.musicInput", JSON.stringify({ duration: 8, prompt: "{{style}} | {{lyrics}}" }));
values.set("boobastudio.replicateApiToken", "music-token");
let localSongResult;
await globalThis.__boobastudioLocalGenerateSong({ songtitle: "Tavern Song", lyrics: "Raise a glass", style: "folk" }, JSON.stringify({ type: "song" }), (result) => { localSongResult = result; }, { model: "suno" });
assert.equal(localSongResult.status, "done");
const song = JSON.parse(localSongResult.result)[0];
assert.equal(song.title, "Tavern Song");
assert.equal(song.audio_url, "https://cdn.test/generated.png");
assert.equal(requests.at(-2).input, "https://music.test/v1/models/test/music-model/predictions");
assert.equal(JSON.parse(requests.at(-2).init.body).input.prompt, "folk | Raise a glass");
let localSongGallery;
await globalThis.__boobastudioLocalGalleryPage(1, (page) => { localSongGallery = page; }, { filter: "song" });
assert.equal(localSongGallery.data.length, 1);
assert.equal(localSongGallery.data[0].attributes.type, "song");
assert.equal(localSongGallery.data[0].attributes.audio_url, "https://cdn.test/generated.png");
assert.equal(localSongGallery.data[0].attributes.publicstate, "self_only");
assert.equal(localSongGallery.data[0].attributes.llmjobid, localSongGallery.data[0].id);

values.set("boobastudio.providerBaseUrl", "http://provider.test/v1");
values.set("boobastudio.imageProvider", "openai");
values.set("boobastudio.imageModel", "local-image-model");
values.set("boobastudio.openaiApiKey", "test-key");
const editResponse = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ model: "gpt-image-1", prompt: "remove the tower", image: "data:image/png;base64,abc", mask: "data:image/png;base64,mask" }) });
assert.equal((await editResponse.json()).data[0].b64_json, "ZWRpdGVk");
assert.equal(requests.at(-1).input, "http://provider.test/v1/images/edits");
assert.equal(requests.at(-1).init.headers.Authorization, "Bearer test-key");
assert.equal(requests.at(-1).init.body.get("model"), "gpt-image-1");
assert.equal(requests.at(-1).init.body.get("prompt"), "remove the tower");
assert.equal(requests.at(-1).init.body.get("image").name, "input.png");
assert.equal(requests.at(-1).init.body.get("mask").name, "mask.png");

let variantResult;
await globalThis.__boobastudioLocalGenerateVariant("make a second version", JSON.stringify({ image: "data:image/png;base64,abc", moreFields: { strength: 0.7 } }), "gpt-image-1", (result) => { variantResult = result; });
assert.equal(variantResult.success, true);
assert.equal(variantResult.result, "data:image/png;base64,ZWRpdGVk");
assert.equal(requests.at(-1).input, "http://provider.test/v1/images/edits");

values.set("boobastudio.imageProvider", "replicate");
values.set("boobastudio.replicateBaseUrl", "https://replicate-upscale.test/v1");
values.set("boobastudio.replicateModel", "nightmareai/real-esrgan");
values.set("boobastudio.replicateApiToken", "upscale-token");
values.set("boobastudio.replicateImageInput", JSON.stringify({ num_inference_steps: 12, prompt: "{{prompt}}" }));
const upscaleResponse = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ model: "nightmareai/real-esrgan", prompt: "data:image/png;base64,abc", basePrompt: "upscale this map", factor: 2 }) });
assert.equal((await upscaleResponse.json()).data[0].url, "https://cdn.test/generated.png");
const upscaleRequest = requests.at(-2);
assert.equal(upscaleRequest.input, "https://replicate-upscale.test/v1/models/nightmareai/real-esrgan/predictions");
assert.equal(JSON.parse(upscaleRequest.init.body).input.image, "data:image/png;base64,abc");
assert.equal(JSON.parse(upscaleRequest.init.body).input.prompt, "upscale this map");
assert.equal(JSON.parse(upscaleRequest.init.body).input.factor, 2);
assert.equal(JSON.parse(upscaleRequest.init.body).input.num_inference_steps, 12);
values.set("boobastudio.replicateImageInput", "{}");

console.log("BoobaStudio provider smoke test passed");
