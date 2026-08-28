export type ErrorPhase='distortion'|'tear'|'collapse'|'eject'|'containment';

export interface ErrorSignals {
  distortion:number;
  tear:number;
  collapse:number;
  eject:number;
  containment:number;
  jerk:number;
  seed:number;
}

const smooth=(value:number,target:number,dt:number,rate=4.2)=>
  value+(target-value)*(1-Math.exp(-dt*rate));

/** Procedural ERROR sub-state orchestration with constrained randomness. */
export class ErrorDirector {
  private requested=false;
  private recovering=false;
  private manualOverride=false;
  private phase:ErrorPhase='distortion';
  private elapsed=0;
  private duration=1.4;
  private jerkElapsed=0;
  private jerkDuration=.14;
  private jerkTarget=0;
  private activePhaseCount=0;
  private activePhaseTarget=5;
  private visited=new Set<ErrorPhase>();
  private signals:ErrorSignals={distortion:0,tear:0,collapse:0,eject:0,containment:0,jerk:0,seed:Math.random()*97};

  setActive(active:boolean){
    if(active===this.requested)return;
    this.requested=active;
    if(active){
      this.startSequence();
    }else{
      this.recovering=true;
      // Keep the failure contained while the macro ERROR intensity fades. This
      // reconstructs the ribbons without releasing the suppressed fault again.
      this.begin('containment',1.8);
    }
  }

  setManualOverride(active:boolean){
    if(active===this.manualOverride)return;
    this.manualOverride=active;
    if(active){this.recovering=false;this.elapsed=0;}
    else if(this.requested)this.startSequence();
  }

  update(dt:number,macroIntensity:number):Readonly<ErrorSignals>{
    this.elapsed+=dt;
    if(this.requested&&!this.manualOverride&&this.phase!=='containment'
      &&this.elapsed>=this.duration)this.begin(this.nextPhase());
    if(this.recovering&&this.elapsed>=this.duration)this.recovering=false;

    const target={distortion:0,tear:0,collapse:0,eject:0,containment:0};
    if(!this.manualOverride&&(this.requested||this.recovering))target[this.phase]=1;
    // Neighboring sub-phases overlap slightly, keeping the failure organic.
    // Manual damage browsing owns the scene completely, so even these tails
    // must disappear after the first arrow press.
    if(!this.manualOverride){
      if(this.phase==='tear')target.distortion=.38;
      if(this.phase==='collapse')target.tear=.28;
      if(this.phase==='eject'){target.tear=.18;target.distortion=.22;}
    }
    this.signals.distortion=smooth(this.signals.distortion,target.distortion*macroIntensity,dt);
    this.signals.tear=smooth(this.signals.tear,target.tear*macroIntensity,dt);
    this.signals.collapse=smooth(this.signals.collapse,target.collapse*macroIntensity,dt);
    this.signals.eject=smooth(this.signals.eject,target.eject*macroIntensity,dt);
    this.signals.containment=smooth(this.signals.containment,target.containment*macroIntensity,dt,2.7);

    this.jerkElapsed+=dt;
    if(this.jerkElapsed>=this.jerkDuration){
      this.jerkElapsed=0;
      this.jerkDuration=.07+Math.random()*.24;
      const strength=(.25+this.signals.distortion*.55+this.signals.tear*.8+this.signals.collapse*.35)
        *(1-this.signals.containment);
      this.jerkTarget=(Math.random()*2-1)*strength;
    }
    this.signals.jerk=this.requested&&!this.manualOverride&&this.phase!=='containment'
      ?this.jerkTarget*macroIntensity:smooth(this.signals.jerk,0,dt,7.5);
    return this.signals;
  }

  private begin(phase:ErrorPhase,duration?:number){
    this.phase=phase;
    this.elapsed=0;
    this.signals.seed=Math.random()*97;
    if(phase!=='containment'){
      this.activePhaseCount++;
      this.visited.add(phase);
    }
    const ranges:Record<ErrorPhase,[number,number]>={
      distortion:[.85,1.75],tear:[.9,1.65],collapse:[1.05,2.0],eject:[.8,1.55],
      containment:[Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY],
    };
    const [min,max]=ranges[phase];
    this.duration=duration??(phase==='containment'?Number.POSITIVE_INFINITY:min+Math.random()*(max-min));
  }

  private startSequence(){
    this.manualOverride=false;
    this.recovering=false;
    this.activePhaseCount=0;
    this.activePhaseTarget=5+Math.floor(Math.random()*3);
    this.visited.clear();
    this.begin('distortion');
  }

  private nextPhase():ErrorPhase{
    const active:ErrorPhase[]=['distortion','tear','collapse','eject'];
    const unseen=active.filter(phase=>!this.visited.has(phase));
    const remaining=this.activePhaseTarget-this.activePhaseCount;
    if(unseen.length===0&&remaining<=0)return'containment';
    // As the active sequence approaches its end, force any missing event to
    // occur so containment always follows a complete critical failure.
    if(unseen.length>=remaining)return unseen[Math.floor(Math.random()*unseen.length)];
    const roll=Math.random();
    if(this.phase==='distortion')return roll<.72?'tear':'collapse';
    if(this.phase==='tear')return roll<.66?'collapse':'eject';
    if(this.phase==='collapse')return roll<.62?'eject':'tear';
    return roll<.68?'distortion':'collapse';
  }
}
