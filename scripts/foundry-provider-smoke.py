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
            elif request.url.endswith("/images/edits"):
                payload = {"data": [{"b64_json": "bW9ja19pbWFnZV9lZGl0"}]}
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
                request_text = json.dumps(body)
                content = '["Mock generated prompt"]' if "valid JSON array of strings" in request_text else "Mock BoobaStudio response"
                payload = {"choices": [{"message": {"role": "assistant", "content": content}}]}
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
                    const smokeWarnings = [];
                    const originalWarn = console.warn;
                    console.warn = (...args) => { smokeWarnings.push(args.map(value => String(value)).join(' ')); originalWarn(...args); };
                    await game.settings.set('boobastudio', 'providerEnabled', true);
                    await game.settings.set('boobastudio', 'providerProtocol', 'openai');
                    await game.settings.set('boobastudio', 'clientOnlyMode', true);
                    await game.settings.set('boobastudio', 'providerBaseUrl', base);
                    await game.settings.set('boobastudio', 'providerModel', 'mock-local-thread-model');
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
                    const advancedImage = {variant: null, editRequest: false, editStatus: null};
                    await game.settings.set('boobastudio', 'imageModel', 'mock-image');
                    await game.settings.set('boobastudio', 'openaiApiKey', 'mock-image-key');
                    let variantResult;
                    await globalThis.__boobastudioLocalGenerateVariant(
                        'live inpaint/variation probe',
                        JSON.stringify({image: 'data:image/png;base64,aW5wdXQ=', mask: 'data:image/png;base64,bWFzaw==', moreFields: {strength: 0.7}}),
                        'mock-image',
                        result => { variantResult = result; }
                    );
                    advancedImage.variant = {success: variantResult?.success === true, resultIsDataUrl: String(variantResult?.result || '').startsWith('data:image/png;base64,')};
                    advancedImage.editStatus = variantResult?.success ? 'done' : 'error';
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
                                const imageApp = imageAppInstance || [...(game.applications?.values?.() || [])].find(app => app?.element === imageWindow || app?.element?.contains?.(imageWindow));
                                const saveImageButton = imageWindow?.querySelector?.('[data-action="saveImg"]');
                                const targetImage = imageWindow?.querySelector?.('.targetImg');
                                if (imageApp && typeof imageApp.saveImg === 'function' && saveImageButton && targetImage) {
                                    try {
                                        targetImage.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
                                        targetImage.removeAttribute('data-realfile');
                                        await imageApp.saveImg(saveImageButton);
                                        actorIntegration.imageApplied = typeof smokeActor.img === 'string' && smokeActor.img.length > 0 && !smokeActor.img.startsWith('icons/');
                                        actorIntegration.imagePath = smokeActor.img;
                                    } catch (error) {
                                        actorIntegration.imageApplyError = String(error?.message || error);
                                    }
                                }
                                if (promptLauncher) {
                                    promptLauncher.click();
                                    await new Promise(resolve => setTimeout(resolve, 700));
                                }
                                if (!document.querySelector('.boobastudio-dialog, .ciboladialog, [role="dialog"] textarea')) {
                                    actorIntegration.imageAppGoPrompt = typeof imageApp?.goPrompt === 'function';
                                    if (imageApp?.goPrompt && promptLauncher) {
                                        try {
                                            await imageApp.goPrompt(promptLauncher);
                                            await new Promise(resolve => setTimeout(resolve, 700));
                                        } catch (error) {
                                            actorIntegration.imageAppGoPromptError = String(error?.message || error);
                                        }
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
                                imageAppInstance?.close?.();
                            }
                            smokeActor.sheet.close?.();
                        }
                    } finally {
                        if (smokeActor) {
                            await smokeActor.delete();
                            actorIntegration.deleted = !game.actors.has(smokeActor.id);
                        }
                    }
                    const itemIntegration = {created: false, sheetRendered: false, controlVisible: false, imageApplied: false, deleted: false};
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
                            const itemControl = itemRoot?.querySelector?.('.boobastudio-document-control, .AiBothGen, [data-action="boobastudio"]');
                            if (itemControl) {
                                itemControl.click();
                                await new Promise(resolve => setTimeout(resolve, 900));
                                const itemImageWindow = [...document.querySelectorAll('.window, aside')]
                                    .find(element => /image generation|image tools|generate image/i.test((element.innerText || '').slice(0, 700)) && element.querySelector('.targetImg'));
                                const itemApps = [...(game.applications?.values?.() || []), ...Object.values(ui.windows || {})];
                                const itemImageApp = itemApps.find(app => app?.element === itemImageWindow || app?.element?.contains?.(itemImageWindow));
                                const itemSaveButton = itemImageWindow?.querySelector?.('[data-action="saveImg"]');
                                const itemTargetImage = itemImageWindow?.querySelector?.('.targetImg');
                                itemIntegration.imageWindowVisible = !!itemImageWindow;
                                itemIntegration.saveButtonVisible = !!itemSaveButton;
                                if (itemSaveButton && itemTargetImage) {
                                    itemTargetImage.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
                                    itemTargetImage.removeAttribute('data-realfile');
                                    if (itemImageApp && typeof itemImageApp.saveImg === 'function') await itemImageApp.saveImg(itemSaveButton);
                                    else {
                                        itemSaveButton.click();
                                        await new Promise(resolve => setTimeout(resolve, 1800));
                                    }
                                    itemIntegration.imageApplied = typeof smokeItem.img === 'string' && smokeItem.img.length > 0 && !smokeItem.img.startsWith('icons/');
                                    itemIntegration.imagePath = smokeItem.img || null;
                                }
                                itemImageApp?.close?.();
                            }
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
                    const documentIntegrations = {};
                    let smokeJournal, smokeRollTable, smokeTileScene;
                    try {
                        smokeJournal = await JournalEntry.create({name: `BoobaStudio Live Smoke Journal ${Date.now()}`, content: '', pages: [{name: 'Smoke Page', type: 'text', text: {format: 1, content: '<p>Smoke</p>'}}]});
                        await smokeJournal.sheet?.render?.(true);
                        await new Promise(resolve => setTimeout(resolve, 700));
                        documentIntegrations.JournalEntry = {created: !!smokeJournal, sheetRendered: !!smokeJournal?.sheet?.rendered, controlVisible: !!document.querySelector('.boobastudio-document-control')};
                        smokeJournal.sheet?.close?.();
                    } catch (error) {
                        documentIntegrations.JournalEntry = {created: !!smokeJournal, error: String(error?.message || error)};
                    } finally {
                        if (smokeJournal) await smokeJournal.delete();
                    }
                    try {
                        smokeRollTable = await RollTable.create({name: `BoobaStudio Live Smoke RollTable ${Date.now()}`, formula: '1d1', results: []});
                        await smokeRollTable.sheet?.render?.(true);
                        await new Promise(resolve => setTimeout(resolve, 700));
                        documentIntegrations.RollTable = {created: !!smokeRollTable, sheetRendered: !!smokeRollTable?.sheet?.rendered, controlVisible: !!document.querySelector('.boobastudio-document-control')};
                        smokeRollTable.sheet?.close?.();
                    } catch (error) {
                        documentIntegrations.RollTable = {created: !!smokeRollTable, error: String(error?.message || error)};
                    } finally {
                        if (smokeRollTable) await smokeRollTable.delete();
                    }
                    try {
                        smokeTileScene = await Scene.create({name: `BoobaStudio Live Smoke Tile Scene ${Date.now()}`});
                        const tiles = await smokeTileScene.createEmbeddedDocuments('Tile', [{x: 0, y: 0, width: 100, height: 100, texture: {src: 'icons/svg/book.svg'}}]);
                        const tile = tiles?.[0];
                        await tile?.sheet?.render?.(true);
                        await new Promise(resolve => setTimeout(resolve, 700));
                        documentIntegrations.Tile = {created: !!tile, sheetRendered: !!tile?.sheet?.rendered, controlVisible: !!document.querySelector('.boobastudio-document-control')};
                        tile?.sheet?.close?.();
                    } catch (error) {
                        documentIntegrations.Tile = {error: String(error?.message || error)};
                    } finally {
                        if (smokeTileScene) await smokeTileScene.delete();
                    }
                    const sceneIntegration = {sheetRendered: false, controlVisible: false, imageApplied: false, deleted: false};
                    let smokeScene;
                    try {
                        smokeScene = await Scene.create({name: `BoobaStudio Live Smoke Scene ${Date.now()}`});
                        if (smokeScene?.sheet?.render) {
                            await smokeScene.sheet.render(true);
                            await new Promise(resolve => setTimeout(resolve, 800));
                            sceneIntegration.sheetRendered = !!smokeScene.sheet.rendered;
                            const sceneControl = smokeScene.sheet.element?.querySelector?.('.boobastudio-inject-btn');
                            sceneIntegration.controlVisible = !!sceneControl;
                            if (sceneControl) {
                                sceneControl.click();
                                await new Promise(resolve => setTimeout(resolve, 900));
                                const sceneImageWindow = [...document.querySelectorAll('.window, aside')]
                                    .find(element => /image generation|image tools|generate image/i.test((element.innerText || '').slice(0, 700)) && element.querySelector('.targetImg'));
                                const applicationInstances = foundry.applications?.instances instanceof Map ? [...foundry.applications.instances.values()] : Object.values(foundry.applications?.instances || {});
                                const sceneApps = [...(game.applications?.values?.() || []), ...Object.values(ui.windows || {}), ...applicationInstances];
                                const sceneImageApp = sceneApps
                                    .find(app => typeof app?.saveImg === 'function' && (app?.source?.object === smokeScene || app?.document === smokeScene || app?.source?.object?.id === smokeScene.id))
                                    || sceneApps.find(app => typeof app?.saveImg === 'function' && (app?.element === sceneImageWindow || app?.element?.contains?.(sceneImageWindow)));
                                const sceneSaveButton = sceneImageWindow?.querySelector?.('[data-action="saveImg"]');
                                const sceneTargetImage = sceneImageWindow?.querySelector?.('.targetImg');
                                sceneIntegration.imageWindowVisible = !!sceneImageWindow;
                                sceneIntegration.applicationFound = !!sceneImageApp;
                                sceneIntegration.applicationClass = sceneImageApp?.constructor?.name || null;
                                sceneIntegration.applicationDocument = sceneImageApp?.source?.object?.documentName || sceneImageApp?.document?.documentName || null;
                                sceneIntegration.applicationSourceId = sceneImageApp?.source?.object?.id || sceneImageApp?.document?.id || null;
                                sceneIntegration.saveButtonVisible = !!sceneSaveButton;
                                sceneIntegration.targetImageVisible = !!sceneTargetImage;
                                if (sceneSaveButton && sceneTargetImage) {
                                    sceneTargetImage.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
                                    sceneTargetImage.removeAttribute('data-realfile');
                                    if (sceneImageApp && typeof sceneImageApp.saveImg === 'function') await sceneImageApp.saveImg(sceneSaveButton);
                                    else {
                                        sceneSaveButton.click();
                                        await new Promise(resolve => setTimeout(resolve, 3000));
                                    }
                                    const sceneImagePath = smokeScene.background?.src || smokeScene.img || smokeScene.levels?.contents?.[0]?.background?.src || smokeScene.levels?.[0]?.background?.src || null;
                                    sceneIntegration.imageApplied = typeof sceneImagePath === 'string' && sceneImagePath.length > 0;
                                    sceneIntegration.imagePath = sceneImagePath;
                                }
                                sceneImageApp?.close?.();
                            }
                            smokeScene.sheet.close?.();
                        }
                    } catch (error) {
                        sceneIntegration.error = String(error?.message || error);
                    } finally {
                        if (smokeScene) {
                            await smokeScene.delete();
                            sceneIntegration.deleted = !game.scenes.has(smokeScene.id);
                        }
                    }
                    const threadIntegration = {created: false, rendered: false, customModel: false, submitted: false, replyVisible: false, persisted: false, deleted: false, localProvider: false};
                    let localThreadProviderResult;
                    if (typeof globalThis.__boobastudioLocalThreadChat === 'function') {
                        await globalThis.__boobastudioLocalThreadChat(
                            [{role: 'user', content: 'live local thread provider probe'}],
                            result => { localThreadProviderResult = result; },
                            {model: 'mock-local-thread-model'}
                        );
                        threadIntegration.localProvider = localThreadProviderResult?.status === 'done' && /Mock BoobaStudio response/i.test(localThreadProviderResult?.message?.content || '');
                        threadIntegration.providerResult = localThreadProviderResult || null;
                    }
                    const localAuxiliary = {};
                    let describeResult;
                    await globalThis.__boobastudioLocalDescribe({image: 'data:image/png;base64,aW1hZ2U='}, result => { describeResult = result; });
                    localAuxiliary.describe = {status: describeResult?.status || null, hasResult: typeof describeResult?.result === 'string' && describeResult.result.length > 0};
                    let promptBuilderResult;
                    await globalThis.__boobastudioLocalBuildPrompts({command: 'tavern map', amount: 1}, result => { promptBuilderResult = result; });
                    localAuxiliary.promptBuilder = {status: promptBuilderResult?.status || null, validJson: (() => { try { return Array.isArray(JSON.parse(promptBuilderResult?.result || '')); } catch { return false; } })()};
                    let enhanceResult;
                    await globalThis.__boobastudioLocalEnhance('enhance this local prompt', 'Return one sentence.', result => { enhanceResult = result; });
                    localAuxiliary.enhance = {status: enhanceResult?.status || null, hasResult: typeof enhanceResult?.result === 'string' && enhanceResult.result.length > 0};
                    let smokeThreadJournal;
                    try {
                        smokeThreadJournal = await JournalEntry.create({name: `BoobaStudio Live Smoke Thread ${Date.now()}`, content: '', pages: [{name: 'Local Thread', type: 'boobastudio.threadgpt'}]});
                        threadIntegration.created = !!smokeThreadJournal;
                        const smokeThreadPage = smokeThreadJournal?.pages?.contents?.[0];
                        if (smokeThreadPage) {
                            const modelField = smokeThreadPage.schema?.fields?.system?.fields?.model || smokeThreadPage.system?.schema?.fields?.model;
                            threadIntegration.schemaChoices = Object.keys(modelField?.choices || modelField?.options?.choices || {});
                            try {
                                await smokeThreadPage.update({system: {...(smokeThreadPage.system?.toObject?.() || {}), model: 'mock-local-thread-model'}});
                            } catch (error) {
                                threadIntegration.updateError = String(error?.message || error);
                            }
                            threadIntegration.customModel = smokeThreadPage.system?.model === 'mock-local-thread-model';
                            threadIntegration.pageType = smokeThreadPage.type;
                            threadIntegration.system = smokeThreadPage.system?.toObject?.() || smokeThreadPage.system || null;
                        }
                        if (smokeThreadJournal?.sheet?.render && smokeThreadPage) {
                            await smokeThreadJournal.sheet.render(true, {pageId: smokeThreadPage.id});
                            await new Promise(resolve => setTimeout(resolve, 1200));
                            const threadRoot = [...document.querySelectorAll('.boobastudio-thread')]
                                .find(element => element.querySelector('[data-action="sendMessage"]'))
                                || [...document.querySelectorAll('article, .journal-page-content')]
                                    .find(element => /Thread \(GPT Chat\)|send message/i.test((element.innerText || '').slice(0, 1200)));
                            const threadPrompt = threadRoot?.querySelector?.('textarea[name="prompt"], textarea[name="system.prompt"], textarea, [contenteditable="true"], [data-edit="system.prompt"]');
                            const threadSend = threadRoot?.querySelector?.('[data-action="sendMessage"], button[type="submit"]');
                            threadIntegration.controls = [...(threadRoot?.querySelectorAll?.('textarea, input, button, [contenteditable="true"], [data-action]') || [])].map(control => ({tag: control.tagName, name: control.getAttribute('name') || '', action: control.dataset?.action || '', text: (control.innerText || '').trim(), value: control.value || '', contenteditable: control.getAttribute('contenteditable') || ''})).slice(0, 60);
                            threadIntegration.rendered = !!threadRoot && /thread|mock-local-thread-model|send/i.test((threadRoot.innerText || '').slice(0, 1200));
                            if (threadPrompt && threadSend) {
                                threadPrompt.value = 'live custom local thread probe';
                                threadPrompt.dispatchEvent(new Event('input', {bubbles: true}));
                                threadSend.click();
                                await new Promise(resolve => setTimeout(resolve, 1800));
                                threadIntegration.submitted = true;
                                threadIntegration.replyVisible = /Mock BoobaStudio response|provider response/i.test((threadRoot.innerText || '').slice(-1200));
                                threadIntegration.messageCount = smokeThreadPage?.system?.messages?.length || 0;
                                threadIntegration.persisted = threadIntegration.messageCount >= 2;
                            } else if (typeof smokeThreadPage.sheet?._sendMessage === 'function') {
                                const controllerProbe = document.createElement('article');
                                controllerProbe.innerHTML = '<textarea name="prompt"></textarea><button data-action="sendMessage" type="button"></button><div class="mainContentScroller"></div>';
                                document.body.appendChild(controllerProbe);
                                const controllerPrompt = controllerProbe.querySelector('[name="prompt"]');
                                const controllerSend = controllerProbe.querySelector('[data-action="sendMessage"]');
                                controllerPrompt.value = 'live custom local thread probe';
                                await smokeThreadPage.sheet._sendMessage(controllerProbe, controllerSend);
                                await new Promise(resolve => setTimeout(resolve, 1800));
                                threadIntegration.controllerProbe = true;
                                threadIntegration.submitted = true;
                                threadIntegration.messageCount = smokeThreadPage?.system?.messages?.length || 0;
                                threadIntegration.persisted = threadIntegration.messageCount >= 2;
                                threadIntegration.messageUsers = smokeThreadPage?.system?.messages?.map(message => message.user) || [];
                                threadIntegration.replyVisible = /Mock BoobaStudio response|provider response/i.test((smokeThreadPage?.system?.messages || []).map(message => message.message || '').join(' '));
                                controllerProbe.remove();
                            }
                            smokeThreadJournal.sheet.close?.();
                        }
                    } catch (error) {
                        threadIntegration.error = String(error?.message || error);
                    } finally {
                        if (smokeThreadJournal) {
                            await smokeThreadJournal.delete();
                            threadIntegration.deleted = !game.journal.has(smokeThreadJournal.id);
                        }
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
                    const tokenPicker = globalThis.foundry?.applications?.apps?.FilePicker?.implementation || globalThis.FilePicker;
                    let directTokenUpload = null;
                    try {
                        directTokenUpload = await tokenPicker?.upload?.('data', 'modules/boobastudio/storage/token', new File([new Uint8Array([1, 2, 3])], `direct-token-${Date.now()}.bin`, {type: 'application/octet-stream'}), {}, {notify: false});
                    } catch (error) {
                        directTokenUpload = {error: String(error?.message || error)};
                    }
                    const localTokenPath = await globalThis.__boobastudioLocalTokenize?.(
                        actorIntegration.imagePath || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                        'modules/boobastudio/storage/token',
                        `live-token-${Date.now()}.webp`
                    );
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
                        advancedImage,
                        actorIntegration,
                        itemIntegration,
                        documentIntegrations,
                        sceneIntegration,
                        threadIntegration,
                        localAuxiliary,
                        imageStatus: imageResponse.status,
                        image,
                        localPack: {factory: localPackFactory, created: !!localPackId, count: localPacks?.data?.length || 0, updated: updatedPack?.data?.attributes?.tagline === 'Live', deleted: deletedPack?.success === true},
                        localTokenFallback: {factory: localTokenFactory === 'function', providerEnabled: game.settings.get('boobastudio', 'providerEnabled') === true, pickerUpload: typeof tokenPicker?.upload === 'function', directUploadType: typeof directTokenUpload, directUpload: directTokenUpload?.path || directTokenUpload?.target || directTokenUpload?.error || (typeof directTokenUpload === 'string' ? directTokenUpload : null), uploaded: typeof localTokenPath === 'string' && localTokenPath.length > 0, path: localTokenPath || null},
                        smokeWarnings: smokeWarnings.filter(message => /token|image/i.test(message)).slice(-10),
                        providerSettings: [...game.settings.settings.keys()].filter(key => key.startsWith('boobastudio.'))
                    };
                }""",
                {"base": mock_base},
            )
        result.get("advancedImage", {})["editRequest"] = any(request["path"].endswith("/images/edits") for request in MockHandler.requests)
        print(json.dumps({"mockBase": mock_base, "foundry": result, "requests": MockHandler.requests}, indent=2))
        await browser_context.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
