# Personal fork plan

## Constraints carried forward

BoobaStudio remains a native Foundry module. It will not add a backend, database, Docker service, authentication server, companion application, or arbitrary file writer. Existing Cibola UI, templates, document helpers, queue, asset paths, and Foundry integration remain the implementation starting point.

## Central identity and migration

Introduce one small identity/configuration block in the recovered runtime/build source:

```text
PROJECT_NAME = "BoobaStudio"
PROJECT_ID = "boobastudio"       # final internal ID can still be selected
LEGACY_ID = "cibola8"
```

The current module ID is `cibola8`; the final new ID is intentionally not chosen in Phase 0. Rebranding must include the manifest, runtime paths, settings, sockets, document flags/types, localization namespace, CSS/asset links, macro commands, repository/manifest links, and author metadata. A migration must import old settings, localStorage history, voice flags, thread page types, radial buttons, and configured file paths without deleting old data.

## Smallest viable vertical slice

1. Copy the baseline and recover/establish a maintainable source/build path.
2. Add the centralized project identity and compatibility resolver without changing UI behavior.
3. Change the manifest to BoobaStudio metadata and test module loading in a clean Foundry 14 world.
4. Replace account/subscription gating with a local provider-enabled state while preserving the existing settings/application lifecycle.
5. Implement one OpenAI-compatible text adapter behind the existing `query`/`chat` service signature. Settings: provider, base URL, client API key, model, timeout, temperature, max tokens, JSON mode, and custom headers. Default base URL should be OpenAI-compatible but user-configurable for OpenRouter, Ollama, LM Studio, or a compatible proxy.
6. Keep the existing random/prose text UI and response callback format. Prove prompt submission, preview/result rendering, Journal insertion, and existing history persistence.
7. Add explicit error classification for timeout, CORS/network, unauthorized, rate limit, provider error, and invalid response.
8. Only after this passes, add OpenRouter/OpenAI-compatible variants, then direct OpenAI, Ollama, LM Studio, Anthropic, and Gemini adapters incrementally.

The slice deliberately excludes image/audio/vector/pack replacement. The existing direct OpenAI image path can be the next slice because it already has an adapter and UI contract, but it should follow a passing text workflow.

## Provider strategy

Keep the existing façade and introduce the smallest provider registry at its current service boundary:

```text
existing application -> existing generation façade -> provider adapter -> configured endpoint
```

Adapters should normalize text to the existing `result`/`message` shapes, images to the existing image/job shape, and audio to existing file/result fields. They must not leak secrets through sockets, flags, exports, or logs. Provider capabilities should drive model selectors and disable unsupported toolbar actions rather than letting unsupported requests reach an endpoint.

## Hosted-service disposition

- Disable Cibola account, Patreon, credits, remote feature flags, remote config, telemetry-like reporting, community gallery, hosted packs, and hosted vector store in local mode.
- Do not delete the old code until every caller and initialization side effect has a local equivalent or an explicit disabled state.
- Preserve optional hosted mode only if it can be isolated and the user deliberately enables it; the default personal fork must not require `app.cibola.world`.
- Replace account identity with the current Foundry user/world context and replace subscription gating with provider capability/settings.

## Subsequent phases

1. Direct OpenAI Images through existing image UI, preview/gallery/file upload, actor portrait, token, tile, and scene application.
2. Image editor tools: variations, background removal, inpainting/outpainting, and upscale according to provider capabilities.
3. Local/provider text features: names, scene descriptions, document generation, threads, and prompt templates. AI document translation is explicitly deferred; Foundry UI localization remains in scope.
4. OpenAI TTS, then ElevenLabs direct adapter if CORS/API behavior is acceptable.
5. Map generation and existing local wall detection/scene creation verification.
6. Optional local gallery/history and local thread/vector design only if existing hosted contracts cannot be adapted without duplicating architecture.
7. Foundry 13/14 compatibility test matrix and release ZIP packaging.

## Review gates

Every phase must report modified files, preserve the baseline commit, run available syntax/build checks, and include manual Foundry steps. A phase is complete only when a clean world and a migrated world both pass the affected workflow, and no request in that workflow reaches a Cibola-hosted service.

## Phase 0 conclusion

The fork is viable, but source recovery/maintainable build tooling is the first technical prerequisite. The best initial proof is the existing text-generation path because the bundle already has a direct OpenAI client mode, the UI has stable preview/insertion behavior, and Journal/chat persistence is already native to Foundry/local browser storage. Broad provider coverage should wait until that slice is proven.
