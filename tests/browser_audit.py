"""Run with Python Playwright and Chromium: python tests/browser_audit.py."""
import functools
import http.server
import os
from pathlib import Path
import tempfile
import threading

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
MASTERS = {
    "interior_window": "COMPOSITION",
    "exterior_window": "COMPOSITION",
    "urban_cozy": "COMPOSITION & CAMERA",
    "landscape_architecture": "COMPOSITION",
}


def audit(browser, url, directory):
    context = browser.new_context(permissions=["clipboard-read", "clipboard-write"])
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(url)
    assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
    select = lambda name, value: page.locator("#" + name).select_option(value)
    prompt = page.locator("#prompt")
    master = lambda name: page.locator(f"input[value='{name}']").check()
    for name, heading in MASTERS.items():
        master(name)
        expect(prompt.get_by_role("heading", name=heading + ":", exact=True)).to_have_count(1)
        for family in range(1, 10):
            select("catalog-family", f"family_{family:02d}")
            for variant in range(1, 5):
                select("catalog-style", f"preset_{family:02d}_{variant:02d}")
                expect(prompt.get_by_role("heading", name="SCENE:", exact=True)).to_have_count(1)
    select("catalog-family", "family_04")
    select("catalog-style", "preset_04_01")
    page.locator("#catalog-dna summary").click()
    fields = page.locator("#catalog-options select")
    tested_options = 0
    for field in fields.all():
        defaults = field.evaluate("el => [...el.selectedOptions].map(option => option.value)")
        values = field.locator("option").evaluate_all("opts => opts.map(o => o.value).filter(Boolean)")
        for value in values:
            field.select_option(value)
            expect(prompt.get_by_role("heading", name="SCENE:", exact=True)).to_have_count(1)
            tested_options += 1
        field.select_option(defaults)
    assert fields.count() == 18 and tested_options == 198
    select("dna-environment", "environment.secluded_nature")
    select("dna-water", "water.still_pond")
    page.locator("input[name=subject]").fill("a cedar pavilion")
    for name in [*MASTERS, "interior_window"]:
        master(name)
        assert page.locator("#catalog-style").input_value() == "preset_04_01"
        assert page.locator("#dna-water").input_value() == "water.still_pond"
        assert page.locator("#dna-environment").input_value() == "environment.secluded_nature"
        assert page.locator("input[name=subject]").input_value() == "a cedar pavilion"
        if name in ("urban_cozy", "exterior_window"):
            expect(page.locator("#copy")).to_be_disabled()
            page.locator("#accept-warnings").check()
            expect(page.locator("#copy")).to_be_enabled()
    page.locator(".advanced summary").click()
    page.locator("[name=additional]").fill("Use a diagonal camera angle")
    expect(page.locator("#copy")).to_be_disabled()
    expect(page.locator("#issues")).to_contain_text("kamera frontal")
    page.locator("[name=additional]").fill("")
    master("urban_cozy")
    page.locator("[name=environment]").fill("a dense remote forest")
    expect(page.locator("#copy")).to_be_disabled()
    expect(page.locator("#issues")).to_contain_text("konteks perkotaan")
    page.locator("[name=environment]").fill("")
    master("interior_window")

    lengths = []
    for mode in ("compact", "standard", "full"):
        select("detail-level", mode)
        page.locator("#copy").click()
        expect(page.locator("#toast")).to_have_text("Prompt disalin.")
        contents = page.evaluate("navigator.clipboard.readText()")
        assert "PHOTOGRAPHIC ART DIRECTION" in contents
        lengths.append(len(contents))
    assert lengths[0] < lengths[1] < lengths[2]
    for extension in ("txt", "md"):
        page.locator("#export-menu summary").click()
        with page.expect_download() as event:
            page.locator(f"[data-export={extension}]").click()
        download = event.value
        assert download.suggested_filename.endswith("." + extension)
        exported = Path(download.path()).read_text()
        assert (exported == contents if extension == "txt" else exported.startswith("## SCENE\n"))
    page.locator("#save-open").click()
    page.locator("#save-form input[name=title]").fill("Audit preset")
    page.locator("#save-form button[type=submit], #save-form button.primary").click()
    page.locator("#library-open").click()
    page.get_by_role("button", name="Duplikat").click()
    expect(page.locator(".library-item")).to_have_count(2)
    with page.expect_download() as event:
        page.locator("#backup").click()
    backup = directory / "backup.json"
    event.value.save_as(backup)
    page.get_by_role("button", name="Muat").first.click()
    assert page.locator("input[name=subject]").input_value() == "a cedar pavilion"
    page.evaluate("localStorage.clear()")
    page.reload()
    page.locator("#library-open").click()
    page.locator("#import").set_input_files(backup)
    expect(page.locator(".library-item")).to_have_count(2)
    page.get_by_role("button", name="Muat").first.click()
    assert page.locator("#dna-water").input_value() == "water.still_pond"
    assert not errors, errors
    context.close()

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    mobile.on("pageerror", lambda error: errors.append(str(error)))
    mobile.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    mobile.goto(url)
    expect(mobile.locator("#prompt").get_by_role("heading", name="SCENE:", exact=True)).to_have_count(1)
    assert mobile.evaluate("document.documentElement.scrollWidth === innerWidth")
    assert mobile.locator("#settings").bounding_box()["y"] < mobile.locator("#pratinjau").bounding_box()["y"]
    mobile.get_by_role("link", name="Lihat pratinjau").click()
    assert mobile.url.endswith("#pratinjau")
    assert not errors, errors
    print(f"Chromium passed: 144 master/preset combinations, {tested_options} options, exports, preset round-trip, warnings, desktop/mobile, and console.")


if __name__ == "__main__":
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT / "dist")
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server, tempfile.TemporaryDirectory() as directory, sync_playwright() as runtime:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        browser = runtime.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"))
        audit(browser, f"http://127.0.0.1:{server.server_port}/", Path(directory))
        browser.close()
