import type { VisualState } from './state';
import type { TransitionPrimitive,TransitionTopology } from './transition-debug';

export interface ActiveTransition {
  readonly sourceState:VisualState;
  readonly requestedState:VisualState;
  readonly sourceTopology:TransitionTopology;
  readonly targetTopology:TransitionTopology;
  readonly primitive:TransitionPrimitive;
  readonly phase:string;
  readonly progress:number;
  readonly interruption:'reversible'|'finish-to-handoff'|'not-interruptible';
}

export type TransitionHandoff=
  |{readonly kind:'compact-to-cube';readonly cubeProgress:number}
  |{readonly kind:'compact-to-core';readonly target:VisualState}
  |{readonly kind:'cube-compact-to-core'}
  |{readonly kind:'cube-compact-ready'};

const topologyFor=(state:VisualState):TransitionTopology=>
  state==='cube'?'cube':state==='terrain'?'terrain':'core';

export class TransitionController {
  private committed:VisualState;
  private requested:VisualState;
  private active:ActiveTransition|null=null;
  private handoff:TransitionHandoff|null=null;

  constructor(initialState:VisualState){
    this.committed=initialState;
    this.requested=initialState;
  }

  get stableState(){return this.committed;}
  get requestedState(){return this.requested;}
  get activeTransition(){return this.active;}

  request(target:VisualState){
    const previousRequested=this.requested;
    this.requested=target;
    if(target===this.committed&&!this.active)return;
    if(!this.active){
      this.active={
        sourceState:this.committed,requestedState:target,
        sourceTopology:topologyFor(this.committed),targetTopology:topologyFor(target),
        primitive:'none',phase:'requested',progress:0,interruption:'finish-to-handoff',
      };
    }else if(previousRequested!==target){
      this.active={...this.active,requestedState:target,targetTopology:topologyFor(target)};
    }
  }

  commitStableState(state:VisualState){this.committed=state;}

  describe(
    primitive:TransitionPrimitive,phase:string,progress:number,
    sourceTopology:TransitionTopology,targetTopology:TransitionTopology,
    interruption:ActiveTransition['interruption']='finish-to-handoff',
  ){
    const sourceState=this.active?.sourceState??this.committed;
    this.active={
      sourceState,requestedState:this.requested,sourceTopology,targetTopology,
      primitive,phase,progress:Math.max(0,Math.min(1,progress)),interruption,
    };
  }

  complete(){
    if(this.committed===this.requested)this.active=null;
  }

  publishHandoff(handoff:TransitionHandoff){
    if(this.handoff?.kind===handoff.kind)return;
    this.handoff=handoff;
  }

  consumeHandoff(){
    const handoff=this.handoff;
    this.handoff=null;
    return handoff;
  }

  cubeReverseFloor(compactReadyProgress:number){
    // Every Cube exit reaches actual compact Chaos first. Terrain releases it
    // into points; CORE releases it through the same ribbon primitive used by
    // Terrain -> CORE, so 6 -> 2 has the 7 -> 2 unfolding grammar.
    return this.requested==='cube'?0:compactReadyProgress;
  }

  cubeProgressCommand(reverseActive:boolean,terrainPhase:string):'forward'|'reverse'|'hold'|'reset'{
    const terrainOwnsHandoff=terrainPhase==='collapsePoints'||terrainPhase==='releaseTarget';
    if(this.committed==='cube'&&terrainOwnsHandoff)return'hold';
    if(this.committed==='cube')return'forward';
    if(reverseActive)return'reverse';
    return'reset';
  }
}
