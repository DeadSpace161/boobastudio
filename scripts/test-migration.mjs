import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../bundle/modules/boobastudio-migration-v256.js", import.meta.url), "utf8");
const hooks = new Map();
const values = new Map();
const storage = new Map([
  ["client", new Map([
    ["cibola8.apikey", { value: "legacy-api-key" }],
    ["cibola8.openaiApiKey", { value: "legacy-openai-key" }],
    ["cibola8.favoriteVoices", { value: [{ voice_id: "legacy-voice" }] }],
  ])],
  ["world", new Map([
    ["cibola8.systemSettings", { value: { migrated: true } }],
    ["cibola8.ActorPath", { value: "world/actors" }],
  ])],
]);
const migratedMacro = {
  flags: { cibola8: { radialMenu: true } },
  async update(data) { this.flags = { ...this.flags, ...data.flags }; },
};
const browserStorage = new Map([["cibola8-c8-ironsworn-test-world", "legacy-history"]]);

const game = {
  ready: false,
  system: { id: "ironsworn" },
  world: { id: "test-world" },
  settings: {
    storage,
    settings: new Map(),
    register(namespace, key, options) {
      this.settings.set(`${namespace}.${key}`, options);
      if (!values.has(`${namespace}.${key}`)) values.set(`${namespace}.${key}`, options.default);
    },
    get(namespace, key) { return values.get(`${namespace}.${key}`); },
    async set(namespace, key, value) {
      values.set(`${namespace}.${key}`, value);
      const scope = this.settings.get(`${namespace}.${key}`)?.scope || "world";
      const scopeStorage = storage.get(scope) || new Map();
      scopeStorage.set(`${namespace}.${key}`, { value });
      storage.set(scope, scopeStorage);
      return value;
    },
  },
  macros: { contents: [migratedMacro] },
};

const context = {
  console,
  game,
  Hooks: { once(name, callback) { hooks.set(name, callback); } },
  foundry: { utils: { duplicate(value) { return structuredClone(value); } } },
  localStorage: {
    getItem(key) { return browserStorage.get(key) ?? null; },
    setItem(key, value) { browserStorage.set(key, String(value)); },
  },
  setTimeout,
  Promise,
};
vm.runInNewContext(source, context, { filename: "boobastudio-migration-v256.js" });
await hooks.get("init")();
game.ready = true;
await hooks.get("ready")();
await new Promise((resolve) => setTimeout(resolve, 10));

assert.equal(values.get("boobastudio.legacyMigrationComplete"), true);
assert.equal(values.get("boobastudio.apikey"), "legacy-api-key");
assert.equal(values.get("boobastudio.openaiApiKey"), "legacy-openai-key");
assert.deepEqual(values.get("boobastudio.favoriteVoices"), [{ voice_id: "legacy-voice" }]);
assert.deepEqual(values.get("boobastudio.systemSettings"), { migrated: true });
assert.equal(values.get("boobastudio.ActorPath"), "world/actors");
assert.equal(browserStorage.get("boobastudio-c8-ironsworn-test-world"), "legacy-history");
assert.equal(migratedMacro.flags.boobastudio.radialMenu, true);
assert.equal(migratedMacro.flags.cibola8.radialMenu, true);
assert.equal(browserStorage.get("cibola8-c8-ironsworn-test-world"), "legacy-history");

console.log("BoobaStudio migration smoke test passed");
