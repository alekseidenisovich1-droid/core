import * as THREE from 'three';

export interface CubeTransitionTiming {
  total:number;
  gather:number;
  hold:number;
  seedMorph:number;
  seedOnly:number;
}

export interface CubeTimeline {
  readonly elapsed:number;
  readonly gatherEnd:number;
  readonly holdEnd:number;
  readonly seedEnd:number;
  readonly seedOnlyEnd:number;
  readonly compression:number;
  readonly seedMorph:number;
  readonly expansion:number;
}

export const TERRAIN_FORMATION_START=.015;
export const TERRAIN_SOURCE_CONSUMED=.27;
export const TERRAIN_PHASE_SPLIT=.68;
export const TERRAIN_SEED_RELEASE=.97;
export const TERRAIN_SOURCE_COMPLETE=.995;
export const OWNERSHIP_EPSILON=.002;
export const CONTAINMENT_LOCK_EPSILON=.015;
export const CONTAINMENT_RELEASE_EPSILON=.008;

export function advanceNormalized(
  current:number,dt:number,duration:number,direction:1|-1,
):number{
  return THREE.MathUtils.clamp(current+direction*dt/duration,0,1);
}

export function resolveCubeTimeline(progress:number,timing:CubeTransitionTiming):CubeTimeline{
  const elapsed=progress*timing.total;
  const holdEnd=timing.gather+timing.hold;
  const seedEnd=holdEnd+timing.seedMorph;
  const seedOnlyEnd=seedEnd+timing.seedOnly;
  return{
    elapsed,gatherEnd:timing.gather,holdEnd,seedEnd,seedOnlyEnd,
    compression:THREE.MathUtils.smoothstep(elapsed,timing.gather*.45,holdEnd),
    seedMorph:THREE.MathUtils.smoothstep(elapsed,holdEnd,seedEnd),
    expansion:THREE.MathUtils.smoothstep(elapsed,seedOnlyEnd,timing.total),
  };
}

export function terrainSourceConsumption(progress:number):number{
  return THREE.MathUtils.smoothstep(progress,TERRAIN_FORMATION_START,TERRAIN_SOURCE_CONSUMED);
}

export function terrainCompactFill(progress:number):number{
  return 1-THREE.MathUtils.smoothstep(progress,.15,.82);
}

export function terrainMiniChaosRemaining(progress:number):number{
  return 1-THREE.MathUtils.smoothstep(progress,.04,.96);
}
