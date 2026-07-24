# Remote endpoint inventory

The base URL is a static `https://app.cibola.world/api/v1/` in the compatibility `AuthService`. The exact source functions are lost to minification; the table uses recovered service method names and template/controller call sites. HTTP verbs marked “inferred” come from the visible request-wrapper calls (`getRequestObject`, `postRequestObject`, `deleteRequestObject`). The replacement column reflects current BoobaStudio local-mode behavior.

| URL or pattern | Calling service/function | Method | Request/payload | Response shape | Auth | Feature / replacement |
|---|---|---|---|---|---|---|
| `/api/v1/config` | `ApiConfigService.loadOnce` | GET | Auth request object, no-store | `{version, models:{text,image,tts,...}, image_generation_config, feature_flags}` | API key | Model catalog/feature flags; replace with local provider capabilities. |
| `/api/v1/alive` | `AuthService.isConnected`, ready/onboarding | GET | Auth request object | `{level, alive, health, credits_remaining, nsfw}` | API key | Account/credit gate; local mode becomes enabled/disabled plus provider test. |
| `/api/v1/estimate` | generation controllers | POST (inferred) | Generation model, prompt/options | estimate/cost object | API key | Credit estimate; omit or replace with optional local usage counter. |
| `/api/v1/query` | text generation façade | POST (inferred) | Prompt plus JSON generation spec (`style`, `type`, `temperature`, `wordcount`, `item`) | callback contract generally `{result,...}` | API key | Random content, prose, document generation; first vertical slice adapter. |
| `/api/v1/chat` | `DirectChat`, thread code | POST | Message history and mode | `{message:{role,content}, ...}` or error | API key | Text chat; local OpenAI-compatible adapter. |
| `/api/v1/enhance` | prompt/image controllers | POST | Prompt/image context and serialized fields | `{result,...}` | API key | Prompt enhancement, image analysis/editing; provider capability dependent. |
| `/api/v1/translate` | translation controllers/queue | POST | Source object/document, target language, translation options | `{result,...}` or completion object | API key | AI document translation; intentionally deferred for English-only scope. |
| `/api/v1/results` | gallery/browser | GET (inferred) | Filters, page/search/category | paged prediction/result list | API key | Hosted fallback; local browser gallery façade handles local-provider results. |
| `/api/v1/browse/{page}` | public/browser | GET | page/filter query | `{data,...}` | likely API key/public access | Public gallery; defer or disable. |
| `/api/v1/result/{id}` | hosted result polling | GET | prediction/job ID | result/prediction object | API key | Long-running image/audio results; local providers need a normalized job adapter. |
| `/api/v1/share/{id}` | gallery share | POST | result ID | updated result/public URL | API key | Cibola public sharing; remove/disable in personal fork. |
| `/api/v1/togglePublic/{id}` | gallery | POST | result ID | updated visibility | API key | Cibola public sharing; remove/disable. |
| `/api/v1/remove/{id}` | gallery | DELETE | result ID | success/error | API key | Hosted fallback; local-provider results use browser-local deletion. |
| `/api/v1/thread/{id}` | thread sheet | GET/POST/DELETE (inferred) | thread messages/options or thread ID | thread/message response | API key | Hosted fallback; local chat persists messages in JournalEntryPage data and local deletion clears that data directly. |
| `/api/v1/editMessage/{thread}/{message}` | thread sheet | POST | edited message content | updated message | API key | Hosted thread edit; local mode should update JournalEntryPage directly. |
| `/api/v1/searchvoice` | ElevenLabs voice UI | GET/POST (inferred) | language/search/age/gender/use case/page | `{voices, has_more}` | API key | Voice search; direct ElevenLabs later. |
| `/api/v1/voices` | ElevenLabs voice initialization | GET | none | `{voices:[...]}` | API key | Voice catalog; direct provider later. |
| `/api/v1/vector/list` | vector UI | GET | world/model context | vector store/files | API key | Hosted fallback; local mode uses browser-local metadata. |
| `/api/v1/vector/list_all` | vector UI | GET | world context | all vector files/stores | API key | Hosted fallback; local mode uses the same local library. |
| `/api/v1/vector/vectorize` | vector upload | POST | uploaded text/PDF metadata/content | file/vectorization result | API key | Hosted fallback; local mode stores extractable text locally and uses token-overlap retrieval. |
| `/api/v1/packs` | community pack catalog | GET | filters/search/page | pack list | API key/public | Cibola pack catalog; disable in first fork slice. |
| `/api/v1/packs/{id}` | pack detail | GET | pack ID | pack detail | API key/public | Hosted pack catalog; defer. |
| `/api/v1/packs/{id}/images` | pack images | GET | page | images | API key/public | Hosted pack catalog; defer. |
| `/api/v1/packs/featured`, `/grouped`, `/search` | pack browser | GET | filter/search | pack lists | API key/public | Hosted pack catalog; defer. |
| `/api/v1/my/packs` and `/my/packs/{id}` | pack editor | GET/POST/DELETE | pack metadata | pack record | API key | Hosted publishing; disable in personal mode. |
| `/api/v1/my/packs/{id}/images` | pack editor | GET/POST/DELETE | image IDs/upload | pack images | API key | Hosted publishing; disable in personal mode. |
| `/api/v1/my/packs/{id}/submit` / `withdraw` | pack editor | POST | pack ID | status | API key | Hosted publishing; disable. |
| `/api/v1/my/packs/{id}/generate_banner` | pack editor | POST | pack/style metadata | image/job result | API key | Hosted image generation; replace only if pack feature retained. |

## Direct non-Cibola URLs

`https://api.openai.com/v1/responses`, `https://api.openai.com/v1/images/generations`, and `/audio/speech` are intercepted for configured local text/image/TTS providers. Local adapters also support native Anthropic and Gemini text endpoints, OpenRouter/Ollama/LM Studio-compatible URLs, ComfyUI, Stability AI, Replicate image/music endpoints, and ElevenLabs TTS. `https://cdn1.suno.ai/<id>.mp3` remains a hosted-song fallback; local song results use the provider-returned audio URL. The compatibility bundle still contains Cibola URLs for unconfigured hosted fallback paths, while local mode skips those paths for validated workflows.

## Replacement contract

The safest adapter boundary is the existing façade around `query`, `chat`, `enhance`, `genImage`, `translate`, `generateTTS`, and `generateSong`. Local adapters should return the existing callback/result forms (`result`, `message`, image URL/data, job status, and errors) so existing previews, queue code, document updates, and history remain unchanged. Provider-specific capability fields should be filtered before reaching existing model forms.
