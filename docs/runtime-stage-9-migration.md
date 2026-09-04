# Runtime Stage 9 — legacy layer migration map

Stage 9 removes historical patch/hardening ownership from the production runtime without changing player progress, rewards, authored IDs, or server contracts.

## Migration rule

Historical files are temporary strangler boundaries only. New runtime behavior must land in normal `core/`, `game/`, or `features/` modules and must not redefine critical global functions after boot.

The source-quality guard contains the exact temporary allow-list. That allow-list may only shrink during Stage 9.

## Current production layers

| Legacy layer | Current responsibility | Target owner | Migration action |
| --- | --- | --- | --- |
| `js/v30-patch.js` | worlds/chapter presentation, unfinished ★★★ UI, leaderboard modes, duel-history refresh, tutorial hints, capture UI, hub swipe, legacy social auth | `features/campaign/*`, `features/leaderboard/*`, `features/tutorial/*`, `features/mascots/*`, `features/account/*` | split by feature; remove obsolete rarity/social wrappers already superseded by later layers |
| `js/v31-patch.js` | first-run account gate, social auth, old world picker, obsolete SW auto-update owner | `features/account/*`, `features/campaign/picker/*`, `core/update-manager.js` | migrate account UI; delete old picker/update code rather than porting it |
| `js/v31-first-run-ui.js` | two-step first-run presentation layered over v31 | `features/account/first-run-ui.js` | migrate as DOM feature with explicit bootstrap hook |
| `js/v32-ui-fixes.js` | compact challenge markup and campaign quick picker | `features/challenges/*`, `features/campaign/picker/*` | merge with current v34 picker; keep one picker owner |
| `js/v33-fox-journey.js` | Fox progression, abilities, dialogue, journey UI, completion hooks | `features/mascots/fox/*` | split model/abilities/UI; connect through explicit engine/progression hooks |
| `js/v34-product-update.js` | mascot daily, challenge rotation, mascot controls, campaign picker, developer mail, card-back rarity remnants | dedicated feature modules | split by responsibility; delete duplicate picker/rarity code |
| `js/v39-rarity-collectibles.js` | rarity catalog, filters, relics, rarity decoration/notifications | `features/collectibles/rarity/*` | move catalog/runtime UI into one collectible feature owner |
| `js/client-stability-hardening.js` | durable profile checkpoints and account-sync wrappers | `core/persistence/*`, `core/sync-manager.js` | move durability hooks into persistence/sync owners; remove function wrapping |
| `js/mobile-consistency-hardening.js` | canonical game day and atomic completion event transaction | `core/time/*`, `game/progression/*`, pending-event pipeline | preserve exact completion transaction semantics through explicit completion hook |
| `js/cross-device-sync-hardening.js` | cloud-first login/session restore and cloud refresh | `core/account/*`, `core/sync-manager.js` | move account operations to explicit account service; manager remains lifecycle owner |
| `js/canonical-sync-hardening.js` | exact campaign reconciliation and leaderboard projection | `game/progression/*`, `core/sync-manager.js` | make canonical reconcile a normal projection; remove save/sync wrappers |
| `js/ios-round-stability-v2.js` | constrained render/save/animation budget and runtime-fault checkpoint | `core/persistence/*`, `core/animation-manager.js`, renderer | move budgets to owners; keep fault checkpoint semantics |

## Removal order

1. Remove dead duplicate owners first: v31 SW auto-update, older campaign-picker layers, older rarity/social wrappers.
2. Migrate UI-only feature layers that do not own progression state.
3. Migrate feature progression hooks: Fox journey, mascot daily, rarity/relic projections.
4. Migrate durability and canonical progression wrappers only after equivalent explicit hooks have tests.
5. Remove every legacy file from `scripts/build-frontend.mjs` and shrink the source-quality allow-list to zero.

## Stage 9 definition of done

- production build loads no historical patch/hardening file;
- zero monkey-patches of critical runtime functions;
- CI rejects new patch/hardening files and new critical runtime reassignments;
- completion event/ACK, XP, stars, campaign progression, account reconciliation and round recovery tests stay green;
- no authored/content ID changes;
- physical iPhone/PWA smoke is reported separately and never inferred from CI.
