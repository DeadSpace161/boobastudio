/* Foundry v14 ApplicationV2 compatibility bridge for document sheets.
 * Some systems do not emit the legacy document-sheet header hooks, so reuse
 * the existing image generator for every document type supported by Cibola.
 */
function addBoobaStudioDocumentControl(app) {
  const document = app?.object ?? app?.document;
  const supported = new Set(["Actor", "Item", "JournalEntry", "RollTable", "Tile"]);
  if (!supported.has(document?.documentName) || !document?.isOwner) return;
  const local = globalThis.__boobastudioLocalProviderConfigured?.() === true;
  if (!globalThis.game?.user?.isGM && !local) return;
  const root = app?.element;
  const header = root?.querySelector?.(".window-header") ?? root?.querySelector?.("header");
  if (!header || header.querySelector(".boobastudio-document-control")) return;
  const button = globalThis.document?.createElement?.("button");
  if (!button) return;
  button.type = "button";
  button.className = "header-control icon fa-solid fa-wand-magic-sparkles boobastudio-document-control";
  button.dataset.tooltip = "BoobaStudio";
  button.setAttribute("aria-label", "BoobaStudio");
  button.addEventListener("click", () => {
    const api = globalThis.game?.modules?.get("boobastudio")?.api;
    if (!api) {
      globalThis.ui?.notifications?.warn?.("BoobaStudio is not available yet.");
      return;
    }
    if (document.documentName === "Actor") {
      api.__boobaActorDocument = document;
      installRadialFallback(document);
      typeof api.menu === "function"
        ? api.menu()
        : globalThis.ui?.notifications?.warn?.("BoobaStudio menu is not available yet.");
      return;
    }
    if (typeof api.ImageGenerator === "function") new api.ImageGenerator(document, app).render(true);
  });
  const close = header.querySelector('[data-action="close"]');
  header.insertBefore(button, close || null);
}

function openExistingSceneImageTools() {
  const scene = globalThis.canvas?.scene;
  if (!scene?.sheet) {
    globalThis.ui?.notifications?.warn?.("BoobaStudio requires an active Scene for image tools.");
    return;
  }
  scene.sheet.render(true);
  setTimeout(() => globalThis.document?.querySelector?.(".boobastudio-inject-btn")?.click(), 350);
}

function installRadialFallback(actorDocument = null) {
  const module = globalThis.game?.modules?.get("boobastudio");
  const api = module?.api;
  if (!api || typeof api.menu !== "function" || typeof api.RadialWidget !== "function" || api.__boobaRadialFallback) return;
  api.__boobaRadialFallback = true;
  const originalMenu = api.menu;
  api.menu = async (...args) => {
    const result = await originalMenu(...args);
    setTimeout(() => {
      const radial = globalThis.document?.querySelector?.(".radial-menu-container");
      if (!radial || radial.querySelector(".radial-button:not(.center-button)")) return;
      radial.closest(".radial-modal")?.remove?.();
      const buttons = [
        { content: "boobastudio.AiImageGen.title", icon: "fa-image", callback: () => {
          const target = actorDocument || api.__boobaActorDocument;
          if (target && typeof api.ImageGenerator === "function") {
            new api.ImageGenerator(target, target.sheet).render(true);
          } else openExistingSceneImageTools();
        } },
        { content: "boobastudio.AiChat.newChat", icon: "fa-comment", callback: () => {
          const chat = globalThis.document?.querySelector?.("#chat-message");
          if (chat && api.DirectChat) {
            api.DirectChat.setChatInputValue(chat, "/c8 ");
            api.DirectChat.focusChatInput(chat);
          }
        } },
        { content: "boobastudio.configuration", icon: "fa-cogs", callback: () => globalThis.game?.settings?.sheet?.render?.(true) },
      ];
      new api.RadialWidget(buttons, { content: "BoobaStudio", icon: "fa-wand-magic-sparkles" }).render();
    }, 50);
    return result;
  };
}

Hooks.on("renderApplication", (app) => addBoobaStudioDocumentControl(app));
Hooks.on("renderApplicationV2", (app) => addBoobaStudioDocumentControl(app));
Hooks.once("ready", () => {
  // The main bundle publishes module.api during its own ready sequence on
  // Foundry v14. Retry briefly so load order cannot leave the fallback inert.
  for (const delay of [0, 250, 1000, 2500]) setTimeout(installRadialFallback, delay);
});
