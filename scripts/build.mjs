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
const entryPath = path.join(output, "bundle", "modules", "boobastudio-entry-v250.js");
const entrySource = await readFile(entryPath, "utf8");
const privateApi = "api={DirectChat:new Ms,menu:ct.render,experimentalFeatures:!1,RadialWidget:us}";
const publicApi = "api={DirectChat:new Ms,menu:ct.render,experimentalFeatures:!1,RadialWidget:us,ImageGenerator:Ke}";
if (!entrySource.includes(privateApi)) throw new Error("Expected BoobaStudio entry API signature was not found");
const brandedEntry = entrySource.replace(privateApi, publicApi).replaceAll("Cibola 8", "BoobaStudio");
const localChatString = "return r?{status:\"done\",message:r}:{status:\"error\",errors:[\"OpenAI response missing output text.\"]}";
const localChatObject = "return r?{status:\"done\",message:{role:\"assistant\",content:r}}:{status:\"error\",errors:[\"OpenAI response missing output text.\"]}";
if (!brandedEntry.includes(localChatString)) throw new Error("Expected local chat response signature was not found");
const localChatGate = "if(await s.isConnected(!1,!1)){let{TextGenerationService:S}";
const localChatGateReplacement = "if(!(typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())&&await s.isConnected(!1,!1)){let{TextGenerationService:S}";
const localChatEntry = brandedEntry.replace(localChatString, localChatObject);
if (!localChatEntry.includes(localChatGate)) throw new Error("Expected local chat connection gate was not found");
const directChatGate = "async chat(t){let e=await C.isConnected(!1,!1);";
const directChatGateReplacement = "async chat(t){let e=typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured()?false:await C.isConnected(!1,!1);";
const patchedChatEntry = localChatEntry.replace(localChatGate, localChatGateReplacement);
if (!patchedChatEntry.includes(directChatGate)) throw new Error("Expected direct chat connection gate was not found");
const noPromptGate = "if(!await r.ensureEnabledForSession()){e({status:\"error\",errors:[game.i18n?.localize?.(\"boobastudio.error.noConnection\")??\"No connection.\"]});return}";
const noPromptGateReplacement = "if(!(typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())&&!await r.ensureEnabledForSession()){e({status:\"error\",errors:[game.i18n?.localize?.(\"boobastudio.error.noConnection\")??\"No connection.\"]});return}";
const directPatchedEntry = patchedChatEntry.replace(directChatGate, directChatGateReplacement);
if (!directPatchedEntry.includes(noPromptGate)) throw new Error("Expected local chat confirmation gate was not found");
const galleryPageMethod = "static async getBrowserPage(t,e,i={}){let{AuthService:a}=await Promise.resolve().then(()=>(B(),H));await a.executeOperation(e,async()=>{let s=new URL(a.route(`browse/${t}`));Object.keys(i).forEach(n=>s.searchParams.append(n,i[n]));let o=await a.fetchJsonWithTimeout(s,a.getRequestObject());e(o,{})})}";
const galleryPageReplacement = "static async getBrowserPage(t,e,i={}){if(typeof globalThis.__boobastudioLocalGalleryPage===\"function\"&&await globalThis.__boobastudioLocalGalleryPage(t,e,i))return;let{AuthService:a}=await Promise.resolve().then(()=>(B(),H));await a.executeOperation(e,async()=>{let s=new URL(a.route(`browse/${t}`));Object.keys(i).forEach(n=>s.searchParams.append(n,i[n]));let o=await a.fetchJsonWithTimeout(s,a.getRequestObject());e(o,{})})}";
const galleryDeleteMethod = "static async deletePrediction(t,e,i=void 0){let{AuthService:a}=await Promise.resolve().then(()=>(B(),H));await a.executeOperation(e,async()=>{let s=i||`remove/${t}`,o=await a.fetchJsonWithTimeout(a.route(s),a.deleteRequestObject());e(o)})}";
const galleryDeleteReplacement = "static async deletePrediction(t,e,i=void 0){if(typeof globalThis.__boobastudioLocalGalleryDelete===\"function\"&&await globalThis.__boobastudioLocalGalleryDelete(t,e))return;let{AuthService:a}=await Promise.resolve().then(()=>(B(),H));await a.executeOperation(e,async()=>{let s=i||`remove/${t}`,o=await a.fetchJsonWithTimeout(a.route(s),a.deleteRequestObject());e(o)})}";
const galleryAccess = "static hasAccess(){return C.userInfo()?.alive??!1}";
const galleryAccessReplacement = "static hasAccess(){return !!(C.userInfo()?.alive||typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())}";
const galleryContext = "e.canUseGallery=!!e.userInfo.alive,";
const galleryContextReplacement = "e.canUseGallery=!!(e.userInfo.alive||typeof globalThis.__boobastudio.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured()),";
const galleryEntry = directPatchedEntry.replace(noPromptGate, noPromptGateReplacement);
if (!galleryEntry.includes(galleryPageMethod) || !galleryEntry.includes(galleryDeleteMethod) || !galleryEntry.includes(galleryAccess) || !galleryEntry.includes(galleryContext)) throw new Error("Expected local gallery integration signatures were not found");
await writeFile(entryPath, galleryEntry.replace(galleryPageMethod, galleryPageReplacement).replace(galleryDeleteMethod, galleryDeleteReplacement).replace(galleryAccess, galleryAccessReplacement).replace(galleryContext, galleryContext.replace("!!e.userInfo.alive", "!!(e.userInfo.alive||typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())")));

const manifest = JSON.parse(await readFile(path.join(output, "module.json"), "utf8"));
await writeFile(path.join(output, "module.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built package at ${output}`);
