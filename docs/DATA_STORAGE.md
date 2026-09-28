# Data storage

Each profile is one JournalEntry. Structured state is stored in `flags.character-state-tracker.characterStateTracker`; pages are derived human-readable projections with role metadata in `flags.character-state-tracker.characterStateTrackerPage`. The legacy macro namespace `flags.world.characterStateTracker` is read only for migration. Migration copies validated data and never removes the legacy flag. Revision is incremented on writes. GM Notes are user-owned and are not overwritten by page sync.
