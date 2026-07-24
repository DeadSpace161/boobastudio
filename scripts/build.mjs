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
const localImageSessionGate = "if(!await m.ensureEnabledForSession())return a(!1);";
const localImageSessionGateReplacement = "if(!(typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())&&!await m.ensureEnabledForSession())return a(!1);";
const patchedChatEntry = localChatEntry.replace(localChatGate, localChatGateReplacement);
if (!patchedChatEntry.includes(directChatGate)) throw new Error("Expected direct chat connection gate was not found");
const noPromptGate = "if(!await r.ensureEnabledForSession()){e({status:\"error\",errors:[game.i18n?.localize?.(\"boobastudio.error.noConnection\")??\"No connection.\"]});return}";
const noPromptGateReplacement = "if(!(typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())&&!await r.ensureEnabledForSession()){e({status:\"error\",errors:[game.i18n?.localize?.(\"boobastudio.error.noConnection\")??\"No connection.\"]});return}";
const directConfirmationGate = "if(!e&&!await Ii.ensureEnabledForSession())return ui.notifications.error(_.localize(\"boobastudio.error.noConnection\"));";
const directConfirmationReplacement = "if(!e&&!(typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())&&!await Ii.ensureEnabledForSession())return ui.notifications.error(_.localize(\"boobastudio.error.noConnection\"));";
const clientOnlyGate = "if(!!!game.settings.get(\"boobastudio\",\"clientOnlyMode\")){e({status:\"error\",errors:[game.i18n?.localize?.(\"boobastudio.error.noConnection\")??\"No connection.\"]});return}";
const clientOnlyGateReplacement = "if(!(typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())&&!game.settings.get(\"boobastudio\",\"clientOnlyMode\")){e({status:\"error\",errors:[game.i18n?.localize?.(\"boobastudio.error.noConnection\")??\"No connection.\"]});return}";
const chatModeGate = "if(String(i||\"\")!==\"chat\"){e({status:\"error\",errors:[game.i18n?.localize?.(\"boobastudio.error.noConnection\")??\"No connection.\"]});return}";
const chatModeGateReplacement = "if(!(typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())&&String(i||\"\")!==\"chat\"){e({status:\"error\",errors:[game.i18n?.localize?.(\"boobastudio.error.noConnection\")??\"No connection.\"]});return}";
const enhanceMethod = "static async enhance(t,e,i,a={}){return await f(this,Qo,ru).call(this,\"enhance\",t,e,i,a)}";
const enhanceReplacement = "static async enhance(t,e,i,a={}){if(typeof globalThis.__boobastudioLocalEnhance===\"function\"&&await globalThis.__boobastudioLocalEnhance(t,e,i,a))return;return await f(this,Qo,ru).call(this,\"enhance\",t,e,i,a)}";
const describeMethod = "static async describe(t,e){let{AuthService:i}=await Promise.resolve().then(()=>(B(),H));await i.executeOperation(e,async()=>{let a=foundry.utils.mergeObject({body:JSON.stringify({data:encodeURIComponent(JSON.stringify(t))})},i.postRequestObject()),s=new te(\"analyzeImage\",e,a);await this.consumeRequest(s)})}";
const describeReplacement = "static async describe(t,e){if(typeof globalThis.__boobastudioLocalDescribe===\"function\"&&await globalThis.__boobastudioLocalDescribe(t,e))return;let{AuthService:i}=await Promise.resolve().then(()=>(B(),H));await i.executeOperation(e,async()=>{let a=foundry.utils.mergeObject({body:JSON.stringify({data:encodeURIComponent(JSON.stringify(t))})},i.postRequestObject()),s=new te(\"analyzeImage\",e,a);await this.consumeRequest(s)})}";
const buildPromptsMethod = "static async buildPrompts(t,e){let{AuthService:i}=await Promise.resolve().then(()=>(B(),H));await i.executeOperation(e,async()=>{let a=foundry.utils.mergeObject({body:JSON.stringify({data:encodeURIComponent(JSON.stringify(t))})},i.postRequestObject()),s=new te(\"buildprompts\",e,a);await this.consumeRequest(s)})}";
const buildPromptsReplacement = "static async buildPrompts(t,e){if(typeof globalThis.__boobastudioLocalBuildPrompts===\"function\"&&await globalThis.__boobastudioLocalBuildPrompts(t,e))return;let{AuthService:i}=await Promise.resolve().then(()=>(B(),H));await i.executeOperation(e,async()=>{let a=foundry.utils.mergeObject({body:JSON.stringify({data:encodeURIComponent(JSON.stringify(t))})},i.postRequestObject()),s=new te(\"buildprompts\",e,a);await this.consumeRequest(s)})}";
const generateTTSMethod = "static async generateTTS(t,e,i,a,s={}){let{AuthService:o}=await Promise.resolve().then(()=>(B(),H)),{QueueManager:n}=await Promise.resolve().then(()=>(Ai(),ca));await o.executeOperation(a,async()=>{let r=o.buildMetadata(s);if(!await o.confirmEstimate({job_type:\"tts\",model:i,prompt:JSON.stringify(t),behavior:e,metadata:r}))return a(!1);let u=foundry.utils.mergeObject({body:JSON.stringify({prompt:JSON.stringify(t),behavior:e,metadata:r,model:i})},o.postRequestObject()),h=new te(\"tts\",a,u);await this.consumeRequest(h)})}";
const generateTTSReplacement = "static async generateTTS(t,e,i,a,s={}){if(typeof globalThis.__boobastudioLocalGenerateTTS===\"function\"&&await globalThis.__boobastudioLocalGenerateTTS(t,e,i,a))return;let{AuthService:o}=await Promise.resolve().then(()=>(B(),H)),{QueueManager:n}=await Promise.resolve().then(()=>(Ai(),ca));await o.executeOperation(a,async()=>{let r=o.buildMetadata(s);if(!await o.confirmEstimate({job_type:\"tts\",model:i,prompt:JSON.stringify(t),behavior:e,metadata:r}))return a(!1);let u=foundry.utils.mergeObject({body:JSON.stringify({prompt:JSON.stringify(t),behavior:e,metadata:r,model:i})},o.postRequestObject()),h=new te(\"tts\",a,u);await this.consumeRequest(h)})}";
const apiConfigLoad = "Ge.loadOnce().catch(t=>console.warn(\"BoobaStudio: failed to load api config\",t))";
const apiConfigLoadReplacement = "(typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured()?Promise.resolve(null):Ge.loadOnce()).catch(t=>console.warn(\"BoobaStudio: failed to load api config\",t))";
const directPatchedEntry = patchedChatEntry.replace(directChatGate, directChatGateReplacement);
if (!directPatchedEntry.includes(noPromptGate) || !directPatchedEntry.includes(directConfirmationGate) || !directPatchedEntry.includes(clientOnlyGate) || !directPatchedEntry.includes(chatModeGate) || !directPatchedEntry.includes(enhanceMethod) || !directPatchedEntry.includes(describeMethod) || !directPatchedEntry.includes(buildPromptsMethod) || !directPatchedEntry.includes(generateTTSMethod) || !directPatchedEntry.includes(localImageSessionGate) || !directPatchedEntry.includes(apiConfigLoad)) throw new Error("Expected local chat/config gates were not found");
const imagePatchedEntry = directPatchedEntry.replace(localImageSessionGate, localImageSessionGateReplacement);
const galleryPageMethod = "static async getBrowserPage(t,e,i={}){let{AuthService:a}=await Promise.resolve().then(()=>(B(),H));await a.executeOperation(e,async()=>{let s=new URL(a.route(`browse/${t}`));Object.keys(i).forEach(n=>s.searchParams.append(n,i[n]));let o=await a.fetchJsonWithTimeout(s,a.getRequestObject());e(o,{})})}";
const galleryPageReplacement = "static async getBrowserPage(t,e,i={}){if(typeof globalThis.__boobastudioLocalGalleryPage===\"function\"&&await globalThis.__boobastudioLocalGalleryPage(t,e,i))return;let{AuthService:a}=await Promise.resolve().then(()=>(B(),H));await a.executeOperation(e,async()=>{let s=new URL(a.route(`browse/${t}`));Object.keys(i).forEach(n=>s.searchParams.append(n,i[n]));let o=await a.fetchJsonWithTimeout(s,a.getRequestObject());e(o,{})})}";
const galleryDeleteMethod = "static async deletePrediction(t,e,i=void 0){let{AuthService:a}=await Promise.resolve().then(()=>(B(),H));await a.executeOperation(e,async()=>{let s=i||`remove/${t}`,o=await a.fetchJsonWithTimeout(a.route(s),a.deleteRequestObject());e(o)})}";
const galleryDeleteReplacement = "static async deletePrediction(t,e,i=void 0){if(typeof globalThis.__boobastudioLocalGalleryDelete===\"function\"&&await globalThis.__boobastudioLocalGalleryDelete(t,e))return;let{AuthService:a}=await Promise.resolve().then(()=>(B(),H));await a.executeOperation(e,async()=>{let s=i||`remove/${t}`,o=await a.fetchJsonWithTimeout(a.route(s),a.deleteRequestObject());e(o)})}";
const galleryShareMethod = "static async share(t,e){let{AuthService:i}=await Promise.resolve().then(()=>(B(),H));await i.executeOperation(e,async()=>{let a=await i.fetchJsonWithTimeout(i.route(`share/${t}`),i.postRequestObject());e(a)})}";
const galleryShareReplacement = "static async share(t,e){if(typeof globalThis.__boobastudioLocalGalleryShare===\"function\"&&await globalThis.__boobastudioLocalGalleryShare(e))return;let{AuthService:i}=await Promise.resolve().then(()=>(B(),H));await i.executeOperation(e,async()=>{let a=await i.fetchJsonWithTimeout(i.route(`share/${t}`),i.postRequestObject());e(a)})}";
const galleryToggleMethod = "static async togglePublic(t,e){let{AuthService:i}=await Promise.resolve().then(()=>(B(),H));await i.executeOperation(e,async()=>{let a=await i.fetchJsonWithTimeout(i.route(`togglePublic/${t}`),i.postRequestObject());e(a)})}";
const galleryToggleReplacement = "static async togglePublic(t,e){if(typeof globalThis.__boobastudioLocalGalleryTogglePublic===\"function\"&&await globalThis.__boobastudioLocalGalleryTogglePublic(e))return;let{AuthService:i}=await Promise.resolve().then(()=>(B(),H));await i.executeOperation(e,async()=>{let a=await i.fetchJsonWithTimeout(i.route(`togglePublic/${t}`),i.postRequestObject());e(a)})}";
const packActionMethod = "async quickAddToPack(e,i){e.stopPropagation();let s=$(i).closest(\".gallery-item\").data(\"id\");!s||Se.showAddToPack(i,s,e)}";
const packActionReplacement = "async quickAddToPack(e,i){e.stopPropagation();if(typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured()){ui.notifications?.warn(\"Hosted packs are unavailable in BoobaStudio local mode.\");return}let s=$(i).closest(\".gallery-item\").data(\"id\");!s||Se.showAddToPack(i,s,e)}";
const packCatalogMethod = "async showPackCatalog(){this.packView=\"catalog\"";
const packCatalogReplacement = "async showPackCatalog(){if(typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured()){ui.notifications?.warn(\"Hosted packs are unavailable in BoobaStudio local mode.\");return}this.packView=\"catalog\"";
const galleryAccess = "static hasAccess(){return C.userInfo()?.alive??!1}";
const galleryAccessReplacement = "static hasAccess(){return !!(C.userInfo()?.alive||typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())}";
const galleryContext = "e.canUseGallery=!!e.userInfo.alive,";
const galleryContextReplacement = "e.canUseGallery=!!(e.userInfo.alive||typeof globalThis.__boobastudio.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured()),";
const galleryEntry = directPatchedEntry.replace(directConfirmationGate, directConfirmationReplacement).replace(chatModeGate, chatModeGateReplacement).replace(clientOnlyGate, clientOnlyGateReplacement).replace(noPromptGate, noPromptGateReplacement);
if (!galleryEntry.includes(galleryPageMethod) || !galleryEntry.includes(galleryDeleteMethod) || !galleryEntry.includes(galleryShareMethod) || !galleryEntry.includes(galleryToggleMethod) || !galleryEntry.includes(packActionMethod) || !galleryEntry.includes(packCatalogMethod) || !galleryEntry.includes(galleryAccess) || !galleryEntry.includes(galleryContext)) throw new Error("Expected local gallery integration signatures were not found");
const vectorizeMethod = "static async vectorize(t,e,i=void 0){let{AuthService:a}=await Promise.resolve().then(()=>(B(),H));await a.executeOperation(e,async()=>{t.append(\"metadata\",JSON.stringify(a.buildMetadata({})));let s=new URL(a.route(\"vector/vectorize\"));await f(this,il,sf).call(this,t,s,e,i)})}";
const vectorizeReplacement = "static async vectorize(t,e,i=void 0){if(typeof globalThis.__boobastudioLocalVectorize===\"function\"&&await globalThis.__boobastudioLocalVectorize(t,e,i))return;let{AuthService:a}=await Promise.resolve().then(()=>(B(),H));await a.executeOperation(e,async()=>{t.append(\"metadata\",JSON.stringify(a.buildMetadata({})));let s=new URL(a.route(\"vector/vectorize\"));await f(this,il,sf).call(this,t,s,e,i)})}";
const listVectorsMethod = "static async listVectors(t){let{AuthService:e}=await Promise.resolve().then(()=>(B(),H));await e.executeOperation(t,async()=>{let i=foundry.utils.mergeObject({body:JSON.stringify({gamesystem_id:game.system.id,gamesystem_title:game.system.title})},e.postRequestObject()),a=e.route(\"vector/list\"),s=await e.fetchJsonWithTimeout(a,i);t(s)})}";
const listVectorsReplacement = "static async listVectors(t){if(typeof globalThis.__boobastudioLocalVectorList===\"function\"&&await globalThis.__boobastudioLocalVectorList(t))return;let{AuthService:e}=await Promise.resolve().then(()=>(B(),H));await e.executeOperation(t,async()=>{let i=foundry.utils.mergeObject({body:JSON.stringify({gamesystem_id:game.system.id,gamesystem_title:game.system.title})},e.postRequestObject()),a=e.route(\"vector/list\"),s=await e.fetchJsonWithTimeout(a,i);t(s)})}";
const listAllVectorsMethod = "static async listAllVectors(t){let{AuthService:e}=await Promise.resolve().then(()=>(B(),H));await e.executeOperation(t,async()=>{let i=foundry.utils.mergeObject({body:JSON.stringify({gamesystem_id:game.system.id,gamesystem_title:game.system.title})},e.postRequestObject()),a=e.route(\"vector/list_all\"),s=await e.fetchJsonWithTimeout(a,i);t(s)})}";
const listAllVectorsReplacement = "static async listAllVectors(t){if(typeof globalThis.__boobastudioLocalVectorList===\"function\"&&await globalThis.__boobastudioLocalVectorList(t))return;let{AuthService:e}=await Promise.resolve().then(()=>(B(),H));await e.executeOperation(t,async()=>{let i=foundry.utils.mergeObject({body:JSON.stringify({gamesystem_id:game.system.id,gamesystem_title:game.system.title})},e.postRequestObject()),a=e.route(\"vector/list_all\"),s=await e.fetchJsonWithTimeout(a,i);t(s)})}";
const removeVectorMethod = "static async removeVectorFile(t,e){let{AuthService:i}=await Promise.resolve().then(()=>(B(),H));await i.executeOperation(e,async()=>{let a=`vector/deleteVector?id=${t}`,s=await i.fetchJsonWithTimeout(i.route(a),i.deleteRequestObject());e(s)})}";
const removeVectorReplacement = "static async removeVectorFile(t,e){if(typeof globalThis.__boobastudioLocalVectorDelete===\"function\"&&await globalThis.__boobastudioLocalVectorDelete(t,e))return;let{AuthService:i}=await Promise.resolve().then(()=>(B(),H));await i.executeOperation(e,async()=>{let a=`vector/deleteVector?id=${t}`,s=await i.fetchJsonWithTimeout(i.route(a),i.deleteRequestObject());e(s)})}";
const threadAccountGate = "if(t.userInfo=C.userInfo(),!t.userInfo.alive){";
const threadAccountReplacement = "if(t.userInfo=C.userInfo(),!(t.userInfo.alive||typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())){";
const threadDragDropGate = "return this.isEditable&&C.userInfo().alive&&C.userInfo().level>0";
const threadDragDropReplacement = "return this.isEditable&&(C.userInfo().alive||typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())&&(C.userInfo().level>0||game.user?.isGM)";
const threadUploadGate = "return this.isWritable&&C.userInfo().level>0&&t.advanced";
const threadUploadReplacement = "return this.isWritable&&(C.userInfo().level>0||game.user?.isGM||typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())&&t.advanced";
let vectorEntry = imagePatchedEntry.replace(enhanceMethod, enhanceReplacement).replace(describeMethod, describeReplacement).replace(buildPromptsMethod, buildPromptsReplacement).replace(generateTTSMethod, generateTTSReplacement).replace(apiConfigLoad, apiConfigLoadReplacement).replace(galleryPageMethod, galleryPageReplacement).replace(galleryDeleteMethod, galleryDeleteReplacement).replace(galleryShareMethod, galleryShareReplacement).replace(galleryToggleMethod, galleryToggleReplacement).replace(packActionMethod, packActionReplacement).replace(packCatalogMethod, packCatalogReplacement).replace(galleryAccess, galleryAccessReplacement).replace(galleryContext, galleryContext.replace("!!e.userInfo.alive", "!!(e.userInfo.alive||typeof globalThis.__boobastudioLocalProviderConfigured===\"function\"&&globalThis.__boobastudioLocalProviderConfigured())"));
for (const [original, replacement] of [[vectorizeMethod, vectorizeReplacement], [listVectorsMethod, listVectorsReplacement], [listAllVectorsMethod, listAllVectorsReplacement], [removeVectorMethod, removeVectorReplacement]]) {
  if (!vectorEntry.includes(original)) throw new Error("Expected vector integration signature was not found");
  vectorEntry = vectorEntry.replace(original, replacement);
}
for (const [original, replacement] of [[threadAccountGate, threadAccountReplacement], [threadDragDropGate, threadDragDropReplacement], [threadUploadGate, threadUploadReplacement]]) {
  if (!vectorEntry.includes(original)) throw new Error("Expected thread local-access signature was not found");
  vectorEntry = vectorEntry.replace(original, replacement);
}
await writeFile(entryPath, vectorEntry);

const manifest = JSON.parse(await readFile(path.join(output, "module.json"), "utf8"));
await writeFile(path.join(output, "module.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built package at ${output}`);
