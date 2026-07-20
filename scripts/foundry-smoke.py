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
    parser.add_argument("--text-access", action="store_true", help="Navigate the Text Generation How to Access section")
    parser.add_argument("--probe-journal", action="store_true", help="Open an existing journal and inspect its ProseMirror editor")
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
                    if args.probe_menu or args.probe_text or args.probe_journal:
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
                                    if (%s) {
                                        const access = [...document.querySelectorAll('[data-action="goToHeading"]')]
                                            .find(element => (element.innerText || '').includes('How to Access'));
                                        access?.click();
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                    }
                                }
                                let journal_probe = null;
                                if (%s) {
                                    let journal = game.journal?.contents?.find(entry => entry.pages?.contents?.length)
                                    if (!journal) journal = game.journal?.contents?.[0]
                                    let temporaryJournal = false;
                                    if (!journal && typeof JournalEntry?.create === 'function') {
                                        journal = await JournalEntry.create({
                                            name: `BoobaStudio Smoke ${Date.now()}`,
                                            pages: [{name: 'Smoke Page', type: 'text', text: {format: 1, content: '<p>Smoke test</p>'}}]
                                        });
                                        temporaryJournal = true;
                                    }
                                    if (journal?.sheet) {
                                        await journal.sheet.render(true)
                                        await new Promise(resolve => setTimeout(resolve, 1800))
                                    }
                                    const editors = [...document.querySelectorAll('.ProseMirror, [contenteditable="true"]')]
                                    const menus = [...document.querySelectorAll('.ProseMirror-menubar, .prosemirror-menu, [role="menu"], [data-menu]')]
                                    let hookProbe = null;
                                    const descriptor = editors[0]?.pmViewDesc;
                                    const view = descriptor?.root?.view || descriptor?.view || descriptor?.parent?.root?.view || descriptor?.parent?.view;
                                    const hookMenu = foundry?.prosemirror?.ProseMirrorMenu;
                                    if (hookMenu) {
                                        const config = {};
                                        try {
                                            Hooks.call('getProseMirrorMenuDropDowns', {constructor: hookMenu, schema: {nodes: {div: {}, image: {}}}}, config);
                                            hookProbe = {keys: Object.keys(config), config: JSON.parse(JSON.stringify(config, (key, value) => typeof value === 'function' ? '[function]' : value))};
                                        } catch (error) {
                                            hookProbe = {error: String(error?.stack || error), keys: Object.keys(config)};
                                        }
                                    }
                                    journal_probe = {
                                        collection: {size: game.journal?.size || 0, names: game.journal?.contents?.map(entry => entry.name).slice(0, 20) || []},
                                        hookListeners: Hooks.events?.getProseMirrorMenuDropDowns?.length || 0,
                                        hookProbe,
                                        journal: journal ? {id: journal.id, name: journal.name, pages: journal.pages?.contents?.length || 0} : null,
                                        editors: editors.map(item => ({className: item.className, text: (item.innerText || '').slice(0, 500), keys: Object.keys(item).slice(0, 20), pmKeys: item.pmViewDesc ? Object.keys(item.pmViewDesc).slice(0, 20) : [], rootKeys: item.pmViewDesc?.root ? Object.keys(item.pmViewDesc.root).slice(0, 20) : [], parentKeys: item.pmViewDesc?.parent ? Object.keys(item.pmViewDesc.parent).slice(0, 20) : []})),
                                        menus: menus.map(item => ({className: item.className, text: (item.innerText || '').slice(0, 1200), html: item.outerHTML.slice(0, 4000)})),
                                        buttons: [...document.querySelectorAll('button, a, [data-action], [data-menu]')]
                                            .map(item => ({action: item.dataset.action || '', menu: item.dataset.menu || '', title: item.title || item.getAttribute('aria-label') || '', text: (item.innerText || '').trim()}))
                                        .filter(item => /booba|generate|prose|ai|text/i.test(`${item.action} ${item.menu} ${item.title} ${item.text}`)),
                                        boobastudioMenu: document.querySelector('[data-menu="boobastudio"]')?.outerHTML?.slice(0, 4000) || null,
                                        generatedAction: document.querySelector('[data-action="boobastudio-generate"]')?.outerHTML || null
                                    };
                                    if (temporaryJournal) await journal.delete();
                                }
                                return {
                                    opened: true,
                                    textOpened: %s,
                                    featureWindow: (() => {
                                        const element = [...document.querySelectorAll('.window, aside')]
                                            .find(item => (item.innerText || '').includes('AI Text Generation'));
                                        return element ? {
                                            text: (element.innerText || '').trim().slice(0, 2000),
                                            controls: [...element.querySelectorAll('button, input, textarea, [data-action]')]
                                                .map(control => ({tag: control.tagName, action: control.dataset.action || '', text: (control.innerText || '').trim(), value: control.value || ''}))
                                        } : null;
                                    })(),
                                    windows: [...document.querySelectorAll('.window, aside')]
                                        .map(element => (element.innerText || '').trim().slice(0, 300))
                                        .filter(Boolean),
                                    actions: [...document.querySelectorAll('[data-action]')]
                                        .map(element => ({action: element.dataset.action, text: (element.innerText || '').trim()}))
                                        .filter(item => item.action || item.text),
                                    journalProbe: journal_probe
                                };
                            } catch (error) {
                                return {opened: false, error: String(error?.stack || error)};
                            }
                        }""" % (str(args.probe_text).lower(), str(args.text_access).lower(), str(args.probe_journal).lower(), str(args.probe_text).lower()))
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
