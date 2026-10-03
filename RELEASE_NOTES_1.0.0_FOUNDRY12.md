# Character State Tracker 1.0.0

## Foundry VTT v12 Compatibility Release

This stable compatibility release preserves the full Character State Tracker 1.0.0 data model and interface for Foundry VTT v12.

Preserved functionality includes profiles, body map, injuries, mental and emotional axes, needs, temperature, custom states, summary, history, backups, diagnostics, generated Journal pages, GM Notes protection, all 54 production PNG assets, and all 30 OGG cues.

The storage scope remains `flags.character-state-tracker.characterStateTracker`, page markers remain `flags.character-state-tracker.characterStateTrackerPage`, legacy `flags.world.characterStateTracker` migration remains non-destructive, schema remains version 2, and backup format remains `cst-profile-backup` version 2. Profiles may therefore move between the v12 and v14 compatibility lines without a separate data fork.

Foundry v12 provides ApplicationV2, HandlebarsApplicationMixin, DialogV2, action handlers, JournalEntry pages, document hooks, settings, keybindings, and AudioHelper. The v14 implementation used `DialogV2.input`, which is not part of the v12 API; this release uses the documented `DialogV2.prompt` callback and returns FormData without changing the surrounding workflows.

Automated v12 compatibility validation, import-graph checks, data tests, deterministic packaging, asset validation, and release integrity checks are complete. A live smoke-test in an actual Foundry VTT v12 world is still recommended because no Foundry server/client runtime is included in this repository.
