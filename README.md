# CORE — Living Desktop Visual Engine

CORE is a procedural Three.js visual in a transparent, frameless Tauri window. It renders an energetic central core, exactly three independently moving Möbius surfaces, binary glyph layers, migrating black/white/pink/purple gradients, and a typed state/event system.

## Prerequisites (Windows)

- Node.js 20 or newer
- Rust stable with the MSVC toolchain (`rustup default stable-msvc`)
- Microsoft C++ Build Tools and WebView2

Rust is needed for the native Tauri shell. The visual engine itself can be developed in a browser with Node alone.

## Install and run

```powershell
npm.cmd install
npm.cmd run dev
```

Open the Vite URL to test in a browser. To launch the transparent desktop window after Rust is installed:

```powershell
npm.cmd run tauri dev
```

Production builds:

```powershell
npm.cmd run build
npm.cmd run tauri build
```

## Simulation controls

| Key | Action |
| --- | --- |
| `1` | CALM |
| `2` | WORK plus sample metrics |
| `3` | ERROR / full phase sequence ending in static containment |
| `4` | CRITICAL / ten failures on ERROR geometry and coarse binary grid |
| `5` | CRITICAL 2 / ten failures on CALM geometry and dense binary grid |
| `→` / `←` | inspect ten damage modules; in ERROR this pauses the automatic scenario and prevents containment |
| `H` | pin/unpin HUD |
| `D` | automatically cycle all states |
| `A` | toggle automatic Codex process monitoring |

Hover over CORE to reveal the HUD. Drag the invisible strip at the top center to move the native window.

## Architecture

- `src/visual.ts` — scene, core, Möbius geometry, binary particles and animation blending
- `src/shaders.ts` — flowing palette and controlled error-state fracture
- `src/error-director.ts` — ERROR phase choreography and final containment
- `src/critical-error-director.ts` — independent CRITICAL damage modules and escalation
- `src/state.ts` — typed events, store and integration boundary
- `src/config.ts` — tunable density, speed, pulse, contraction and distortion
- `src/main.ts` — event wiring, simulator, HUD and render loop
- `src-tauri/` — transparent always-on-top Windows shell

The renderer consumes immutable store snapshots. The native shell monitors actual `codex.exe` CPU activity and emits `core-activity`: active computation enters `working`, then resolves through `success` to `idle`. A future Codex JSON adapter or VS Code bridge can add exact error/file/command semantics by translating messages into the existing `CoreEvent` union.

## Behavior

Transitions interpolate instead of snapping. Idle breathes; working contracts and accelerates; success releases outward; attention opens the structure; error expands glyph spacing, stutters motion, deforms surfaces and quantizes the continuous palette. Error recovery naturally melts the parameters into the next state.

### Critical ERROR choreography

ERROR is directed as a constrained procedural sequence rather than one looping effect. It moves unpredictably between distortion, tearing, collapse and ejection: local time briefly stutters, binary glyphs detach from rupture zones, RGB channels split around the glyphs, and the three ribbons converge toward one dominant surface while the core absorbs their matter. Leaving contained ERROR smoothly restores the three-ribbon hierarchy without releasing the suppressed failure again. The detached `0`/`1` matter is rendered as one GPU point layer per ribbon, with its density controlled by `ERROR_PARTICLES_PER_RIBBON` in `src/config.ts`.

After all four active ERROR events have appeared, ERROR enters containment: every ribbon is compressed into the core, the outer core shell freezes at a fixed size and position, and only the color, binary matter and bounded ejection-like motion inside it remain active. Returning to CALM or WORK reorients the ribbons while they are still hidden, then expands them directly onto their normal orbits without an outward unwinding spin.

CRITICAL (`4`) keeps ERROR ribbon/core tuning and the coarse ERROR binary grid even while an individual effect is selected. Its automatic events change at twice the original cadence and finish by containing all ribbons inside the core. CRITICAL 2 (`5`) keeps CALM ribbon/core tuning and its dense binary grid. ERROR (`3`) keeps its base glitch while arrow previews add one selected module. All three modes expose the same ten renumbered effects: time desync, frame skip, ghost, missing data, binary ejection, binary attraction, gradient damage, geometry damage, core absorption and core overload. RGB split, color ghosting, binary streak and ribbon collapse were removed from the Critical damage library. Manual arrow preview clears the previous module before displaying the next one. The former Q/W/E/R stage controls were removed.

CALM and WORK render two low-opacity historical ribbon copies with progressively reduced saturation. The matter inside the former core is called **chaos**. In WORK the old spherical core shell dissolves completely: only multilayer moving chaos and its dense `0`/`1` field remain, at a fixed overall size without core breathing. Switching to CALM smoothly gathers those digits into the spherical core; switching back to WORK releases the sphere into chaos again. In ERROR containment the shell remains geometrically fixed, but the core switches back to the dense binary grid and continues rapid digit rewriting and gradient flow.

Pressing `3` always restarts the complete automatic ERROR sequence and its final containment. Pressing either arrow while ERROR is active switches to manual damage inspection: phase choreography is cancelled, the base ERROR glitch remains, and the ribbons stay outside the core while the ten effects are browsed.

## Next integration steps

1. Add a Tauri channel receiving normalized local events.
2. Add Codex CLI JSON and VS Code adapters emitting `CoreEvent` values.
3. Persist window placement and add optional click-through controls.
4. Profile density presets on integrated GPUs and expose a config loader.

## Motion and activity smoothing

Ribbon width, deformation, local twist, orbit radius, digit scale/density, wave behavior, gradient flow, glow and core pulse are damped toward state-specific targets. Orbit, rewrite, gradient and organism-wave phases are accumulated continuously, so a state change never restarts motion.

The native Codex monitor is interpreted through an exponential activity average, separate start/release thresholds, an event debounce, minimum working duration, inactivity delay and success hold. These values, along with digit size, wave amplitudes and the safe render margin, are centralized in `src/config.ts`.

## Current visual model

The primary visual language is limited to CALM, WORK and ERROR. Internal success and attention events resolve visually into CALM. Every mode uses the same continuous periodic wave system: WORK increases its focus and amplitude, while ERROR fractures timing, spacing and gradient continuity.

The three Möbius surfaces use separate nested radii and a single position-welded closure with averaged seam normals. Binary glyphs are generated directly in the GPU material rather than as DOM elements or decorative particles.
