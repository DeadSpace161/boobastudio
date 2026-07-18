import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const output = path.resolve(process.argv[2] ?? path.join(root, "dist", "cibola8"));

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

const manifest = JSON.parse(await readFile(path.join(output, "module.json"), "utf8"));
await writeFile(path.join(output, "module.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built byte-preserving baseline package at ${output}`);
