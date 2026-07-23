const LEGACY_NAMESPACE = "cibola8";
const NAMESPACE = "boobastudio";
const MIGRATION_SETTING = "legacyMigrationComplete";

function rawSetting(scope, key) {
  const storage = game.settings?.storage?.get?.(scope);
  const entry = storage?.get?.(`${LEGACY_NAMESPACE}.${key}`);
  return entry?.value;
}

function hasSetting(scope, key) {
  const storage = game.settings?.storage?.get?.(scope);
  return storage?.has?.(`${LEGACY_NAMESPACE}.${key}`) ?? false;
}

async function copySetting(scope, key) {
  if (!hasSetting(scope, key)) return;
  const value = rawSetting(scope, key);
  if (value === undefined) return;
  try {
    await game.settings.set(NAMESPACE, key, foundry.utils.duplicate(value));
  } catch (error) {
    console.warn(`${NAMESPACE} | Could not migrate ${scope}.${key}`, error);
  }
}

async function migrateSettings() {
  if (game.settings.get(NAMESPACE, MIGRATION_SETTING)) return;
  const clientKeys = ["apikey", "openaiApiKey", "clientOnlyMode", "chatButton", "onboardingSeen", "radialMacroInstalled", "favoriteVoices"];
  const worldKeys = ["systemSettings", "apiConfigCache", "translationData", "permanentQueue", "radialMenuButtons", "embeddedDocumentsQueue", "max_c8_history", "wallDetection.maxWalls", "ActorPath", "ActorAutoDownscale", "ItemPath", "ItemAutoDownscale", "TilePath", "ScenePath", "SongPath", "SpeechPath"];
  for (const key of clientKeys) await copySetting("client", key);
  for (const key of worldKeys) await copySetting("world", key);
  await game.settings.set(NAMESPACE, MIGRATION_SETTING, true);
}

function migrateBrowserHistory() {
  try {
    const oldKey = `${LEGACY_NAMESPACE}-c8-${game.system.id}-${game.world.id}`;
    const newKey = `${NAMESPACE}-c8-${game.system.id}-${game.world.id}`;
    if (!localStorage.getItem(newKey)) {
      const oldHistory = localStorage.getItem(oldKey);
      if (oldHistory) localStorage.setItem(newKey, oldHistory);
    }
  } catch (error) {
    console.warn(`${NAMESPACE} | Could not migrate browser chat history`, error);
  }
}

async function migrateMacros() {
  for (const macro of game.macros?.contents ?? []) {
    if (macro.flags?.[LEGACY_NAMESPACE]?.radialMenu !== true) continue;
    try {
      await macro.update({ flags: { [NAMESPACE]: { radialMenu: true } } });
    } catch (error) {
      console.warn(`${NAMESPACE} | Could not migrate radial macro ${macro.id}`, error);
    }
  }
}

Hooks.once("init", () => game.settings.register(NAMESPACE, MIGRATION_SETTING, { scope: "world", config: false, type: Boolean, default: false }));
Hooks.once("ready", () => {
  // Foundry v14 can emit the ready hook before game.ready and the world-setting
  // write guard are both settled. Wait for the actual ready state before the
  // migration persists anything.
  const waitForReady = async () => {
    for (let attempt = 0; attempt < 80 && !game.ready; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!game.ready) throw new Error("Foundry did not reach game.ready before settings migration");
    await migrateSettings();
  };
  waitForReady().catch((error) => console.error(`${NAMESPACE} | Settings migration failed`, error));
  migrateBrowserHistory();
  migrateMacros().catch((error) => console.error(`${NAMESPACE} | Macro migration failed`, error));
});
