import { access, readFile } from "node:fs/promises";
import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const manifestPath = path.join(root, "module.json");
const featureContractPath = path.join(root, "docs", "feature-contract.json");

const required = [
  "bundle/modules/init.js",
  "styles/css/css.css",
  "lang/en.json",
  "packs/documentation/MANIFEST-000063",
];

const fail = (message) => {
  console.error(`BoobaStudio package check failed: ${message}`);
  process.exitCode = 1;
};

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  fail(`cannot parse module.json (${error.message})`);
  process.exit(1);
}

for (const relativePath of required) {
  try {
    await access(path.join(root, relativePath));
  } catch {
    fail(`missing required file: ${relativePath}`);
  }
}

for (const relativePath of [...(manifest.esmodules ?? []), ...(manifest.styles ?? [])]) {
  const filePath = relativePath.split("?", 1)[0];
  try {
    await access(path.join(root, filePath));
  } catch {
    fail(`manifest references missing file: ${filePath}`);
  }
}

for (const language of manifest.languages ?? []) {
  try {
    JSON.parse(await readFile(path.join(root, language.path), "utf8"));
  } catch (error) {
    fail(`invalid language file ${language.path}: ${error.message}`);
  }
}

const featureContract = JSON.parse(await readFile(featureContractPath, "utf8"));
if (featureContract.schema !== "boobastudio.feature-contract.v1" || !Array.isArray(featureContract.features) || featureContract.features.length < 20) fail("feature contract is missing or incomplete");
for (const feature of featureContract.features || []) {
  if (!feature.id || !feature.entryPoint || !feature.template || !feature.test) fail("feature contract entry is incomplete: " + (feature.id || "unknown"));
  if (!fs.existsSync(path.join(root, feature.template))) fail("feature contract template is missing: " + feature.template);
}

if (manifest.id !== "boobastudio") {
  fail(`fork manifest ID is unexpected: ${manifest.id}`);
}

if (manifest.compatibility?.verified !== "14" || manifest.compatibility?.maximum !== "14") {
  fail("baseline Foundry compatibility declaration is not v14");
}

const jsFiles = ["bundle/modules/init.js", ...manifest.esmodules.filter((file) => file.split("?", 1)[0].endsWith(".js"))];
for (const relativePath of new Set(jsFiles)) {
  const filePath = relativePath.split("?", 1)[0];
  await new Promise((resolve) => {
    const child = spawn(process.execPath, ["--check", path.join(root, filePath)], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code !== 0) fail(`JavaScript syntax check failed: ${filePath}`);
      resolve();
    });
  });
}

const selectedEntry = manifest.esmodules.find((file) => /boobastudio-entry-v250-\d+[.]js$/.test(file.split("?", 1)[0]));
const selectedProvider = manifest.esmodules.find((file) => /boobastudio-provider-v254-\d+[.]js$/.test(file.split("?", 1)[0]));
if (!selectedEntry || !selectedProvider) fail("manifest does not select versioned BoobaStudio entry and provider bundles");
const entryBundle = await readFile(path.join(root, selectedEntry.split("?", 1)[0]), "utf8");
const providerBundle = await readFile(path.join(root, selectedProvider.split("?", 1)[0]), "utf8");
for (const marker of ["FoundryV12Shims", "FoundryV13Shims", "FoundryV14Shims", "foundry.applications?.ux?.DragDrop", "foundry.applications.handlebars.renderTemplate", "foundry.applications.api.DialogV2"]) {
  if (!entryBundle.includes(marker)) fail(`compatibility marker missing from shipped entry bundle: ${marker}`);
}
for (const marker of ["ttsReplicateInput", "Replicate", "google/gemini-3.1-flash-tts-preview", "Enceladus"]) {
  if (!providerBundle.includes(marker)) fail(`provider runtime marker missing from shipped provider bundle: ${marker}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`BoobaStudio package check passed: ${manifest.id} ${manifest.version}, Foundry ${manifest.compatibility.minimum}-${manifest.compatibility.maximum}`);
