# Changelog

All notable changes to Character State Tracker will be documented here.

## [1.0.0-fvtt12] - 2026-10-04

### Foundry VTT v12 Compatibility Release

- Preserves schema 2, storage namespaces, UI, Journal pages, backups, artwork, and all 30 OGG cues from the v14 release.
- Replaces the unavailable `DialogV2.input` helper with the documented v12 `DialogV2.prompt` callback flow.
- Adds v12-specific manifest URLs, compatibility validation, deterministic package name, documentation, tests, and release workflow.
- Maintains a separate `foundry-v12` compatibility line without changing the v14 release.

## [1.0.0] - 2026-09-28

### Added

- ApplicationV2 interface with body-map hit zones, profile actions, metric editing, history search, backups, diagnostics, and settings.
- Schema 2 data factory, normalization, validation, revision tracking, queued mutations, and non-destructive legacy migration.
- Journal-backed profiles and derived pages with explicit managed-page markers; GM Notes remain protected.
- Russian/English localization, 54 optimized production artworks, and all 30 local OGG state cues.
- Deterministic release ZIP, SHA-256 manifest, automated tests, static validation, and tag-driven workflow.

### Release gate

Automated verification and package construction pass. A manual Foundry VTT v14 smoke test remains recommended before public publication.
