# Character State Tracker

Character State Tracker is a system-agnostic Foundry VTT v14 module for physical, mental, emotional, and needs tracking.

## Installation

In **Add-on Modules → Install Module**, use:

`https://github.com/RudySimp/character-state-tracker/releases/latest/download/module.json`

After activation, open the tracker from the Journal directory or with `Ctrl+C`. Mutations require GM permission and players remain subject to Journal permissions.

## Data model and safety

- One profile is one JournalEntry.
- The source of truth is `flags.character-state-tracker.characterStateTracker`.
- Summary, Physical, Mental, Needs, and History pages are derived projections and can be repaired.
- The GM Notes page is never overwritten by the generator.
- Legacy `flags.world.characterStateTracker` data is read without mutation; explicit migration copies validated data into the module namespace.
- JSON backups are schema-validated and limited to 10 MiB.

## Features

Body-part map, local pain, active and archived injuries, stepped metrics, mental and emotional axes, needs, temperature, custom states, auditable history, history search, import/export, profile archive, diagnostics, and local state-change audio cues.

## Development

```text
npm test
npm run validate
npm run build
```

The deterministic build creates `dist/character-state-tracker.zip`, `dist/module.json`, and `dist/SHA256SUMS.txt`. The archive has no wrapper directory and uses POSIX path separators.

See [docs/ASSET_MAP.md](docs/ASSET_MAP.md) for the runtime asset map and [RELEASE_NOTES_1.0.0.md](RELEASE_NOTES_1.0.0.md) for the release checklist.

## Interface sections

Physical State uses an interactive body map, overall and local pain, notes, and injury cards. Mental and Emotional State remain separate and support conditions and custom axes. Needs supports standard and custom values; Temperature stores current value and character-specific normal bounds; Custom States are descriptive and add no RPG mechanics.

Summary provides a compact status ribbon and prioritized problems. History displays user, reason, category, filters, and paginated events. Settings groups diagnostics, page repair, GM Notes restoration, backup, migration, profile settings, and temperature controls.

## Data safety

Every Journal mutation goes through one queue per profile, revision checks, normalization, and validation. Future schemas are read-only. Generated pages carry an explicit managed marker, while the GM Notes page is never overwritten. An external GM update refreshes the window only when no local note draft is pending.

## Updating and manual installation

Install a newer release over the previous one and keep a backup. For a manual install, download the release ZIP and extract its contents into the Foundry module directory so that `module.json` is at the module root. After updating, inspect Journal pages and use Repair only when needed.

## Troubleshooting

Export a backup before migrating a detected legacy profile. Use Repair pages for missing or duplicate generated pages, and Diagnostics for future schemas, duplicate injuries, missing managed pages, or large history. Sounds are disabled by default and only play for meaningful state transitions.

## License

No license has been granted for redistribution or modification unless explicitly stated by the author.
