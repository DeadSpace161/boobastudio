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
                payload = {"data": [{"b64_json": "bW9ja19pbWFnZQ=="}]}
            elif request.url.endswith("/audio/speech"):
                await route.fulfill(status=200, content_type="audio/mpeg", body="mock-audio")
                return
            elif request.url.endswith("/messages"):
                payload = {"content": [{"type": "text", "text": "Mock Anthropic response"}]}
            elif ":generateContent" in request.url:
                payload = {"candidates": [{"content": {"parts": [{"text": "Mock Gemini response"}]}}]}
            else:
                payload = {"choices": [{"message": {"role": "assistant", "content": "Mock BoobaStudio response"}}]}
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))

        await page.route("https://mock.boobastudio.test/v1/**", mock_route)
        await join_game(page, base_url, password)
        result = await page.evaluate(
                """async ({base}) => {
                    const module = game.modules.get('boobastudio');
                    if (!module?.active) throw new Error('BoobaStudio is not active');
                    await game.settings.set('boobastudio', 'providerEnabled', true);
                    await game.settings.set('boobastudio', 'providerProtocol', 'openai');
                    await game.settings.set('boobastudio', 'providerBaseUrl', base);
                    await game.settings.set('boobastudio', 'providerModel', 'mock-model');
                    await game.settings.set('boobastudio', 'providerJsonMode', false);
                    await game.settings.set('boobastudio', 'clientOnlyMode', true);
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
