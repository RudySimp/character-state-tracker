# Foundry VTT v12 compatibility audit

The audit uses the official Foundry VTT v12 API documentation. The compatibility branch remains based on production tag `v1.0.0` and does not alter schema or storage.

| API / feature | v14 use | v12 status | Compatibility change | Result |
| --- | --- | --- | --- | --- |
| `foundry.applications.api.ApplicationV2` | Main tracker window | Supported | None | Preserved |
| `HandlebarsApplicationMixin` and `PARTS` | Handlebars rendering | Supported | None | Preserved |
| `DEFAULT_OPTIONS.actions` | Template action dispatch | Supported | Validator checks every `data-action` | Preserved |
| `_prepareContext`, `_onRender`, `_preClose` | Lifecycle and draft flushing | Supported | None | Preserved |
| `DialogV2.confirm` | Destructive confirmations | Supported | None | Preserved |
| `DialogV2.input` | Input dialogs | Not available | Replaced with `DialogV2.prompt` and documented button callback returning `FormData` | Adapted without feature loss |
| `Hooks.once/on` | Init, ready, directory and document hooks | Supported | Directory hook accepts either HTMLElement or legacy jQuery wrapper | Preserved |
| `game.settings.register/get` | Client/world settings | Supported | None | Preserved |
| `game.keybindings.register` | Launch hotkey | Supported | None | Preserved |
| `game.modules.get(...).api` | Public open/close API | Supported package access | None | Preserved |
| `AudioHelper.play` | Local and optional GM broadcast audio | Supported | None | Preserved |
| `JournalEntry.create/update/delete` | Profile documents | Supported | None | Preserved |
| `createEmbeddedDocuments` / `updateEmbeddedDocuments` | Generated Journal pages | Supported | None | Preserved |
| JournalEntryPage create/update/delete hooks | External refresh | Supported | Internal-operation marker retained | Preserved |
| `Folder.create` and `game.folders` | Profile folder | Supported | None | Preserved |
| document `getFlag` / `setFlag` | Structured storage | Supported | Namespace unchanged | Preserved |
| `ui.notifications` | User feedback | Supported | None | Preserved |
| document sheets and permissions | Journal/page opening and access | Supported | Existing GM mutation guards retained | Preserved |

No v13/v14-only runtime call remains in production sources. In particular, `DialogV2.input` is rejected by the v12 validator. A live Foundry v12 smoke-test remains recommended and is not represented as completed by the static suite.
