# Foundry VTT v12 smoke plan

Automated Node tests cover factories, schema migration, normalization, backup round-trip, summary, history, image URL policy, and cue registry. The release validator additionally checks JSON, localization parity, relative named imports, source markers, runtime paths, ZIP policy, and manifest URLs.

## Fresh world

1. Activate the module as GM. Open it from the Journal directory and `Ctrl+C`; close and reopen it ten times to check singleton/listener cleanup.
2. Create a profile, open its Journal, and verify the module flag, folder, managed pages, and untouched GM Notes page.
3. Exercise every section: body map front/back and all 13 hit zones; overall state and pain; metric range/number/quick/preset controls; notes; injury create/edit/archive/restore; mental/emotional conditions and custom axes; all needs and custom needs; temperature; custom states; summary ribbon; history search/filter/load-more; diagnostics and page repair.
4. Export, import into an existing profile, reload the world, and verify identity, revision, history, pages, and selected UI state.

## Safety and permissions

- Create a legacy profile under `flags.world.characterStateTracker`; confirm read-only detection, explicit migration, retained legacy data, and no duplicate pages.
- Create a future-schema flag; confirm read-only UI and rejected import.
- Open as a player with limited Journal permissions; verify no mutation via buttons, manually dispatched actions, or direct UI inputs.
- Use two GM clients: edit different fields and the same field concurrently; verify queued writes, revision/conflict handling, external refresh, and note draft preservation.
- Edit a body note, switch profiles, close the app, and trigger an external update; confirm draft flush or warning, never silent loss.

## Audio and visual pass

Check SFX off/on, mute, volume, cue cooldown, threshold transitions, no replay on initial load/import/migration, and lazy image loading. Test long names, missing profile image, 20 profiles, 20 injuries, 2,000 history events, narrow window, keyboard focus, reduced motion, and missing optional media.

Foundry runtime smoke testing remains a manual release gate because this repository does not include a Foundry server/client runtime.
