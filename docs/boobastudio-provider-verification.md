# BoobaStudio provider checkpoint verification

## Build checks

Run from the project root:

```bash
npm run check
npm run test:provider
npm run build
```

For automated Foundry session checks, provide credentials through the environment and run:

```bash
export BOOBA_FOUNDRY_ADMIN_PASSWORD='...'
export BOOBA_FOUNDRY_GM_PASSWORD='...'
/home/booba/playwright_env/bin/python scripts/foundry-smoke.py
```

The harness launches the test world when needed, retries the Gamemaster session, and reports the active BoobaStudio version and provider settings without printing credentials.

The image vertical slice now preserves the existing Image Tools application, accepts standard image URLs as well as OpenAI base64 output, and forces locally configured client image models through the local provider adapter.

Release 2.2.43 is the current package. The live Foundry v14 Build 363 server has exercised the existing Journal ProseMirror image action through a mocked OpenAI-compatible provider, produced a non-placeholder preview, retained one history entry, and persisted the generated image into the JournalEntryPage content. No Replicate request was made.

The current checks validate the manifest, referenced files, localization JSON, JavaScript syntax, provider request transformation, and generated package layout. The release package is written to `dist/boobastudio`.

Release 2.2.26 separates the OpenAI-compatible image model from the shared text model. The image request now uses the client-scoped `BoobaStudio: Image model` setting (default `gpt-image-1`), while Replicate continues to use `BoobaStudio: Replicate image model`. The uniquely named 2.2.26 package and manifest provide update cache invalidation without adding query strings to manifest file paths, which Foundry treats as literal filenames.

The live Foundry v14 test loads the stable provider entrypoint referenced by the 2.2.34 manifest. An automated same-origin mock request returned the existing image response shape and confirmed that setting `imageModel` to `test-image-model` sent that model in the outgoing image-generation payload.

Release 2.2.27 adds actionable local provider errors for timeout, network/CORS, and upstream provider failures. The smoke test covers OpenRouter, Ollama, and LM Studio-compatible base URLs. A single real Replicate `flux-schnell` prediction was accepted and polled; Replicate ended it with upstream error `E9828`, so no successful real image was produced.

Release 2.2.28 adapts the recovered advanced image façade. Existing Cibola `genImage` calls now forward their `moreFields` operation data, including image and mask payloads, to the configured local provider. Replicate model selection honors the model selected by the existing Cibola editor, including inpaint, erase, outpaint, style, relight, and upscale model IDs. The original UI, history, callbacks, and document application path remain unchanged.

Live Foundry v14 validation confirmed an intercepted inpaint-shaped request reaches `https://api.replicate.com/v1/models/black-forest-labs/flux-fill-pro/predictions` with `prompt`, `image`, `mask`, and `strength`, and the response is normalized to the existing `{data:[{url}]}` image shape. Direct Replicate use remains subject to Replicate/browser CORS support.

