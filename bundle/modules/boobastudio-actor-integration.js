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

Hooks.on("renderApplication", (app) => addBoobaStudioActorControl(app));
Hooks.on("renderApplicationV2", (app) => addBoobaStudioActorControl(app));
