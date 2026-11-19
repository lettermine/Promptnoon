"""Build the browser's read-only catalog from the checked-in SQLite handoff."""
import hashlib
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TABLES = {
    "meta": "key",
    "visual_families": "sort_order, id",
    "palettes": "id",
    "palette_swatches": "palette_id, position",
    "dna_options": "category, id",
    "style_presets": "family_id, sort_order, id",
    "preset_palette_links": "preset_id, role, palette_id",
    "preset_feature_defaults": "preset_id, category, ordinal",
    "locked_modules": "id",
    "compatibility_rules": "id",
}

with sqlite3.connect((ROOT / "data/prompt_generator.sqlite").as_uri() + "?mode=ro", uri=True) as db:
    db.row_factory = sqlite3.Row
    if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or db.execute("PRAGMA foreign_key_check").fetchone():
        raise SystemExit("SQLite integrity or foreign-key validation failed.")
    catalog = {
        table: [dict(row) for row in db.execute(f"SELECT * FROM {table} ORDER BY {order}")]
        for table, order in TABLES.items()
    }

for module in catalog.pop("locked_modules"):
    actual = hashlib.sha256(module["body"].encode()).hexdigest()
    if not module["locked"] or actual != module["hash_sha256"]:
        raise SystemExit(f"Checksum mismatch for {module['id']}")

output = ROOT / "dist/seed-catalog.mjs"
temporary = output.with_suffix(".tmp")
temporary.write_text(
    "// Generated from data/prompt_generator.sqlite by scripts/export_catalog.py.\n"
    + "export default " + json.dumps(catalog, ensure_ascii=False, indent=2) + ";\n",
    encoding="utf-8",
)
temporary.replace(output)
