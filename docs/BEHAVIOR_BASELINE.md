# Behavior baseline and regression record

Date: 2026-08-30. Runtime: native Tauri development window, normal transition speed, build based on the architecture stabilization worktree.

## Stable states inspected

- WORK: three moving ribbons around native two-shell Chaos; no Kernel/Disco Ball lifecycle owner.
- CUBE: complete 8×8×8 cell field with Cube-owned amber/violet lighting; no CORE or Terrain renderer.
- TERRAIN: persistent 43,200-point field with the accepted height/color behavior; no CORE/Cube renderer.

Modes CALM, ERROR, CRITICAL, and CRITICAL_2 retain their existing final-state tuning/directors. Their topology is covered by the shared CORE ownership contract; detailed stochastic director appearance remains intentionally unchanged.

## Native transition captures inspected

| Route | Frames inspected | Result |
|---|---|---|
| 2 → 6 | source-speed ribbon absorption, glyph-free compact handoff, stable Cube | PASS; no loose Cube 0/1 layer before formation |
| 6 → 2 | Cube collapse, compact release, full ribbon return | PASS; live orbit quaternion is released directly, with no release orientation jump observed |
| 2 → 7 | rotating ribbon convergence, outward point front, stable Terrain | PASS |
| 7 → 2 | inward point front, small warm two-shell Chaos, ribbon release | PASS; no separate yellow point sphere |
| 7 → 6 | warm Cube-sized Chaos, seed handoff, stable Cube | PASS |
| 6 → 7 | Cube seed handoff, Terrain formation, stable Terrain | PASS |
| 2 → 7 → 3 → 6 | rapid 200 ms retarget sequence | PASS; native process remained responsive and settled to Cube |

Temporary screenshots were inspected outside the repository. They are not product assets.

## Automated checks

- `npm.cmd run test:architecture`: normalized progress monotonicity, handoff consumption, stable ownership, and Terrain collapse ownership — PASS.
- `npm.cmd run build`: TypeScript and Vite production build — PASS.
- `npm.cmd run test:transitions`: prints the complete 7×7 manual runtime protocol. Identity routes are stable no-ops; unobserved stochastic state pairs remain marked pending rather than claimed as tested.
- `git diff --check`: PASS.

## Environment limitation

No connected in-app browser was available for automated DOM/WebGL instrumentation. Validation used the real native Tauri window, process responsiveness, native window captures, pure transition tests, and the development transition inspector. A future connected-browser run should complete every remaining 7×7 stochastic pair at 1× and 0.25×.
