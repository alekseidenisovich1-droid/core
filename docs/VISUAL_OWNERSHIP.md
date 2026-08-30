# Visual ownership

This is the ownership design reference and the audit of current authorities. `ON` means the stable state may own the entity; `OFF` means it must not own matter even if the object remains allocated. `TRANSITIONAL` is reserved for an active transition primitive. Appearance within an owned ERROR/CRITICAL entity may still be phase-gated.

## Stable-state matrix

| Entity | CALM | WORK | ERROR | CRITICAL | CRITICAL_2 | CUBE | TERRAIN |
|---|---|---|---|---|---|---|---|
| Ribbon glyph surfaces ×3 | ON | ON | ON | ON | ON | OFF | OFF |
| Ribbon dark shadow surfaces ×3 | ON | ON | ON | ON | ON | OFF | OFF |
| Ribbon ghost surfaces ×6 | ON | ON | ON | ON | ON | OFF | OFF |
| Kernel sphere | OFF | OFF | ON | ON | ON | OFF | OFF |
| Chaos outer shell | ON | ON | ON | ON | ON | OFF | OFF |
| Chaos inner shell | ON | ON | ON | ON | ON | OFF | OFF |
| Chaos internal binary points / Disco Ball reservoir | OFF | OFF | ON | ON | ON | OFF | OFF |
| ERROR ejection/debris and damage particles | OFF | OFF | ON | ON | ON | OFF | OFF |
| Cube cells | OFF | OFF | OFF | OFF | OFF | ON | OFF |
| Cube seed | OFF | OFF | OFF | OFF | OFF | OFF | OFF |
| Cube glyph points | OFF | OFF | OFF | OFF | OFF | ON | OFF |
| Cube amber/violet lights | OFF | OFF | OFF | OFF | OFF | ON | OFF |
| Terrain points | OFF | OFF | OFF | OFF | OFF | OFF | ON |
| Persistent scene lights | ON | ON | ON | ON | ON | ON | ON |

Kernel and fault-entity ownership in modes 3–5 is director-phase dependent but remains inside that final state's topology contract. Cube seed is a transition entity and is OFF in stable Cube; it is intentionally glyph-free. Cube 0/1 glyphs begin only when the cell field begins to form. Terrain's wave front is a shader region of Terrain points, not a separate renderer.

## Primitive ownership matrix

| Entity family | ABSORB CORE→COMPACT | RELEASE COMPACT→CORE | COMPACT↔SEED | SEED↔CUBE | COMPACT→TERRAIN | TERRAIN→COMPACT |
|---|---|---|---|---|---|---|
| Ribbons/shadows/ghosts | TRANSITIONAL | TRANSITIONAL | OFF | OFF | OFF after absorption | OFF |
| Kernel | TRANSITIONAL | TRANSITIONAL | OFF | OFF | OFF | OFF |
| Chaos shells | TRANSITIONAL | TRANSITIONAL | TRANSITIONAL | OFF | TRANSITIONAL source | TRANSITIONAL target |
| Chaos binary/debris | TRANSITIONAL | TRANSITIONAL | TRANSITIONAL only if contract names it | OFF | OFF after source handoff | OFF unless explicitly part of compact Chaos |
| Cube seed | OFF | OFF | TRANSITIONAL | TRANSITIONAL | TRANSITIONAL only for Cube-origin variant | OFF |
| Cube cells/glyphs/lights | OFF | OFF | OFF | TRANSITIONAL | OFF | OFF |
| Terrain points/front | OFF | OFF | OFF | OFF | TRANSITIONAL | TRANSITIONAL |

## Complete entity registry

Construction and updates are in `src/visual.ts` unless noted. All Three.js objects persist in the scene after construction; deactivation currently means a mix of group visibility, material opacity, shader alpha, scale, and zero emission.

