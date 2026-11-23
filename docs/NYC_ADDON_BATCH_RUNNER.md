# NYC addon batch inspector — local-only

Processes the `addons` array **in order** and creates a machine-readable audit. It inventories already downloaded ZIP archives, calculates SHA-256, checks for unsafe ZIP members, and inspects compatible GLB2 triangle counts. It does not access `creds.txt`, log in, download, execute archived code, convert proprietary MSFS `.bgl`, or modify PATROL's runtime assets.

The five IDs in `tools/nyc_addon_batch.example.json` are publicly known candidate examples, **not the full attachment list previously collected by the account**. Fill in actual local archive filenames only after the files exist. Do not commit account cookies, password files, signed attachment URLs, downloaded archives, or private evidence.

## PowerShell (from the PATROL repo root)

```powershell
python tools/nyc_addon_batch.py `
  --manifest tools/nyc_addon_batch.example.json `
  --archives "$env:USERPROFILE\Downloads\NYC-Addons" `
  --evidence "$env:USERPROFILE\Documents\NYC-Addon-Rights" `
  --report "$env:TEMP\nyc-addon-inventory.json"
```

The report gives each addon ID, status, archive SHA-256, ZIP file names and uncompressed sizes, GLB candidates and triangle counts. `.7z` and `.rar` archives are marked `unsupported_archive_format` until inspected separately with trusted tools.

## Rights and staging

Flightsim.to's general personal-use license is not a blanket grant to extract, alter, convert, or redistribute MSFS assets in PATROL. See https://flightsim.to/terms . Obtain explicit permission covering the intended game, public distribution and dependencies before reusing any model.

For an independently reviewed permission record, an item may include:

```json
{
  "id": 999999,
  "title": "EXAMPLE ONLY: licensed model",
  "archive": "licensed-example.zip",
  "rights_evidence": "999999-permission.txt",
  "rights": {
    "modify": true,
    "cross_game": true,
    "redistribute": true,
    "dependencies_clear": true
  }
}
```

The evidence must be a real local file inside the `--evidence` directory. The four booleans are user-supplied review claims, **not** independent legal verification. Do not set them without checking the actual grant. With `--stage-approved "$env:TEMP\nyc-addon-glb-review"`, small GLBs from claimed approved entries are copied to a private local *review* directory. This never enables them in the game or uploads them. Each GLB still requires mesh/material/render verification and human license review.

## Test

```powershell
python -m unittest discover -s tests -p 'test_nyc_addon_batch.py' -v
```
