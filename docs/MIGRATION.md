# Migration

The module recognizes macro profiles at `flags.world.characterStateTracker` and reads module profiles first. Schema migrations are ordered functions (`1 → 2`), add the `back` body part without replacing existing data, and preserve unknown fields. A GM may explicitly copy a validated legacy profile into `flags.character-state-tracker.characterStateTracker`; the legacy copy remains as rollback data.
