# Changelog

### 2026-02-09

* **Added:** pnpm monorepo scaffold with `@bc/client`, `@bc/server`, and `@bc/core`
* **Added:** strict TypeScript base config, linting, formatting, and workspace scripts
* **Added:** server health endpoint and basic client shell
* **Notes:** established repo conventions (English-only identifiers, comments, changelog updates)
---

Additional notes on 2026-02-09:

* Enabled Vite production build by approving `esbuild` via `onlyBuiltDependencies` in `pnpm-workspace.yaml`.
* Switched `@bc/client` `build` script back to `vite build` and validated output.
* Added `README.md` with installation and run instructions.
* Added root `preview` script delegating to `@bc/client preview`.
* Added `preview:full` script: builds client and serves it from the server (`SERVE_STATIC=1`).
* Server now optionally serves static client build from `apps/client/dist` when `SERVE_STATIC=1`.
* README updated with preview instructions.

* Added root `ci:smoke` script (install ? rebuild esbuild ? -r build/test/lint).


### 2026-02-09 (continued)
* Added action protocol primitives with Zod validation in `@bc/core`.
* Added minimal engine loop with `core.noop` and snapshot/log updates.
* Added in-memory session store and `POST /api/session` endpoint.
* Added Socket.IO wiring: server hello, snapshot broadcast, error handling.
* Updated client to create/join session and dispatch `core.noop`.
* Notes: server remains authoritative; no game rules implemented; state is expansion-ready.
### 2026-02-09 (turn system)
* Added player and turn system to core (`players`, `activePlayerIndex`, `turn`).
* Added first base-game action `core.passTurn` with validation (only active player may act) and deterministic turn advance.
* Server: extended `POST /api/session` to accept `players` (min 2, max 6); defaults to 2 placeholders when omitted; enforces `actorId` membership (`ACTOR_NOT_ALLOWED`).
* Client: debug UI now shows players, highlights active player, displays turn number, and provides a �Pass turn� button.
* Notes: Foundation for all future gameplay actions. Turn logic lives in core; server remains the authority and must not override it.
### 2026-02-09 (board + placeTile)
* Added axial hex coordinate model and board state in core (board.cells as JSON-stable entry array `{ key, tile }`).
* Added core.placeTile action with validation (NOT_ACTIVE_PLAYER, CELL_OCCUPIED, DUPLICATE_TILE_ID) and deterministic placement metadata.
* Client: debug board rendering, inputs for q/r/kind, and "Place tile" button using nanoid-generated tile ids.
* Server: no extra rules; passes action envelope to core; existing actorId enforcement remains.
* Notes: No adjacency/scoring yet; groundwork only. Coordinate key stability documented; core stays deterministic and pure.
### 2026-02-09 (supply + hands)
* Added deterministic tile supply (seeded) and per-player hands to core state.
* Added `core.drawTile` with validation (`SUPPLY_EMPTY`, `HAND_FULL`).
* Updated `core.placeTile` to place from hand by `tileId` (`TILE_NOT_IN_HAND`, `CELL_OCCUPIED`, `DUPLICATE_TILE_ID`).
* Session config now includes `seed`; server accepts optional `seed` and generates one if missing.
* Client shows active hand, can draw tile, and place selected tile at input coords.
* Notes: Determinism documented; no adjacency/scoring and no automatic turn end yet.

### 2026-02-09 (turn phases)`r`n* Added explicit turn phases (awaitingPlacement, awaitingAction, awaitingPass) to core state and engine.`n* Enforced placement ? optional action ? pass sequencing with errors: WRONG_TURN_PHASE, PLACEMENT_ALREADY_DONE, ACTION_NOT_ALLOWED_IN_PHASE.`n* Server: added phase enforcement tests; placement test updated for initial hand.`n* Client: shows phase and enables/disables buttons by phase.`n* Core: initial session now deals 1 tile to each player to enable first placement.

* Cleanup: removed obsolete temp files (tmp_edit_engine.ts, temp_proto_debug.txt).
### 2026-02-09 (influence markers)
* Added influence marker storage (influenceByCoord) with invariants (0..3 per player per tile).
* Added core actions: core.placeInfluence and core.moveInfluence with phase gating (optional action step).
* Added majority helper getTileMajority(state, coord) returning { leaderId, isTie, max } (pure, deterministic by player order).
* Client: debug UI now shows influence per tile, place/move controls, and majority readout.
* Tests: basic influence and majority tests in @bc/core.
* Notes: groundwork only (no hotspots/scoring/noise), server remains authoritative.
### 2026-02-09 (measures/hooks/effects/rounds)
* Activated hook pipeline in engine (onBeforeActionValidate ? schema validate ? gates ? onValidateAction ? reducers ? onApplyAction ? finalize ? onAfterAction ? onSnapshot). Hooks tested.
* Added explicit round model: round, turnInRound, roundStartPlayerIndex; wired to passTurn.
* Added minimal effect layer with deterministic expiry (atTurn/atRound/atNextTurnOfPlayerId) and blocking via hooks; tests included.
* Implemented deterministic measure scaffold helpers (init/take/play/refill/clear) with hand/round/card caps and single recycle; tests included.

- Measure contract (0013 foundation): Added stable core helpers (createMeasureState/takeMeasure/playMeasure/resetMeasureRoundFlags), introduced a test-only measures expansion to prove plug-and-play without core changes, removed a risky runtime require in engine (static import now), and validated engine-owned round reset across all extensions.

## 2026-02-09

- Core: replaced runtime require('../measures/helpers') in packages/core/src/expansion/engine.ts with a static import and removed try/catch swallowing; round reset now calls esetMeasureRoundFlags directly.
- Added test-only expansion package @bc/exp-test-measures proving the Core Measure API (createMeasureState/takeMeasure/playMeasure/resetMeasureRoundFlags) works plug-and-play without changing core.
- Added contract test verifying engine-level round reset clears per-round measure flags for extensions with a measures state.
- Server: kept expansion list production-only (no test expansion wired in server loader).
