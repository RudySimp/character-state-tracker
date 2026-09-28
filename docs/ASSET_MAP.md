# Runtime asset map

All runtime resources use module-relative paths. Numeric source names and source archives are staging-only and are never shipped.

| Source | Visual description | Semantic role | Runtime path | Used by | Fallback | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `37.png` | Armoured neck and upper chest | Neck | `assets/ui/body-zones/neck.png` | Body map/detail | Body section art | Mapped |
| `38.png` | Armoured back and spine | Back | `assets/ui/body-zones/back.png` | Body map/detail | Body section art | Mapped |
| `39.png` | Left palm | Left hand | `assets/ui/body-zones/left-hand.png` | Body map/detail | Generic hand art | Mapped |
| `40.png` | Right palm | Right hand | `assets/ui/body-zones/right-hand.png` | Body map/detail | Generic hand art | Mapped |
| `42.png` | Foot and ankle | Both feet | `assets/ui/body-zones/feet.png` | Body map/detail | Body section art | Shared intentionally |
| `43.png` | Warm orange flame | Warmth | `assets/ui/needs/warmth.png` | Need metric | Needs section art | Mapped |
| `44.png` | Blue clean-water flame | Hygiene | `assets/ui/needs/hygiene.png` | Need metric | Needs section art | Mapped |
| `45.png` | Defensive shield | Safety | `assets/ui/needs/safety.png` | Need metric | Needs section art | Mapped |
| `46.png` | Linked paired forms | Social contact | `assets/ui/needs/social.png` | Need metric | Needs section art | Mapped |
| `47.png` | Soft padded spiral | Comfort | `assets/ui/needs/comfort.png` | Need metric | Needs section art | Mapped |
| `48.png` | Shielded head | Mental stability | `assets/ui/mental/mental-stability.png` | Mental metric | Mental section art | Mapped |
| `49.png` | Cracked orange core | Stress and panic | `assets/ui/mental/stress-panic.png` | Stress/fear metrics and presets | Mental section art | Shared intentionally |
| `50.png` | Entangled dark knot | Confusion | `assets/ui/mental/confusion.png` | Confusion metric/preset | Mental section art | Mapped |
| `51.png` | Controlled tension spring | Self-control | `assets/ui/mental/self-control.png` | Mental metric | Mental section art | Mapped |
| `52.png` | Symmetric focus star | Concentration | `assets/ui/mental/concentration.png` | Mental metric | Mental section art | Mapped |
| `53.png` | Burnt-out candle | Mental exhaustion | `assets/ui/mental/mental-exhaustion.png` | Mental metric | Mental section art | Mapped |
| `54.png` | Complex blue energy knot | Mood | `assets/ui/emotional/mood.png` | Emotional metric | Emotional section art | Mapped |
| `55.png` | Warm rising sun | Satisfaction | `assets/ui/emotional/satisfaction.png` | Emotional metric | Emotional section art | Mapped |
| `56.png` | Luminous golden vessel | Hope | `assets/ui/emotional/hope.png` | Emotional metric | Emotional section art | Mapped |
| `57.png` | Radiant moving core | Motivation | `assets/ui/emotional/motivation.png` | Emotional metric | Emotional section art | Mapped |
| `58.png` | Protected blue core | Emotional safety | `assets/ui/emotional/emotional-safety.png` | Emotional metric | Emotional section art | Mapped |
| `59.png` | Isolated broken spire | Loneliness | `assets/ui/emotional/loneliness.png` | Emotional metric | Emotional section art | Mapped |
| `60.png` | Balanced turquoise crystal | Calm | `assets/ui/emotional/calm.png` | Calm presentation preset | Emotional section art | Mapped |

The earlier approved pack remains under `assets/ui/core`, `body-zones`, `injury-states`, and `physiology`. All supplied UI imagery is resized to a maximum 512-pixel dimension while preserving alpha. The 23 new files total about 8 MB after optimization rather than shipping their roughly 39 MB source copies.

The release includes exactly the 30 OGG cues registered in `scripts/core/audio-registry.js`. WAV variants and the four source ZIP/RAR archives are excluded.