Release 2.2.29 adds provider-specific Replicate input shaping while preserving the same image-generation façade. Flux Fill receives image/mask edit fields; Bria Eraser receives `image`, `mask`, and `preserve_alpha`; Bria Expand receives image and canvas/aspect fields; and background-removal models such as `cjwbw/rembg` receive only their supported image input. The Replicate API base URL is now client-configurable for a CORS-enabled compatible endpoint. These mappings follow the public model schemas for [Flux Fill Pro](https://replicate.com/black-forest-labs/flux-fill-pro/api/schema), [Bria Eraser](https://replicate.com/bria/eraser), [Bria Expand](https://replicate.com/bria/expand-image), and [rembg](https://replicate.com/cjwbw/rembg/api/schema).

Live Foundry v14 validation confirmed the provider settings and advanced image request routing. No paid Replicate request was made during this validation.

Live Foundry v14 journal validation completed against the existing JournalEntryPage ProseMirror workflow. The automated test opened the existing BoobaStudio menu, selected `Generate description with AI`, submitted through an intercepted OpenAI-compatible `/chat/completions` response, accepted the generated result, and saved the page. The resulting JournalEntryPage content contained the generated paragraph. A separate image test confirmed generated image HTML is persisted in the same page model.

## Foundry v14 manual test

1. Copy `dist/boobastudio` into the Foundry `Data/modules/` directory, preserving the folder name `boobastudio`.
2. Start Foundry v14 and create or open a test world.
3. Enable **BoobaStudio** in the world module list.
4. Open module settings and configure:
   - Enable OpenAI-compatible provider: on.
   - Provider base URL: an OpenAI-compatible `/v1` endpoint.
   - Provider API key: stored in the existing client-scoped `openaiApiKey` setting. This preserves compatibility with the original Cibola setting and avoids a Foundry v14 `ClientSettings.set` recursion issue observed with a newly registered duplicate key.
   - Provider model: a model accepted by the endpoint.
   - Timeout, temperature, maximum tokens, and optional JSON headers as needed.
   The onboarding window's **Configure Provider** button opens Foundry's standard Module Settings screen.
5. Confirm the module initializes without a Cibola account, Patreon token, or request to `app.cibola.world`.
6. Use the existing chat control and send a `/c8` prompt.
7. Confirm the provider receives a `POST /chat/completions` request with the configured model and returns a visible response in Foundry chat.
8. Open the existing prose/text-generation UI, submit a prompt, accept a generated result, and confirm the content is inserted into the existing Journal/editor surface.
9. Confirm the browser console contains no API key and that a disabled provider setting leaves ordinary requests untouched.
10. If testing image generation, use a text prompt and confirm the provider receives `POST /images/generations` and returns the existing image preview shape.
   For Replicate, configure the client-scoped key with an `r8_` token and set the provider model to an `owner/model` value such as `black-forest-labs/flux-schnell`; BoobaStudio detects the Replicate token fallback, creates and polls a prediction, then normalizes its output to the existing image shape.
11. In a world containing legacy Cibola settings, confirm the new settings, `/c8` history, and radial macro marker are copied and the old values remain present.

The dependency-free provider smoke test also validates the existing prose query callback contract, including the normalized `{status: "done", result}` response.

## Text vertical-slice call path

The existing `TextGenerationService.query` first invokes `globalThis.__boobastudioLocalQuery` when the local provider is enabled. The callback result is consumed by the existing prose-generation application, which renders the response in its history and inserts the accepted result into the active ProseMirror editor selection. This preserves the original Cibola UI and persistence behavior while replacing only the request layer.

## Known checkpoint limitations

- The adapter reuses Cibola's existing client-only chat/image path and now provides a guarded local fallback for the existing prose/document `query` path.
- Direct browser requests require provider CORS support. A CORS error is not fixed by changing module settings; use a provider endpoint that permits the Foundry origin or a user-managed compatible proxy.
- Foundry v14 Build 363 runtime deployment has been verified through the public test server. The active server currently runs 2.2.42; release 2.2.43 is published and awaits installation after the active world is stopped. A paid browser-driven Replicate generation remains intentionally separate from automated routing validation.
- Foundry v14 ProseMirror validation identified and corrected a legacy-schema issue: the existing Cibola text actions targeted `schema.nodes.div`, which v14 filters from journal menus. The fork now falls back to `schema.nodes.paragraph` for those existing actions. Release 2.2.21 packages the image-provider compatibility fix and this ProseMirror fix.
- The test server has been validated with the stable entrypoint filename. The fresh-journal page-sheet probe confirms the existing BoobaStudio dropdown and image action render in Foundry v14, and the configured local provider path now opens the image prompt and persists its result.
- The provider adapter uses the stable filename `bundle/modules/boobastudio-provider.js`; this avoids a server/static-path issue that caused the earlier adapter filename to return 404 without a cache query.
