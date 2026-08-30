import type { VisualState } from './state';
import { OWNERSHIP_EPSILON,TERRAIN_SOURCE_COMPLETE } from './transition-primitives';

export type VisualEntityKey='ribbons'|'ribbonShadows'|'ribbonGhosts'|'faultParticles'
  |'kernel'|'chaos'|'chaosDigits'|'seedCube'|'cubeCells'|'cubeGlyphs'|'cubeLight'|'terrain';
export type EntityLifecycle='inactive'|'transitional'|'active';

export interface EntityOwnership {
  readonly lifecycle:EntityLifecycle;
  readonly matterWeight:number;
  readonly visible:boolean;
  readonly animate:boolean;
}

export type VisualOwnershipSnapshot=Readonly<Record<VisualEntityKey,EntityOwnership>>;

interface OwnershipInput {
  state:VisualState;
  cubePhase:string;
  terrainPhase:string;
  terrainEntrySource:'core'|'cube'|null;
  terrainSourceConsumption:number;
  terrainPresence:number;
  terrainConvergence:number;
  chaosPresence:number;
  cubePresence:number;
  debug:Readonly<Record<VisualEntityKey,boolean>>;
}

const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const record=(lifecycle:EntityLifecycle,matterWeight:number,debug:boolean,animate=true):EntityOwnership=>({
  lifecycle,matterWeight:clamp(matterWeight),visible:lifecycle!=='inactive'&&debug,
  animate:lifecycle!=='inactive'&&animate,
});

export function resolveVisualOwnership(input:OwnershipInput):VisualOwnershipSnapshot{
  const effectState=input.state==='error'||input.state==='critical'||input.state==='critical2';
  const transitional=input.cubePhase!=='inactive'&&input.cubePhase!=='idle'
    ||input.terrainPhase!=='inactive'&&input.terrainPhase!=='idle';
  let ribbons=false,kernel=false,chaos=false,seed=false,cells=false,cubeLight=false,terrain=false;

  if(input.cubePhase==='inactive'){
    ribbons=true;kernel=effectState;chaos=true;
  }else if(input.cubePhase==='convergeToError'){
    ribbons=true;kernel=false;chaos=true;
  }else if(input.cubePhase==='kernelHold'||input.cubePhase==='morphToSeed'
    ||input.cubePhase==='seedToKernel'||input.cubePhase==='reverseKernelHold'){
    chaos=true;cubeLight=input.cubePhase==='morphToSeed';
  }else if(input.cubePhase==='seedOnly'||input.cubePhase==='reverseSeedOnly'){
    seed=true;cubeLight=true;
  }else if(input.cubePhase==='collapseCube'||input.cubePhase==='expand'||input.cubePhase==='idle'){
    cells=true;cubeLight=true;
  }else if(input.cubePhase==='releaseRibbons'){
    ribbons=true;kernel=effectState;chaos=true;
  }

  if(input.terrainPhase==='convergeSource'){
    terrain=false;
    if(input.terrainEntrySource==='cube'){
      ribbons=false;kernel=false;chaos=false;
    }else{ribbons=true;kernel=false;chaos=true;seed=false;cells=false;cubeLight=false;}
  }else if(input.terrainPhase==='sourceHold'){
    ribbons=false;kernel=false;cells=false;
    seed=input.terrainEntrySource==='cube';
    chaos=input.terrainEntrySource!=='cube';
    cubeLight=false;
  }else if(input.terrainPhase==='releasePoints'||input.terrainPhase==='propagate'){
    ribbons=false;kernel=false;cells=false;terrain=true;
    seed=input.terrainEntrySource==='cube'&&input.terrainSourceConsumption<TERRAIN_SOURCE_COMPLETE;
    chaos=input.terrainEntrySource!=='cube'&&input.chaosPresence>OWNERSHIP_EPSILON;
    cubeLight=false;
  }else if(input.terrainPhase==='idle'){
    ribbons=false;kernel=false;chaos=false;seed=false;cells=false;cubeLight=false;terrain=true;
  }else if(input.terrainPhase==='collapsePoints'||input.terrainPhase==='compactPaletteHandoff'){
    ribbons=false;kernel=false;chaos=true;seed=false;cells=false;cubeLight=false;terrain=true;
  }else if(input.terrainPhase==='releaseTarget'){
    ribbons=true;kernel=effectState;chaos=true;seed=false;cells=false;cubeLight=false;terrain=false;
  }

  terrain=terrain&&input.terrainPresence>OWNERSHIP_EPSILON;
  const lifecycle:EntityLifecycle=transitional?'transitional':'active';
  const coreWeight=ribbons?clamp(1-input.terrainConvergence):0;
  const chaosWeight=chaos?input.chaosPresence:0;
  const cubeWeight=cells?input.cubePresence:0;
  const terrainWeight=terrain?input.terrainPresence:0;
  return{
    ribbons:record(ribbons?lifecycle:'inactive',coreWeight,input.debug.ribbons),
    ribbonShadows:record(ribbons?lifecycle:'inactive',coreWeight,input.debug.ribbonShadows),
    ribbonGhosts:record(ribbons?lifecycle:'inactive',coreWeight,input.debug.ribbonGhosts),
    faultParticles:record(ribbons?lifecycle:'inactive',coreWeight,input.debug.faultParticles),
    kernel:record(kernel?lifecycle:'inactive',coreWeight,input.debug.kernel),
    chaos:record(chaos?lifecycle:'inactive',chaosWeight,input.debug.chaos),
    chaosDigits:record(chaos&&effectState?lifecycle:'inactive',chaosWeight,input.debug.chaosDigits),
    seedCube:record(seed?'transitional':'inactive',seed?1:0,input.debug.seedCube),
    cubeCells:record(cells?lifecycle:'inactive',cubeWeight,input.debug.cubeCells),
    // The seed is deliberately glyph-free: CORE -> CUBE has one readable
    // compact CHAOS reservoir, then a clean Cube formation. Binary 0/1 atoms
    // are introduced only with the forming/formed cell field.
    cubeGlyphs:record(cells?lifecycle:'inactive',cubeWeight,input.debug.cubeGlyphs),
    cubeLight:record(cubeLight?lifecycle:'inactive',cubeWeight,input.debug.cubeLight),
    terrain:record(terrain?lifecycle:'inactive',terrainWeight,input.debug.terrain),
  };
}
