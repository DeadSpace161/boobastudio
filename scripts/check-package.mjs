import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const manifestPath = path.join(root, "module.json");

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
  try {
    await access(path.join(root, relativePath));
  } catch {
    fail(`manifest references missing file: ${relativePath}`);
  }
}

for (const language of manifest.languages ?? []) {
  try {
    JSON.parse(await readFile(path.join(root, language.path), "utf8"));
  } catch (error) {
    fail(`invalid language file ${language.path}: ${error.message}`);
  }
}

if (manifest.id !== "boobastudio") {
  fail(`fork manifest ID is unexpected: ${manifest.id}`);
}

if (manifest.compatibility?.verified !== "14" || manifest.compatibility?.maximum !== "14") {
  fail("baseline Foundry compatibility declaration is not v14");
}

const jsFiles = ["bundle/modules/init.js", ...manifest.esmodules.filter((file) => file.endsWith(".js"))];
for (const relativePath of new Set(jsFiles)) {
  await new Promise((resolve) => {
    const child = spawn(process.execPath, ["--check", path.join(root, relativePath)], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code !== 0) fail(`JavaScript syntax check failed: ${relativePath}`);
      resolve();
    });
  });
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`BoobaStudio package check passed: ${manifest.id} ${manifest.version}, Foundry ${manifest.compatibility.minimum}-${manifest.compatibility.maximum}`);
