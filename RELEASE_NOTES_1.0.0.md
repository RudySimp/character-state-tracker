# Character State Tracker 1.0.0

Release candidate notes for Foundry VTT v14.

## Included

- ApplicationV2 tracker window with profile selection, body map hit zones, metric controls, history search, settings and backup actions.
- Schema 2 factory, normalizer, validator and schema-1 migration.
- JournalEntry flag storage with per-profile revisions, GM-only mutation, local queues and conflict detection.
- Derived Journal pages with managed-page markers and a protected GM Notes page.
- Russian and English localization, optimized PNG artwork and local OGG cue registry.
- Deterministic ZIP builder, SHA-256 manifest, tests, static release validation and tag-driven GitHub release workflow.

## Upgrade notes

The module reads the old macro namespace `flags.world.characterStateTracker` but never silently deletes or rewrites it. Use the explicit migration control after checking the profile. Existing Journal page text is preserved unless the page is marked as managed by this module.

## Release gate

The supplied visual and audio packs have been audited and integrated. Runtime media now contains 54 optimized PNG files and all 30 named OGG cues; numeric source names, WAV variants, and source archives are excluded from the package.

Automated tests, static validation, deterministic packaging, ZIP layout, and checksums are part of the release workflow. Before publishing publicly, complete the Foundry VTT v14 manual smoke checklist in `docs/RELEASE_CHECKLIST.md`; it requires a running Foundry world and cannot be simulated by this repository alone.
