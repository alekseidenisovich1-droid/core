# Transition contracts

This file separates reusable topology operations from final-state behavior. The contracts describe the behavior that must be preserved while the current intertwined Cube/Terrain phase code is migrated.

Notation: `CORE` means the ribbon + Kernel/Chaos family used by states 1–5; `COMPACT` is the reduced Chaos handoff topology; `SEED` is the Cube-sized compact handoff; `CUBE` and `TERRAIN` are their stable topologies. `C = {CALM, WORK, ERROR, CRITICAL, CRITICAL_2}`.

## Family matrix

| Source | Target | Composed operations | Dependent directed pairs |
|---|---|---|---|
| C | C | `SETTLE_CORE_STATE` | 20 non-identity pairs among states 1–5 |
| C | CUBE | `ABSORB_CORE_TO_COMPACT` → `COMPACT_TO_SEED` → `EXPAND_SEED_TO_CUBE` | 1–5 → 6 |
| CUBE | C | `COLLAPSE_CUBE_TO_SEED` → `SEED_TO_COMPACT` → `RELEASE_COMPACT_TO_CORE` | 6 → 1–5 |
| C | TERRAIN | `ABSORB_CORE_TO_COMPACT` → `RELEASE_COMPACT_TO_TERRAIN` | 1–5 → 7 |
| TERRAIN | C | `COLLAPSE_TERRAIN_TO_COMPACT` → `RELEASE_COMPACT_TO_CORE` | 7 → 1–5 |
| CUBE | TERRAIN | `COLLAPSE_CUBE_TO_SEED` → `SEED_TO_COMPACT` → `RELEASE_COMPACT_TO_TERRAIN` | 6 → 7 |
| TERRAIN | CUBE | `COLLAPSE_TERRAIN_TO_COMPACT` → `COMPACT_TO_SEED` → `EXPAND_SEED_TO_CUBE` | 7 → 6 |

The runtime exposes these operations through `TransitionController.activeTransition`. Normalized curve functions and named lifecycle thresholds live in `transition-primitives.ts`; Cube and Terrain retain local phase workers for their renderer-specific choreography. Cross-topology coordination uses typed handoffs rather than direct field writes.

## `SETTLE_CORE_STATE`

- Input topology: stable or choreographed CORE.
- Output topology: CORE tuned for the requested state.
- Owner: target architecture `TransitionController`; local ERROR/CRITICAL choreography remains inside its director.
- Canonical progress: normalized settle/recovery progress when a director handoff is required; otherwise an immediate topology no-op with damped appearance parameters.
- Current phases: implicit `blendState()` plus director activation/deactivation and recovery.
- Allowed entities: CORE entities; ERROR debris/damage only while the explicit director handoff owns them.
- Completion: target tuning reached and the previous director produces no geometry-affecting output.
- Interruption: safe to retarget to another CORE state; when leaving CORE, freeze an ownership snapshot and pass it to the next primitive.
- Dependent pairs: every directed pair among states 1–5.

## `ABSORB_CORE_TO_COMPACT`

- Input topology: any CORE state, including the current ribbon orientation and director appearance snapshot.
- Output topology: actual two-shell compact Chaos; for a Cube destination its absolute scale matches the Cube seed, and for a Terrain destination it is the documented smaller handoff.
- Owner: one transition primitive; neither Cube nor Terrain final-state updater may write its progress.
- Canonical progress: `0…1` absorption progress.
- Current phases: Cube `convergeToError`/`kernelHold`; Terrain `convergeSource`/`sourceHold`, with additional containment/consumption values.
- Allowed entities: ribbons, shadows, relevant source debris, Kernel/Chaos shells and binary matter, then compact Chaos. Ribbons retain their natural orbital/self rotation until fully absorbed.
- Completion: compact Chaos owns all matter; ribbons/Kernel/source helpers are inactive, not merely transparent.
- Interruption: safe retarget to another compact-destination family before the completion boundary; otherwise finish to COMPACT, then consume the queued destination.
- Dependent pairs: 1–5 → 6 and 1–5 → 7.

## `RELEASE_COMPACT_TO_CORE`

- Input topology: compact two-shell Chaos with a captured destination CORE appearance.
- Output topology: requested stable CORE state.
- Owner: one transition primitive plus, only after the handoff boundary, the target director.
- Canonical progress: `0…1` release progress.
- Current phases: Cube reaches the typed compact handoff; Terrain `releaseTarget` owns the outward ribbon release for both Cube and Terrain sources. Final-state tuning begins only when this release owns the destination.
- Allowed entities: compact Chaos, then ribbons/Kernel/Chaos overlap according to one ownership curve; no Cube/Terrain stable renderer after it relinquishes matter.
- Completion: CORE owns matter and the target state contract is installed; outgoing topology ownership is zero.
- Interruption: before CORE ownership is established, return to COMPACT; afterward retarget through the appropriate CORE-origin primitive.
- Dependent pairs: 6 → 1–5 and 7 → 1–5.

## `COMPACT_TO_SEED`

- Input topology: actual two-shell compact Chaos at the Cube handoff size.
- Output topology: Cube seed.
- Owner: Cube transition primitive, not Terrain.
- Canonical progress: `0…1` source-to-seed morph.
- Current phases: Cube `morphToSeed` and `seedOnly`; Terrain → Cube currently writes Cube phase/progress directly at handoff.
- Allowed entities: compact Chaos and the glyph-free Cube seed in documented morph overlap; no ribbon, Terrain, Cube-cell, or Cube-glyph ownership.
- Completion: seed owns all matter, compact Chaos is inactive.
- Interruption: reversible to COMPACT until the seed-only boundary; after it, finish to SEED and retarget from there.
- Dependent pairs: 1–5 → 6 and 7 → 6.

