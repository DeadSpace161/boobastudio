# BoobaStudio local installation and configuration

BoobaStudio is a native Foundry VTT module. It does not require a BoobaStudio account, subscription, companion server, database, Docker container, or Cibola service for the local workflows described here.

## Install

In Foundry's setup screen:

1. Open **Add-on Modules** and choose **Install Module**.
2. Paste the current manifest URL:

   `https://raw.githubusercontent.com/DeadSpace161/boobastudio/main/releases/boobastudio-2.2.120-manifest.json`

3. Install **BoobaStudio**, enable it in the world, and restart or reload the world.

The release archive is also available at:

`https://raw.githubusercontent.com/DeadSpace161/boobastudio/main/releases/boobastudio-2.2.120.zip`

## Configure a text provider

Open **Configure Settings → Module Settings → BoobaStudio**. Enable the local provider and set:

- **Text provider protocol**: `OpenAI-compatible` for OpenAI, OpenRouter, Ollama, LM Studio, or another compatible endpoint.
- **Provider base URL**: include the provider's API prefix, such as `https://api.openai.com/v1`, `https://openrouter.ai/api/v1`, or `http://127.0.0.1:11434/v1`.
- **Provider API key**: required by hosted APIs; usually blank for local Ollama or LM Studio.
- **Provider model**: the exact model identifier accepted by the endpoint.

The existing chat, prose generation, prompt builder, names, descriptions, document generation, and AI Thread workflows use these settings. API keys are client-scoped: they remain in the Foundry client profile and are not sent through BoobaStudio sockets, but any user or module with access to that client profile may be able to read them.

## Configure images

Set **Image provider** and its corresponding settings:

- **OpenAI-compatible**: image base URL/key/model. Image generation uses `/images/generations`; image edits and masks use `/images/edits`.
- **Replicate**: Replicate base URL, client token, model in `owner/name` form, and optional input JSON. Input JSON supports `{{prompt}}`, `{{image}}`, `{{mask}}`, `{{factor}}`, `{{scale}}`, `{{width}}`, and `{{height}}`.
- **Stability AI**: Stability base URL, API key, and model path.
- **ComfyUI**: reachable ComfyUI URL and an API-format workflow JSON. Put `{{prompt}}` in the workflow text field that should receive the generated prompt.

The Foundry browser must be able to reach the selected endpoint. CORS, DNS, firewall, and TLS errors are provider/network configuration problems; BoobaStudio reports them without routing through a BoobaStudio server.

## Configure audio

- **OpenAI TTS** uses the TTS base URL, key, model, and voice settings.
- **ElevenLabs** uses its own base URL, key, model, and voice ID.
- **Music** uses a Replicate model configured in `owner/name` form plus optional model-input JSON. The existing song preview, audio URL, gallery, download, and playlist paths are preserved.

## Local storage and permissions

Generated history, gallery metadata, personal packs, and vector-library metadata are stored in browser-local storage. Generated files use Foundry's FilePicker and configured Foundry storage locations; browser code does not write to arbitrary Unraid paths.

Foundry document changes still obey ownership and upload permissions. Generated content is previewed by the existing applications before it is applied to Actors, Items, Journals, Scenes, Tiles, or other documents.

## Supported local workflows

The current release has live-tested local paths for text/query, AI chat, persistent Threads, image generation and edits, Replicate advanced image input shaping, TTS, music, Actor/Item/Scene image application, token framing fallback, local gallery/history, personal packs, local vector files, and Foundry document controls. The automated v14 test uses intercepted provider responses and does not spend provider credits.

Public/community gallery browsing, public sharing, hosted community packs, and the legacy Cibola translation queue are intentionally not part of the local fork. Foundry's own interface translations remain available.

## Troubleshooting

- **No model appears**: enable the local provider, set a base URL, and enter a model ID. Local mode supplies a safe fallback model descriptor when hosted model metadata is unavailable.
- **Network/CORS error**: verify the URL from the same browser running Foundry and configure the provider or a CORS-enabled compatible endpoint.
- **401/403**: verify the client-scoped key and provider-specific authentication requirements.
- **Timeout**: increase the provider timeout or use a faster/local model.
- **Generated file will not save**: verify the Foundry user's file-upload permission and the configured FilePicker storage source.
- **Existing Cibola data is missing**: keep the legacy data in place and allow BoobaStudio's compatibility migration to copy supported settings, flags, and history into the `boobastudio` namespace. It does not delete the old data automatically.

## Verification commands

From the repository root:

```bash
npm run check
npm run test:provider
npm run test:migration
npm run build
python -W error::SyntaxWarning -m py_compile scripts/foundry-provider-smoke.py
```

The live v14 browser probes are documented in `docs/boobastudio-provider-verification.md`.
