# 1.0.0 release checklist

Automated checks run in the repository root:

- [x] `npm test`
- [x] `npm run validate`
- [x] `npm run build` (equivalent deterministic local build; CI runs the Python builder)
- [x] `dist/character-state-tracker-v12.zip`, `dist/module.json`, and `dist/SHA256SUMS.txt` exist
- [x] `module.json` is at ZIP root; every ZIP entry uses `/`; no wrapper directory
- [x] ZIP excludes `.git`, tests, tools, docs, archives, WAV, source art, `_reference`, and `_rejected`
- [x] the manifest version and tag are `1.0.0` / `v1.0.0-fvtt12`
- [x] checksum file matches the built ZIP and manifest

Manual Foundry VTT v12 smoke test (not executable in Node):

- [ ] fresh world: enable module, open from Journal directory and keybinding
- [ ] create, rename, archive, restore, and delete a profile with the confirmation guard
- [ ] edit body, pain, injuries, mental/emotional axes, conditions, needs, temperature, and custom states
- [ ] reload world and verify profiles, selected UI state, history, and generated pages remain intact
- [ ] two GMs edit one profile; verify external refresh and no silent local-note loss
- [ ] player sees only permitted Journal content and cannot mutate through UI actions
- [ ] legacy `flags.world.characterStateTracker` profile is readable, migratable, and retained
- [ ] duplicate/missing managed pages repair without touching GM Notes
- [ ] export/import, future-schema read-only behavior, diagnostics, and page repair
- [ ] SFX disabled/enabled, volume, cooldown, threshold transitions, and no initial-load replay
- [ ] visual pass for long names, many profiles, 2,000 history events, missing image, and responsive layout

The automated release gate may publish this compatibility release. The live Foundry v12 checklist remains a recommended post-publication smoke test and is not claimed as completed.