## `SEED_TO_COMPACT`

- Input topology: Cube seed.
- Output topology: actual compact Chaos with target palette/scale.
- Owner: Cube transition primitive.
- Canonical progress: `0…1` reverse seed morph.
- Current phases: Cube `reverseSeedOnly` and `seedToKernel`; special `cubeTerrainHandoff` changes scale/warmth for Terrain.
- Allowed entities: seed and compact Chaos in one morph overlap; Cube cells are already inactive, ribbons/Terrain do not yet own matter.
- Completion: compact Chaos owns matter, seed is inactive.
- Interruption: reversible to SEED until compact ownership is established; thereafter queue the next destination.
- Dependent pairs: 6 → 1–5 and 6 → 7. For 6 → 7, the completed compact CHAOS is handed to Terrain through the typed `cube-compact-ready` boundary; Terrain never consumes the seed directly.

## `EXPAND_SEED_TO_CUBE`

- Input topology: Cube seed.
- Output topology: stable Cube cells/glyphs/lights.
- Owner: Cube transition primitive.
- Canonical progress: Cube formation progress `0…1`.
- Current phases: Cube `seedOnly`/`expand`/`idle`.
- Allowed entities: glyph-free seed first, then forming Cube cells/glyphs and Cube lights. CORE and Terrain are off; 0/1 Cube glyphs may not appear before cell formation begins.
- Completion: Cube phase becomes stable `idle`; seed-only ownership is zero.
- Interruption: reverse along the same captured cell formation field, never restart with a discontinuous orientation or seed transform.
- Dependent pairs: 1–5 → 6 and 7 → 6.

## `COLLAPSE_CUBE_TO_SEED`

- Input topology: stable or partially formed Cube.
- Output topology: Cube seed with continuous transform and cell trajectories.
- Owner: Cube transition primitive.
- Canonical progress: normalized collapse `0…1`, derived as the reverse of formation where possible.
- Current phases: Cube `collapseCube`/`reverseSeedOnly`.
- Allowed entities: Cube cells/glyphs/lights and seed; no CORE/Terrain ownership.
- Completion: seed owns all matter and Cube cells/glyphs are inactive.
- Interruption: reversibly resume expansion from the captured progress; do not reset quaternion, phase, or progress.
- Dependent pairs: 6 → 1–5 and 6 → 7. In the Terrain route its completion is the typed boundary to actual compact CHAOS, not an early destination-state switch.

## `RELEASE_COMPACT_TO_TERRAIN`

- Input topology: actual compact two-shell Chaos (including the Cube-origin compact handoff).
- Output topology: stable Terrain point field.
- Owner: Terrain transition primitive.
- Canonical progress: one outward formation progress; front shape, point presence, and source consumption are derived outputs.
- Current phases: Terrain `sourceHold`/`releasePoints`/`propagate`; Cube-origin behavior begins only after the typed compact-CHAOS handoff, with the same Terrain worker as CORE-origin behavior.
- Allowed entities: compact source and Terrain points in controlled overlap; no ribbons after source absorption and no complete Cube.
- Completion: Terrain `idle`, Terrain ownership 1, compact source ownership 0, Terrain camera contract settled.
- Interruption: before the outward ownership midpoint, collapse back to captured compact source; after it, finish to Terrain safe handoff and process the requested destination.
- Dependent pairs: 1–5 → 7 and 6 → 7.

## `COLLAPSE_TERRAIN_TO_COMPACT`

- Input topology: stable or outward-forming Terrain.
- Output topology: actual warm two-shell Chaos, Cube-seed sized for target 6 and half stable Chaos size for targets 1–5.
- Owner: Terrain transition primitive.
- Canonical progress: one inward collapse progress; Terrain point ownership and compact Chaos presence are complementary derived curves.
- Current phases: Terrain `collapsePoints`/`coreToChaos`; `coreToChaos` is a stale name because the removed dense point core no longer exists.
- Allowed entities: Terrain points and the actual Chaos outer/inner shells in documented overlap. No unexplained sphere, dense point core, ribbons, or Cube cells.
- Completion: compact Chaos owns matter at the destination-specific contract size and warm Terrain palette; Terrain is inactive.
- Interruption: a return to Terrain is safe through the same inverse ownership curve. Current code uses a hard-coded remap near `0.68`; migration must preserve its accepted look before replacing the magic threshold.
- Dependent pairs: 7 → 1–5 and 7 → 6.

## Transition controller contract

The target controller holds exactly one record:

```ts
type ActiveTransition = {
  sourceState: StableVisualState;
  requestedState: StableVisualState;
  sourceTopology: Topology;
  targetTopology: Topology;
  primitive: TransitionPrimitive;
  phase: string;
  progress: number;
  interruption: 'reversible' | 'finish-to-handoff' | 'not-interruptible';
};
```

It may also hold one latest queued destination. Entity systems receive a read-only transition snapshot and ownership weights. They do not change `state`, start directors, or write another topology's phase.

## Required interruption matrix

Each extracted primitive must test:

- normal completion at 1× and the existing 0.25× debug speed;
- reverse/return at 25%, 50%, and 75%;
- retarget to each topology family at its declared safe point;
- repeated input to the current destination;
- rapid sequence 2 → 7 → 3 → 6;
- no transform, orientation, opacity, or clock discontinuity at every handoff.
