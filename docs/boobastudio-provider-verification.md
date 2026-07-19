# BoobaStudio provider checkpoint verification

## Build checks

Run from the project root:

```bash
npm run check
npm run test:provider
npm run build
```

The current checks validate the manifest, referenced files, localization JSON, JavaScript syntax, provider request transformation, and generated package layout. The release package is written to `dist/boobastudio`.

## Foundry v14 manual test

1. Copy `dist/boobastudio` into the Foundry `Data/modules/` directory, preserving the folder name `boobastudio`.
2. Start Foundry v14 and create or open a test world.
3. Enable **BoobaStudio** in the world module list.
4. Open module settings and configure:
   - Enable OpenAI-compatible provider: on.
   - Provider base URL: an OpenAI-compatible `/v1` endpoint.
   - Provider API key: a test key stored only in the client settings.
   - Provider model: a model accepted by the endpoint.
   - Timeout, temperature, maximum tokens, and optional JSON headers as needed.
5. Confirm the module initializes without a Cibola account, Patreon token, or request to `app.cibola.world`.
6. Use the existing chat control and send a `/c8` prompt.
7. Confirm the provider receives a `POST /chat/completions` request with the configured model and returns a visible response in Foundry chat.
8. Open the existing prose/text-generation UI, submit a prompt, accept a generated result, and confirm the content is inserted into the existing Journal/editor surface.
9. Confirm the browser console contains no API key and that a disabled provider setting leaves ordinary requests untouched.
10. If testing image generation, use a text prompt and confirm the provider receives `POST /images/generations` and returns the existing image preview shape.
11. In a world containing legacy Cibola settings, confirm the new settings, `/c8` history, and radial macro marker are copied and the old values remain present.

## Known checkpoint limitations

- The adapter reuses Cibola's existing client-only chat/image path and now provides a guarded local fallback for the existing prose/document `query` path.
- Direct browser requests require provider CORS support. A CORS error is not fixed by changing module settings; use a provider endpoint that permits the Foundry origin or a user-managed compatible proxy.
- Foundry v14 runtime testing has not been performed in this workspace. The package has passed static and Node-based checks only.
