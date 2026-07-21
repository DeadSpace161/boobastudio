import assert from "node:assert/strict";

const hooks = new Map();
const values = new Map();
const requests = [];

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
  if (String(input).includes("api.replicate.com/v1/models/") && String(input).endsWith("/predictions") || String(input).includes("api.replicate.com/v1/predictions/prediction-1")) {
    if (init?.method === "POST") return new Response(JSON.stringify({ id: "prediction-1", status: "starting", urls: { get: "https://api.replicate.com/v1/predictions/prediction-1" } }), { status: 201 });
    return new Response(JSON.stringify({ id: "prediction-1", status: "succeeded", output: ["https://cdn.test/generated.png"] }), { status: 200 });
  }
  if (String(input).endsWith("/chat/completions")) return new Response(JSON.stringify({ choices: [{ message: { content: "provider response" } }] }), { status: 200 });
  if (String(input).endsWith("/images/generations")) return new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] }), { status: 200 });
  return new Response(JSON.stringify({ error: { message: "unexpected request" } }), { status: 500 });
};

await import("../bundle/modules/boobastudio-provider.js");
await hooks.get("init")();
values.set("boobastudio.providerEnabled", true);
values.set("boobastudio.providerBaseUrl", "http://provider.test/v1");
values.set("boobastudio.openaiApiKey", "test-key");
values.set("boobastudio.providerModel", "local-model");
values.set("boobastudio.imageModel", "local-image-model");
values.set("boobastudio.providerHeaders", JSON.stringify({ "X-Test": "yes" }));
await hooks.get("ready")();
assert.equal(globalThis.__boobastudioLocalProviderConfigured(), true);

const textResponse = await fetch("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({ model: "gpt-5", input: [{ role: "user", content: [{ type: "input_text", text: "hello" }] }] }) });
assert.equal((await textResponse.json()).output[0].content[0].text, "provider response");
assert.equal(requests[0].input, "http://provider.test/v1/chat/completions");
assert.equal(JSON.parse(requests[0].init.body).model, "local-model");
assert.equal(requests[0].init.headers.Authorization, "Bearer test-key");
assert.equal(requests[0].init.headers["X-Test"], "yes");

const imageResponse = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ model: "gpt-image-1", prompt: "a castle" }) });
assert.equal((await imageResponse.json()).data[0].b64_json, "aGVsbG8=");
assert.equal(requests[1].input, "http://provider.test/v1/images/generations");
assert.equal(JSON.parse(requests[1].init.body).model, "local-image-model");

values.set("boobastudio.imageProvider", "replicate");
values.set("boobastudio.replicateApiToken", "replicate-test-token");
values.set("boobastudio.replicateModel", "black-forest-labs/flux-schnell");
const replicateImageResponse = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ model: "black-forest-labs/flux-fill-pro", prompt: "a tavern", image: "data:image/png;base64,abc", mask: "data:image/png;base64,mask" }) });
assert.equal((await replicateImageResponse.json()).data[0].url, "https://cdn.test/generated.png");
assert.equal(requests[2].input, "https://api.replicate.com/v1/models/black-forest-labs/flux-fill-pro/predictions");
assert.equal(requests[2].init.headers.Authorization, "Bearer replicate-test-token");
assert.equal(JSON.parse(requests[2].init.body).input.image, "data:image/png;base64,abc");
assert.equal(JSON.parse(requests[2].init.body).input.mask, "data:image/png;base64,mask");

values.set("boobastudio.imageProvider", "openai");
values.set("boobastudio.replicateApiToken", "");
values.set("boobastudio.openaiApiKey", "r8_fallback-token");
const fallbackImageResponse = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", body: JSON.stringify({ prompt: "a fallback tavern" }) });
assert.equal((await fallbackImageResponse.json()).data[0].url, "https://cdn.test/generated.png");
assert.equal(requests[4].input, "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions");
assert.equal(requests[4].init.headers.Authorization, "Bearer r8_fallback-token");

values.set("boobastudio.openaiApiKey", "test-key");

let queryResult;
await globalThis.__boobastudioLocalQuery("Write a tavern description", "{\"type\":\"object\"}", (result) => { queryResult = result; });
assert.deepEqual(queryResult, { status: "done", result: "provider response" });
assert.equal(requests[6].input, "http://provider.test/v1/chat/completions");

values.set("boobastudio.providerBaseUrl", "http://network.test/v1");
const networkResponse = await fetch("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({ input: [{ role: "user", content: [{ type: "input_text", text: "network" }] }] }) });
const networkError = await networkResponse.json();
assert.equal(networkResponse.status, 502);
assert.match(networkError.error.message, /^Network\/CORS error:/);

for (const base of ["https://openrouter.ai/api/v1", "http://localhost:11434/v1", "http://127.0.0.1:1234/v1"]) {
  values.set("boobastudio.providerBaseUrl", base);
  values.set("boobastudio.providerModel", "compatibility-model");
  let compatibilityResult;
  await globalThis.__boobastudioLocalQuery("compatibility probe", "", (result) => { compatibilityResult = result; });
  assert.deepEqual(compatibilityResult, { status: "done", result: "provider response" });
  assert.equal(requests.at(-1).input, `${base}/chat/completions`);
}

console.log("BoobaStudio provider smoke test passed");