| Entity | Created / shaders | Current update and authorities | Stable/transition use | Current deactivation |
|---|---|---|---|---|
| Renderer, scene, root, camera | `CoreVisual` constructor; WebGL renderer | `update()` renders; root transform is written from state/error/Cube containment; camera is damped from `terrainPresence`; resize path changes projection/size | All states and transitions | Never deactivated |
| Kernel | Sphere mesh; shared `vertexShader`/`fragmentShader`, `uMobius=0` | `update()` writes scale, quaternion, shader time/intensity/visibility and damage inputs; visibility also depends on stable Chaos/Cube/Terrain gates and ownership | ERROR/CRITICAL family; CORE/Cube absorption/release | Group visibility plus `uVisibility`/alpha/intensity |
| Chaos outer shell | Containment group child 0; `containmentVertexShader`/`containmentFragmentShader` | `update()` writes group scale/rotation and uniforms from stable Chaos, ERROR containment, Cube compression, Terrain warmth/fill; `applyVisualOwnership()` also gates group | Stable CORE, ERROR containment, compact handoffs | Group visibility, `uIntensity`, `uFillProgress`, scale |
| Chaos inner shell | Containment group child 1; same containment shaders | Same authorities as outer shell with independent clock/layer parameters | Same as outer shell | Same stacked mechanisms |
| Chaos internal binary points / Disco Ball reservoir | Containment group child 2, 640 points; `coreChaosVertexShader`/`coreChaosFragmentShader` | `update()` writes time, compression, intensity, fill, warmth; visibility is additionally phase- and topology-gated | Stable CORE and fault/containment choreography; formerly Cube reservoir | Points visibility plus shader intensity/fill/alpha |
| Ribbon glyph surfaces ×3 | One group per ribbon; shared Kernel/ribbon shaders with `uMobius=1` | Ribbon loop writes orbit/self transforms, uniforms, absorption, relief, damage, visibility; group visibility from ownership | Stable CORE and CORE compact transitions | Group visibility plus `uVisibility`/fragment alpha |
| Ribbon dark shadow surfaces ×3 | MeshStandardMaterial companion per ribbon | Ribbon transform path; `updateLightRig()` writes opacity/visibility separately from parent ownership | Stable CORE and transition silhouette | Parent/group visibility plus material opacity and direct `.visible` |
| Ribbon ghost surfaces ×6 | Two shader meshes per ribbon | Ribbon loop derives offsets/intensity from Critical signals; absent from `VisualEntityKey` | ERROR/CRITICAL choreography | Parent visibility plus shader visibility/intensity |
| Ejection/debris/damage particles | Per-ribbon point systems; particle shaders | Ribbon/error loop writes positions/uniforms from merged director signals; Terrain/Cube gates also suppress them; absent from ownership enum | ERROR and CRITICAL phases, recovery handoffs | Points visibility and shader alpha/emission |
| Cube cells | 512-cell instanced mesh; Cube cell shaders/material | `updateCubeMatter()` writes transforms/formation; update writes Cube rotation/time/material parameters; ownership and phase gates visibility | Stable Cube; seed expansion/collapse | Mesh visibility plus formation/opacity |
| Cube seed | Separate seed mesh/material | Cube updater and Terrain handoff write scale/visibility/transform using Cube progress and special handoff flag | COMPACT↔SEED, SEED↔CUBE, Cube/Terrain handoff | Mesh visibility/opacity |
| Cube glyph points | 2,048 points; Cube glyph shaders | Cube updater writes visibility/time/formation; ownership gates group | Stable Cube and Cube formation/collapse | Points visibility plus `uVisibility` |
| Cube amber light | Point light | `updateLightRig()` intensity; ownership visibility | Cube formation/stable Cube | Intensity and `.visible` |
| Cube violet light | Point light | `updateLightRig()` writes visibility/intensity, then `applyVisualOwnership()` can overwrite visibility | Cube formation/stable Cube | Two independent `.visible` writers plus intensity |
| Terrain points | 43,200 points; `terrainVertexShader`/`terrainFragmentShader` | `updateTerrainTransition()` owns phase/presence; `update()` supplies time and camera-relative shader inputs; group visibility directly set outside generic ownership | Stable Terrain and both Terrain transition directions | Group visibility plus `uPresence` and per-point alpha |
| Terrain transition front | No separate geometry; region derived in Terrain shaders | Derived from Terrain phase/progress/front uniforms | COMPACT→TERRAIN and TERRAIN→COMPACT | Disappears when Terrain renderer is inactive |
| Ambient, hemisphere, directional key | Scene lights | `updateLightRig()` from state/energy/error/containment | All states | Intensity only |
| Four root point lights | Persistent point lights | Root transform plus `updateLightRig()` intensity/color | CORE family and transitions; may provide residual scene illumination elsewhere | Intensity only |
| UI HUD and controls | `index.html`, `src/main.ts`, `src/controls.css` | DOM event handlers and pointer-idle logic | Developer/user controls, not topology matter | CSS classes/styles; independent of visual ownership |

## Retired visibility conflicts

Before stabilization, the following entities had more than one independent visibility authority. They are retained here as regression history:

| Entity | Authorities | Risk |
|---|---|---|
| Kernel | `getVisualOwnership()`/`applyVisualOwnership()`, stable Chaos presence, Cube matter presence/phase, Terrain gates, shader `uVisibility`, shader intensity | An inactive topology can remain allocated, animated, and alpha-capable; small condition changes expose it |
| Chaos shells | ownership group gate, stable Chaos presence, ERROR containment, Cube compression/seed morph, Terrain presence/source consumption, group scale, `uIntensity`, `uFillProgress` | Same renderer represents several conceptual owners |
| Chaos binary points | group ownership, points `.visible`, fault/containment gates, Cube/Terrain gates, shader intensity/fill/alpha | Hidden reservoir can reappear when one gate changes |
| Ribbon glyphs | group ownership, Cube/Terrain phase gates, cube matter presence, shader `uVisibility` and absorption alpha | Ownership and appearance can disagree |
| Ribbon shadows | parent ownership, `updateLightRig()` `.visible`, opacity | Update-order dependency |
| Ribbon ghosts | parent ownership, director intensity, shader visibility | Not represented by ownership enum |
| Damage/ejection particles | direct `.visible`, director outputs, topology gates, shader alpha/emission | Recovery can leak into a new owner |
| Cube cells/glyphs/seed | Cube phase conditions, presence/formation, generic ownership, shader/material opacity | Cube and Terrain updaters both affect lifecycle |
| Cube violet light | `updateLightRig()` and `applyVisualOwnership()` | Last writer wins |
| Terrain points | `updateTerrainTransition()` group `.visible`, `terrainPresence`, shader `uPresence`/formed alpha | Terrain is absent from `getVisualOwnership()` and owns itself separately |

## Authoritative ownership runtime

Each frame `resolveVisualOwnership()` emits exactly one record per entity:

```ts
type EntityOwnership = {
  lifecycle: 'inactive' | 'transitional' | 'active';
  matterWeight: number;       // 0..1, sums according to a documented morph
  visible: boolean;           // derived from lifecycle, not from appearance
  animate: boolean;           // explicit clock policy
};
```

Opacity, emission, scale, and shader intensity are appearance inputs derived after ownership. They cannot reactivate an entity. Helpers, ghosts, debris, lights, and Terrain are first-class keys. `applyVisualOwnership()` is the only runtime visibility writer.
