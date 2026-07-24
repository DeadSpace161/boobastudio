# BoobaStudio current implementation status

This status reflects the locally built package prepared as version **2.2.76**. The public server remains on 2.2.75 until repository write access is restored.

## Verified

- Foundry v14 Build 363 loads the module from the normal module installer.
- The existing Cibola application structure, templates, settings, document hooks, image editor, history, gallery, and file handling remain in use.
- Client-scoped provider settings support OpenAI-compatible endpoints, OpenRouter, Ollama, LM Studio, Anthropic, Gemini, ComfyUI, Stability AI, Replicate, OpenAI TTS, and ElevenLabs.
- Existing prose generation can submit a prompt, render a result, insert it into a Journal editor, and persist the JournalEntryPage update.
- The existing direct `/c8` chat path bypasses the hosted account-connectivity check when a local provider is configured; its local response is normalized to the existing chat message object and browser-local history contract.
- Direct `/c8` chat no longer requires the legacy client-only-mode toggle or hosted confirmation gate when a local provider is explicitly configured; the legacy gates remain active for unconfigured sessions.
- Existing scene image generation can preview a result and expose Save, Save As, Apply as Tile, and Download actions.
- Actor sheet integration opens the existing image application with the selected Actor as its source document.
- Generated Actor images can be saved through Foundry file handling and update the Actor image field; no arbitrary server path is written by browser code.
- Provider requests and responses are normalized in the existing Cibola-compatible façade. Errors distinguish network/CORS, timeout, invalid key, access denied, rate limit, and generic provider failures.
- Locally configured image generations are persisted in browser-local storage through the existing gallery request/delete façade. The live Foundry browser probe confirmed pagination, record shape, and deletion without a Cibola-hosted request.
- The existing vector-store upload, list, and delete callbacks now have a browser-local persistence path using the same Cibola-compatible response shape. Text-file content is retained locally when it fits the browser storage limit; no external vector index is required for library management.
- The visible active UI is rebranded to BoobaStudio; the legacy `cibola8` namespace and persisted data remain available for migration compatibility.
- Automated checks pass: package validation, provider smoke tests, JavaScript syntax/build, and live Foundry smoke validation.

## Intentionally not hosted by this fork

The personal fork does not require Cibola accounts, subscriptions, credits, telemetry, or a Cibola server for the validated local workflows. Hosted gallery/community packs and the legacy hosted thread/translation queues remain unavailable unless a compatible replacement is configured or implemented. Local generated-image gallery records and local vector-library management are available; semantic vector retrieval, the full existing gallery browser, and hosted community views still need deeper parity work.

## Next parity targets

The existing image editor already exposes advanced operations. The next useful validation work is provider-capability gating and live mocked checks for inpainting, outpainting, background removal, upscale, and scene wall detection, followed by local persistence for threads/gallery metadata where the existing hosted contract cannot be reused.
