#!/usr/bin/env python3
"""Retrying Foundry v14 smoke harness for BoobaStudio."""

import argparse
import asyncio
import json
import os
import sys

from playwright.async_api import async_playwright


async def launch_world(page, base_url, admin_password):
    await page.goto(f"{base_url}/join", wait_until="domcontentloaded", timeout=30_000)
    await page.wait_for_timeout(1_500)
    if await page.locator('select[name="userid"]').count():
        return
    body = (await page.locator("body").inner_text()).lower()
    if "no active game" not in body and "not currently an active game" not in body:
        return
    await page.goto(f"{base_url}/auth", wait_until="domcontentloaded", timeout=30_000)
    await page.wait_for_timeout(1_500)
    await page.locator("#key").fill(admin_password)
    await page.locator('button[name="action"]').click()
    await page.wait_for_timeout(2_500)
    await page.locator('[data-action="worldLaunch"]').dispatch_event("click")
    await page.wait_for_timeout(10_000)


async def try_join(page, base_url, gm_password):
    await page.goto(f"{base_url}/join", wait_until="domcontentloaded", timeout=30_000)
    await page.wait_for_timeout(1_500)
    if not await page.locator('select[name="userid"]').count():
        return False
    await page.locator('select[name="userid"]').select_option(label="Gamemaster")
    await page.locator('input[name="password"]').fill(gm_password)
    await page.locator('button[name="join"]').dispatch_event("click")
    await page.wait_for_timeout(12_000)
    return page.url.endswith("/game") and await page.evaluate("() => typeof game !== 'undefined' && game.ready")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=os.getenv("BOOBA_FOUNDRY_URL", "https://vtt.hiddenbunker.org"))
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--probe-menu", action="store_true", help="Open the existing BoobaStudio menu and report rendered actions")
    parser.add_argument("--probe-text", action="store_true", help="Open the existing Text Generation feature")
    args = parser.parse_args()
    admin_password = os.getenv("BOOBA_FOUNDRY_ADMIN_PASSWORD")
    gm_password = os.getenv("BOOBA_FOUNDRY_GM_PASSWORD", admin_password or "")
    if not admin_password or not gm_password:
        raise SystemExit("Set BOOBA_FOUNDRY_ADMIN_PASSWORD and BOOBA_FOUNDRY_GM_PASSWORD")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        for attempt in range(1, args.attempts + 1):
            page = await browser.new_page(viewport={"width": 1440, "height": 900})
            try:
                await launch_world(page, args.url.rstrip("/"), admin_password)
                if await try_join(page, args.url.rstrip("/"), gm_password):
                    state = await page.evaluate("""() => ({
                        url: location.href,
                        module: game.modules.contents.filter(m => m.id === 'boobastudio')
                            .map(m => ({active: m.active, version: m.version})),
                        providerSettings: [...game.settings.settings.keys()]
                            .filter(k => k.startsWith('boobastudio.') && /provider|openaiApiKey|image|replicate/.test(k))
                    })""")
                    if args.probe_menu or args.probe_text:
                        state["menuProbe"] = await page.evaluate("""async () => {
                            const module = game.modules.get('boobastudio');
                            if (!module?.api?.menu) return {opened: false, reason: 'module menu API unavailable'};
                            try {
                                module.api.menu();
                                await new Promise(resolve => setTimeout(resolve, 1200));
                                if (%s) {
                                    const textAction = [...document.querySelectorAll('[data-action="openFeature"]')]
                                        .find(element => (element.innerText || '').trim() === 'Text Generation');
                                    if (!textAction) return {opened: true, textOpened: false, reason: 'Text Generation action unavailable'};
                                    textAction.click();
                                    await new Promise(resolve => setTimeout(resolve, 1500));
                                }
                                return {
                                    opened: true,
                                    textOpened: %s,
                                    windows: [...document.querySelectorAll('.window, aside')]
                                        .map(element => (element.innerText || '').trim().slice(0, 300))
                                        .filter(Boolean),
                                    actions: [...document.querySelectorAll('[data-action]')]
                                        .map(element => ({action: element.dataset.action, text: (element.innerText || '').trim()}))
                                        .filter(item => item.action || item.text)
                                };
                            } catch (error) {
                                return {opened: false, error: String(error?.stack || error)};
                            }
                        }""" % (str(args.probe_text).lower(), str(args.probe_text).lower()))
                    print(json.dumps(state, indent=2))
                    await browser.close()
                    return 0
                print(f"attempt {attempt}: Foundry session did not reach ready state", file=sys.stderr)
            finally:
                await page.close()
        await browser.close()
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
