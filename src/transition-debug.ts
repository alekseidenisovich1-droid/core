import type { VisualState } from './state';

export type TransitionTopology='core'|'compact'|'seed'|'cube'|'terrain';
export type TransitionPrimitive='none'|'settle-core-state'|'absorb-core-to-compact'
  |'release-compact-to-core'|'compact-to-seed'|'seed-to-compact'
  |'expand-seed-to-cube'|'collapse-cube-to-seed'
  |'release-compact-to-terrain'|'collapse-terrain-to-compact';

export interface TransitionDebugSnapshot {
  finalState:VisualState;
  requestedState:VisualState;
  transitionActive:boolean;
  primitive:TransitionPrimitive;
  phase:string;
  progress:number;
  sourceTopology:TransitionTopology;
  targetTopology:TransitionTopology;
  matterOwners:readonly string[];
  ownership:Readonly<Record<string,number>>;
  orientationLocked:boolean;
  chaosClocksEnabled:boolean;
  activeDirectors:readonly string[];
  pixelContributors:readonly string[];
  invariantViolations:readonly string[];
}

export function transitionInvariantViolations(
  snapshot:Omit<TransitionDebugSnapshot,'invariantViolations'>,
):string[]{
  const violations:string[]=[];
  const fullOwners=Object.entries(snapshot.ownership)
    .filter(([,weight])=>weight>.999).map(([owner])=>owner);
  if(fullOwners.length>1){
    violations.push(`multiple full matter owners: ${fullOwners.join(', ')}`);
  }
  if(!snapshot.transitionActive&&snapshot.primitive!=='none'){
    violations.push('inactive transition exposes a primitive');
  }
  if(snapshot.transitionActive&&snapshot.primitive==='none'){
    violations.push('active transition has no primitive');
  }
  if(!snapshot.transitionActive&&snapshot.finalState!==snapshot.requestedState){
    violations.push('stable runtime does not match requested state');
  }
  if(snapshot.finalState==='terrain'&&!snapshot.transitionActive){
    const forbidden=fullOwners.filter(owner=>owner!=='terrain');
    if(forbidden.length)violations.push(`stable Terrain retains ${forbidden.join(', ')}`);
  }
  if(snapshot.finalState==='cube'&&!snapshot.transitionActive){
    const forbidden=fullOwners.filter(owner=>owner!=='cube');
    if(forbidden.length)violations.push(`stable Cube retains ${forbidden.join(', ')}`);
  }
  return violations;
}

export class TransitionInvariantMonitor {
  private previousSignature='';

  report(snapshot:TransitionDebugSnapshot){
    const environment=(import.meta as ImportMeta&{env?:{DEV?:boolean}}).env;
    if(environment?.DEV===false||snapshot.invariantViolations.length===0){
      this.previousSignature='';
      return;
    }
    const signature=snapshot.invariantViolations.join('|');
    if(signature===this.previousSignature)return;
    this.previousSignature=signature;
    console.warn('[CORE transition invariant]',snapshot.invariantViolations,snapshot);
  }
}
