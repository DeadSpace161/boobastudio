/* Foundry v14 ApplicationV2 compatibility bridge for actor sheets.
 * The inherited renderActorSheet hook is not emitted by some system sheets.
 * Reuse the existing BoobaStudio menu instead of duplicating any generator UI.
 */
function addBoobaStudioActorControl(app) {
  const actorDocument = app?.object ?? app?.document;
  if (actorDocument?.documentName !== "Actor" || !actorDocument?.isOwner) return;
  const root = app?.element;
  const header = root?.querySelector?.(".window-header");
  if (!header || header.querySelector(".boobastudio-actor-control")) return;
  const button = globalThis.document?.createElement?.("button");
  if (!button) return;
  button.type = "button";
  button.className = "header-control icon fa-solid fa-wand-magic-sparkles boobastudio-actor-control";
  button.dataset.tooltip = "BoobaStudio";
  button.setAttribute("aria-label", "BoobaStudio");
  button.addEventListener("click", () => {
    const menu = globalThis.game?.modules?.get("boobastudio")?.api?.menu;
    if (typeof menu === "function") menu();
    else globalThis.ui?.notifications?.warn?.("BoobaStudio menu is not available yet.");
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

function installRadialFallback() {
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
        { content: "boobastudio.AiImageGen.title", icon: "fa-image", callback: openExistingSceneImageTools },
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

Hooks.on("renderApplication", (app) => addBoobaStudioActorControl(app));
Hooks.on("renderApplicationV2", (app) => addBoobaStudioActorControl(app));
Hooks.once("ready", installRadialFallback);
