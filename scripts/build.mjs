import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const output = path.resolve(process.argv[2] ?? path.join(root, "dist", "boobastudio"));

if (!output.startsWith(path.join(root, "dist") + path.sep)) {
  throw new Error(`Build output must remain inside ${path.join(root, "dist")}`);
}

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(root, "scripts", "check-package.mjs")], { stdio: "inherit" });
  child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`package check exited with ${code}`))));
});

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const entries = ["bundle", "lang", "module.json", "packs", "styles", "templates"];
for (const entry of entries) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}

// Expose the existing generic image application to compatibility bridges.
// The original bundle keeps this class private, although actor and item
// workflows already use its implementation internally.
const entryPath = path.join(output, "bundle", "modules", "boobastudio-entry-v246.js");
const entrySource = await readFile(entryPath, "utf8");
const privateApi = "api={DirectChat:new Ms,menu:ct.render,experimentalFeatures:!1,RadialWidget:us}";
const publicApi = "api={DirectChat:new Ms,menu:ct.render,experimentalFeatures:!1,RadialWidget:us,ImageGenerator:Ke}";
if (!entrySource.includes(privateApi)) throw new Error("Expected BoobaStudio entry API signature was not found");
await writeFile(entryPath, entrySource.replace(privateApi, publicApi).replaceAll("Cibola 8", "BoobaStudio"));

const manifest = JSON.parse(await readFile(path.join(output, "module.json"), "utf8"));
await writeFile(path.join(output, "module.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built package at ${output}`);
