# Architecture

The module entry point only wires lifecycle hooks and the public API. Data factory, migration, normalization, and validation are independent from Foundry UI. Repository is the sole mutation boundary for Journal flags and serializes mutations per JournalEntry. Journal pages are a derived projection; the GM Notes page is never regenerated. ApplicationV2 prepares display context and delegates writes to Repository. Page, backup, summary, and diagnostics services remain separate so they can be extracted into a future module package.
