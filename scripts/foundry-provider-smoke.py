#!/usr/bin/env python3
"""Live Foundry v14 provider smoke test using Playwright request interception."""

import asyncio
import json
import os
from playwright.async_api import async_playwright


class MockHandler:
    requests = []


async def join_game(page, base_url, password):
    await page.goto(f"{base_url}/join", wait_until="domcontentloaded", timeout=30_000)
    await page.wait_for_timeout(2_000)
    if not await page.locator('select[name="userid"]').count():
        raise RuntimeError("The test world is not joinable")
    await page.locator('select[name="userid"]').select_option(label="Gamemaster")
    await page.locator('input[name="password"]').fill(password)
    await page.locator('button[name="join"]').dispatch_event("click")
    await page.wait_for_timeout(12_000)
    if not page.url.endswith("/game"):
        raise RuntimeError(f"Foundry session did not reach the game: {page.url}")


async def main():
    base_url = os.getenv("BOOBA_FOUNDRY_URL", "https://vtt.hiddenbunker.org").rstrip("/")
    password = os.getenv("BOOBA_FOUNDRY_GM_PASSWORD") or os.getenv("BOOBA_FOUNDRY_ADMIN_PASSWORD")
    if not password:
        raise SystemExit("Set BOOBA_FOUNDRY_GM_PASSWORD or BOOBA_FOUNDRY_ADMIN_PASSWORD")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        browser_context = await browser.new_context(ignore_https_errors=True, viewport={"width": 1440, "height": 900})
        page = await browser_context.new_page()
        mock_base = "https://mock.boobastudio.test/v1"

        async def mock_route(route):
            request = route.request
            try:
                body = json.loads(request.post_data or "{}")
            except json.JSONDecodeError:
                body = {}
            MockHandler.requests.append({"path": request.url, "body": body})
            if request.url.endswith("/images/generations"):
                payload = {"data": [{"b64_json": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="}]}
            elif request.url.endswith("/audio/speech") or "/text-to-speech/" in request.url:
                await route.fulfill(status=200, content_type="audio/mpeg", body="mock-audio")
                return
            elif request.url.endswith("/stability/core"):
                payload = {"image": "bW9ja19zdGFiaWxpdHk="}
            elif "/replicate/v1/models/" in request.url and request.url.endswith("/predictions"):
                payload = {"id": "mock-prediction", "status": "starting", "urls": {"get": f"{mock_base}/replicate/v1/predictions/mock-prediction"}}
            elif request.url.endswith("/replicate/v1/predictions/mock-prediction"):
                payload = {"id": "mock-prediction", "status": "succeeded", "output": ["https://mock.boobastudio.test/generated.png"]}
            elif request.url.endswith("/comfyui/prompt"):
                payload = {"prompt_id": "mock-comfy-prompt"}
            elif request.url.endswith("/comfyui/history/mock-comfy-prompt"):
                payload = {"mock-comfy-prompt": {"outputs": {"9": {"images": [{"filename": "mock.png", "subfolder": "", "type": "output"}]}}}}
            elif request.url.endswith("/messages"):
                payload = {"content": [{"type": "text", "text": "Mock Anthropic response"}]}
            elif ":generateContent" in request.url:
                payload = {"candidates": [{"content": {"parts": [{"text": "Mock Gemini response"}]}}]}
            else:
                payload = {"choices": [{"message": {"role": "assistant", "content": "Mock BoobaStudio response"}}]}
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))

        await page.route("https://mock.boobastudio.test/v1/**", mock_route)
        await join_game(page, base_url, password)
        await page.evaluate("""() => {
            const onboarding = document.querySelector('.boobastudio-onboarding');
            const close = onboarding?.querySelector('[data-action="close"], [data-action="exit"], [data-action="getStarted"]');
            close?.click();
        }""")
        await page.wait_for_timeout(500)
        result = await page.evaluate(
                """async ({base}) => {
                    const module = game.modules.get('boobastudio');
                    if (!module?.active) throw new Error('BoobaStudio is not active');
                    await game.settings.set('boobastudio', 'providerEnabled', true);
                    await game.settings.set('boobastudio', 'providerProtocol', 'openai');
                    await game.settings.set('boobastudio', 'clientOnlyMode', true);
                    await game.settings.set('boobastudio', 'ttsBaseUrl', base);
                    await game.settings.set('boobastudio', 'ttsApiKey', 'mock-tts-key');
                    let openaiTts;
                    await globalThis.__boobastudioLocalGenerateTTS('live OpenAI TTS probe', JSON.stringify({voice: 'nova'}), 'tts-1', result => { openaiTts = result; });
                    await game.settings.set('boobastudio', 'ttsProvider', 'elevenlabs');
                    await game.settings.set('boobastudio', 'elevenlabsBaseUrl', base);
                    await game.settings.set('boobastudio', 'elevenlabsApiKey', 'mock-eleven-key');
                    let elevenTts;
                    await globalThis.__boobastudioLocalGenerateTTS('live ElevenLabs TTS probe', JSON.stringify({voice_id: 'voice-1'}), 'eleven_turbo_v2_5', result => { elevenTts = result; });
                    await game.settings.set('boobastudio', 'ttsProvider', 'openai');
                    const imageProviders = {};
                    for (const [name, settings] of Object.entries({
                        stability: {base: `${base}/stability`, model: 'core'},
                        replicate: {base: `${base}/replicate/v1`, model: 'owner/mock-image'},
                        comfyui: {base: `${base}/comfyui`, model: ''}
                    })) {
                        await game.settings.set('boobastudio', 'imageProvider', name);
                        await game.settings.set('boobastudio', 'stabilityBaseUrl', settings.base);
                        await game.settings.set('boobastudio', 'stabilityModel', settings.model || 'core');
                        await game.settings.set('boobastudio', 'replicateBaseUrl', settings.base);
                        await game.settings.set('boobastudio', 'replicateModel', settings.model || 'owner/mock-image');
                        await game.settings.set('boobastudio', 'replicateApiToken', 'mock-replicate-key');
                        await game.settings.set('boobastudio', 'comfyuiBaseUrl', settings.base);
                        await game.settings.set('boobastudio', 'comfyuiWorkflow', JSON.stringify({prompt: '{{prompt}}'}));
                        const imageProbe = await fetch('https://api.openai.com/v1/images/generations', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({model: settings.model || 'mock-image', prompt: `live ${name} image probe`})});
                        const imagePayload = await imageProbe.json();
                        imageProviders[name] = {status: imageProbe.status, hasImage: !!imagePayload?.data?.[0]?.b64_json || typeof imagePayload?.data?.[0]?.url === 'string', url: imagePayload?.data?.[0]?.url || null};
                    }
                    await game.settings.set('boobastudio', 'imageProvider', 'openai');
                    let actorIntegration = {created: false, sheetRendered: false, controlVisible: false, deleted: false};
                    let smokeActor;
                    let imageAppInstance;
                    try {
                        smokeActor = await Actor.create({name: `BoobaStudio Live Smoke ${Date.now()}`, type: 'character'});
                        actorIntegration.created = !!smokeActor;
                        if (smokeActor?.sheet?.render) {
                            await smokeActor.sheet.render(true);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            actorIntegration.sheetRendered = !!smokeActor.sheet.rendered;
                            const actorControl = document.querySelector('.boobastudio-actor-control');
                            actorIntegration.controlVisible = !!actorControl;
                            if (actorControl) {
                                actorControl.click();
                                await new Promise(resolve => setTimeout(resolve, 700));
                                actorIntegration.radialVisible = !!document.querySelector('.radial-menu-container');
                                actorIntegration.radialButtons = [...document.querySelectorAll('.radial-menu-container button, .radial-menu-container .radial-button')]
                                    .map(button => ({text: (button.innerText || '').trim(), tooltip: button.dataset?.tooltip || '', aria: button.getAttribute('aria-label') || '', className: String(button.className || '')})).slice(0, 20);
                                const radialRoot = document.querySelector('.radial-menu-container');
                                actorIntegration.radialInfo = {className: String(radialRoot?.className || ''), text: (radialRoot?.innerText || '').trim().slice(0, 500), html: radialRoot?.outerHTML?.slice(0, 1800) || ''};
                                const radialButton = [...document.querySelectorAll('.radial-menu-container button, .radial-menu-container .radial-button')]
                                    .find(button => /image|ai/i.test(`${button.innerText || ''} ${button.dataset?.tooltip || ''} ${button.getAttribute('aria-label') || ''}`));
                                if (radialButton) {
                                    radialButton.click();
                                    await new Promise(resolve => setTimeout(resolve, 900));
                                } else if (typeof game.modules.get('boobastudio')?.api?.ImageGenerator === 'function') {
                                    actorIntegration.imageGeneratorApi = true;
                                    imageAppInstance = new (game.modules.get('boobastudio').api.ImageGenerator)(smokeActor, smokeActor.sheet);
                                    await imageAppInstance.render(true);
                                    await new Promise(resolve => setTimeout(resolve, 900));
                                }
                                actorIntegration.imageWindowVisible = [...document.querySelectorAll('.window, aside')]
                                    .some(element => /image generation|image tools|generate image/i.test((element.innerText || '').slice(0, 500)));
                                const imageWindow = [...document.querySelectorAll('.window, aside')]
                                    .find(element => /image generation|image tools|generate image/i.test((element.innerText || '').slice(0, 700)));
                                const promptControl = imageWindow?.querySelector?.('textarea.prompt, input.prompt, textarea[name="prompt"], input[name="prompt"]');
                                const generateControl = imageWindow?.querySelector?.('[data-action="generate"]');
                                const promptLauncher = imageWindow?.querySelector?.('[data-action="goPrompt"]');
                                actorIntegration.imageUi = {localConfigured: globalThis.__boobastudioLocalProviderConfigured?.() === true, clientOnlyMode: game.settings.get('boobastudio', 'clientOnlyMode'), promptControl: !!promptControl, generateControl: !!generateControl, submitted: false, renderedResult: false, text: (imageWindow?.innerText || '').trim().slice(0, 900), goPrompt: promptLauncher ? {disabled: !!promptLauncher.disabled, ariaDisabled: promptLauncher.getAttribute('aria-disabled') || '', outer: promptLauncher.outerHTML.slice(0, 600)} : null, controls: [...(imageWindow?.querySelectorAll?.('input, textarea, button, [data-action]') || [])].map(control => ({tag: control.tagName, name: control.getAttribute('name') || '', action: control.dataset?.action || '', className: String(control.className || ''), value: control.value || '', text: (control.innerText || '').trim()})).slice(0, 30)};
                                if (promptLauncher) {
                                    promptLauncher.click();
                                    await new Promise(resolve => setTimeout(resolve, 700));
                                }
                                if (!document.querySelector('.boobastudio-dialog, .ciboladialog, [role="dialog"] textarea')) {
                                    const imageApp = imageAppInstance || [...(game.applications?.values?.() || [])].find(app => app?.element === imageWindow || app?.element?.contains?.(imageWindow));
                                    actorIntegration.imageAppGoPrompt = typeof imageApp?.goPrompt === 'function';
                                    if (imageApp?.goPrompt && promptLauncher) {
                                        await imageApp.goPrompt(promptLauncher);
                                        await new Promise(resolve => setTimeout(resolve, 700));
                                    }
                                }
                                const promptWindow = [...document.querySelectorAll('.window, aside')]
                                    .find(element => element !== imageWindow && /prompt|description|generate/i.test((element.innerText || '').slice(0, 800)) && element.querySelector('textarea, input'));
                                const actualPrompt = promptWindow?.querySelector?.('textarea.prompt, input.prompt, textarea[name="prompt"], input[name="prompt"], textarea');
                                const actualGenerate = promptWindow?.querySelector?.('[data-action="generate"], [data-action="submit"], button[type="submit"]');
                                actorIntegration.imageUi.promptDialog = {opened: !!promptWindow, promptControl: !!actualPrompt, generateControl: !!actualGenerate, text: (promptWindow?.innerText || '').trim().slice(0, 500)};
                                if (actualPrompt && actualGenerate) {
                                    actualPrompt.value = 'live actor image workflow probe';
                                    actualPrompt.dispatchEvent(new Event('input', {bubbles: true}));
                                    actualGenerate.click();
                                    await new Promise(resolve => setTimeout(resolve, 1800));
                                    actorIntegration.imageUi.submitted = true;
                                    actorIntegration.imageUi.renderedResult = !!imageWindow?.querySelector?.('img[src^="data:image/"], img[src*="mock"]');
                                }
                                if (promptControl && generateControl) {
                                    promptControl.value = 'live actor image workflow probe';
                                    promptControl.dispatchEvent(new Event('input', {bubbles: true}));
                                    generateControl.click();
                                    await new Promise(resolve => setTimeout(resolve, 1800));
                                    actorIntegration.imageUi.submitted = true;
                                    actorIntegration.imageUi.renderedResult = !!imageWindow.querySelector('img[src^="data:image/"], img[src*="mock"]');
                                }
                                document.querySelectorAll('.radial-modal, .radial-menu-container').forEach(element => element.closest('.window')?.remove?.());
                            }
                            smokeActor.sheet.close?.();
                        }
                    } finally {
                        if (smokeActor) {
                            await smokeActor.delete();
                            actorIntegration.deleted = !game.actors.has(smokeActor.id);
                        }
                    }
                    const itemIntegration = {created: false, sheetRendered: false, controlVisible: false, deleted: false};
                    let smokeItem;
                    try {
                        const itemType = Object.keys(game.system.documentTypes?.Item || {})[0] || 'asset';
                        smokeItem = await Item.create({name: `BoobaStudio Live Smoke Item ${Date.now()}`, type: itemType});
                        itemIntegration.type = itemType;
                        itemIntegration.created = !!smokeItem;
                        if (smokeItem?.sheet?.render) {
                            await smokeItem.sheet.render(true);
                            await new Promise(resolve => setTimeout(resolve, 800));
                            itemIntegration.sheetRendered = !!smokeItem.sheet.rendered;
                            const itemRoot = smokeItem.sheet.element;
                            itemIntegration.rootClass = String(itemRoot?.className || '');
                            itemIntegration.text = (itemRoot?.innerText || '').trim().slice(0, 700);
                            const itemControls = [...(itemRoot?.querySelectorAll?.('button, a, [data-action]') || [])]
                                .map(element => ({className: String(element.className || ''), action: element.dataset?.action || '', text: (element.innerText || '').trim()}))
                                .filter(control => /booba|cibola|generate|ai/i.test(`${control.className} ${control.action} ${control.text}`));
                            itemIntegration.controlVisible = itemControls.length > 0;
                            itemIntegration.controls = itemControls.slice(0, 10);
                            smokeItem.sheet.close?.();
                        }
                    } catch (error) {
                        itemIntegration.error = String(error?.message || error);
                    } finally {
                        if (smokeItem) {
                            await smokeItem.delete();
                            itemIntegration.deleted = !game.items.has(smokeItem.id);
                        }
                    }
                    const sceneIntegration = {sheetRendered: false, controlVisible: false};
                    const smokeScene = canvas?.scene;
                    if (smokeScene?.sheet?.render) {
                        await smokeScene.sheet.render(true);
                        await new Promise(resolve => setTimeout(resolve, 800));
                        sceneIntegration.sheetRendered = !!smokeScene.sheet.rendered;
                        sceneIntegration.controlVisible = !!document.querySelector('.boobastudio-inject-btn');
                        smokeScene.sheet.close?.();
                    }
                    await game.settings.set('boobastudio', 'providerBaseUrl', base);
                    await game.settings.set('boobastudio', 'providerModel', 'mock-model');
                    await game.settings.set('boobastudio', 'providerJsonMode', false);
                    const configured = globalThis.__boobastudioLocalProviderConfigured?.() === true;
                    const response = await fetch('https://api.openai.com/v1/responses', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({model: 'mock-model', input: [{role: 'user', content: [{type: 'input_text', text: 'live chat probe'}]}]})
                    });
                    const text = await response.json();
                    const query = await new Promise(resolve => globalThis.__boobastudioLocalQuery(
                        'live prose query',
                        'Return a short paragraph for a JournalEntry.',
                        resolve,
                        {jsonMode: false}
                    ));
                    const nativeProviders = {};
                    for (const [name, expected] of [['anthropic', 'Mock Anthropic response'], ['gemini', 'Mock Gemini response']]) {
                        await game.settings.set('boobastudio', 'providerProtocol', name);
                        const native = await new Promise(resolve => globalThis.__boobastudioLocalQuery(
                            `live ${name} provider probe`,
                            'Return the provider smoke response.',
                            resolve,
                            {jsonMode: false}
                        ));
                        nativeProviders[name] = {status: native?.status || null, result: native?.result || null, expectedMatch: native?.result === expected};
                    }
                    await game.settings.set('boobastudio', 'providerProtocol', 'openai');
                    const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({model: 'mock-image', prompt: 'live image probe'})
                    });
                    const image = await imageResponse.json();
                    const localPackFactory = typeof globalThis.__boobastudioLocalPackCreate;
                    const localTokenFactory = typeof globalThis.__boobastudioLocalTokenize;
                    const localPack = await globalThis.__boobastudioLocalPackCreate?.({name: 'Live Smoke Pack'});
                    const localPackId = localPack?.data?.id;
                    const localPacks = await globalThis.__boobastudioLocalPackMyPacks?.();
                    const updatedPack = localPackId ? await globalThis.__boobastudioLocalPackUpdate?.(localPackId, {tagline: 'Live'}) : null;
                    const deletedPack = localPackId ? await globalThis.__boobastudioLocalPackDelete?.(localPackId) : null;
                    return {
                        version: module.version,
                        configured,
                        textStatus: response.status,
                        text,
                        query,
                        nativeProviders,
                        tts: {openai: {status: openaiTts?.status || null, hasAudio: String(openaiTts?.result || '').startsWith('data:audio/')}, elevenlabs: {status: elevenTts?.status || null, hasAudio: String(elevenTts?.result || '').startsWith('data:audio/')}},
                        imageProviders,
                        actorIntegration,
                        itemIntegration,
                        sceneIntegration,
                        imageStatus: imageResponse.status,
                        image,
                        localPack: {factory: localPackFactory, created: !!localPackId, count: localPacks?.data?.length || 0, updated: updatedPack?.data?.attributes?.tagline === 'Live', deleted: deletedPack?.success === true},
                        localTokenFallback: localTokenFactory === 'function',
                        providerSettings: [...game.settings.settings.keys()].filter(key => key.startsWith('boobastudio.'))
                    };
                }""",
                {"base": mock_base},
            )
        print(json.dumps({"mockBase": mock_base, "foundry": result, "requests": MockHandler.requests}, indent=2))
        await browser_context.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
