export type CriticalStage='early'|'mid'|'severe'|'containment'|'recovery';

export interface CriticalSignals {
  severity:number;
  recovery:number;
  timeDesync:number;
  frameSkip:number;
  ghost:number;
  missingData:number;
  binaryEjection:number;
  binaryAttraction:number;
  gradientDamage:number;
  geometryDamage:number;
  coreAbsorption:number;
  coreOverload:number;
  containment:number;
  previewMode:number;
  affectedRibbon:number;
  ribbonRates:readonly[number,number,number];
  seed:number;
}

export const ALL_CRITICAL_DAMAGE_TYPES=[
  'timeDesync','frameSkip','ghost','missingData','binaryEjection','binaryAttraction',
  'gradientDamage','geometryDamage','coreAbsorption','coreOverload',
] as const;
export type CriticalDamage=typeof ALL_CRITICAL_DAMAGE_TYPES[number];
type DamageKey=CriticalDamage;
const DAMAGE_KEYS:readonly DamageKey[]=ALL_CRITICAL_DAMAGE_TYPES;

const smooth=(value:number,target:number,dt:number,rate=4.2)=>
  value+(target-value)*(1-Math.exp(-dt*rate));

const blankTargets=()=>Object.fromEntries(DAMAGE_KEYS.map(key=>[key,0])) as Record<DamageKey,number>;

/**
 * Alternative procedural failure model used by comparison state 4. Unlike the
 * phase-driven ERROR, independent damage domains overlap, decay and relapse.
 * Random decisions happen only at event boundaries, so motion is unstable but
 * never becomes per-frame white noise.
 */
export class CriticalErrorDirector {
  private requested=false;
  private stage:CriticalStage='early';
  private stageElapsed=0;
  private stageDuration=5;
  private eventElapsed=0;
  private eventDuration=1;
  private peakSeverity=.8;
  private damagePreview:CriticalDamage|null=null;
  private containmentEnding=false;
  private rotationBurstsRemaining=2;
  private targets=blankTargets();
  private ribbonRateTargets:[number,number,number]=[1,1,1];
  private signals:CriticalSignals={
    severity:0,recovery:0,timeDesync:0,frameSkip:0,ghost:0,missingData:0,
    binaryEjection:0,binaryAttraction:0,gradientDamage:0,geometryDamage:0,
    coreAbsorption:0,coreOverload:0,containment:0,
    affectedRibbon:0,ribbonRates:[1,1,1],seed:Math.random()*113,
    previewMode:0,
  };

  setActive(active:boolean){
    if(active===this.requested)return;
    this.requested=active;
    if(active)this.beginRun();
    else this.beginStage('recovery',2.2);
  }

  setContainmentEnding(enabled:boolean){
    if(enabled===this.containmentEnding)return;
    this.containmentEnding=enabled;
    if(this.requested)this.beginRun();
  }

  clearDamagePreview(){
    if(!this.damagePreview)return;
    this.damagePreview=null;
    if(this.requested)this.beginRun();
    else{this.targets=blankTargets();this.ribbonRateTargets=[1,1,1];}
  }

  setDamagePreview(damage:CriticalDamage){
    this.damagePreview=damage;
    this.peakSeverity=.92;
    this.beginStage('severe',Number.POSITIVE_INFINITY);
    this.damagePreview=damage;
    this.targets=blankTargets();
    for(const key of DAMAGE_KEYS)this.signals[key]=0;
    this.targets[damage]=.94;
    this.signals.affectedRibbon=Math.floor(Math.random()*3);
    this.signals.seed=Math.random()*113;
    this.chooseRibbonTiming();
  }

  update(dt:number,macroIntensity:number):Readonly<CriticalSignals>{
    this.stageElapsed+=dt;this.eventElapsed+=dt;
    if(this.requested&&!this.damagePreview&&this.stage!=='containment'
      &&this.stageElapsed>=this.stageDuration)this.advanceStage();
    if(!this.requested&&this.stage==='recovery'&&this.stageElapsed>=this.stageDuration){
      this.targets=blankTargets();
      this.ribbonRateTargets=[1,1,1];
    }
    if(!this.damagePreview&&this.stage!=='containment'
      &&(this.requested||(this.stage==='recovery'&&this.stageElapsed<this.stageDuration))
      &&this.eventElapsed>=this.eventDuration)this.chooseEvent();

    const stageSeverity={early:.28,mid:.62,severe:1,containment:.92,recovery:.22}[this.stage]*this.peakSeverity;
    const severityTarget=(this.requested||this.damagePreview||this.stageElapsed<this.stageDuration)
      ?stageSeverity*macroIntensity:0;
    this.signals.severity=smooth(this.signals.severity,severityTarget,dt,2.15);
    this.signals.recovery=smooth(this.signals.recovery,this.stage==='recovery'?macroIntensity:0,dt,2.8);
    this.signals.previewMode=this.damagePreview?1:0;
    this.signals.containment=smooth(this.signals.containment,
      this.requested&&this.stage==='containment'?macroIntensity:0,dt,2.8);
    for(const key of DAMAGE_KEYS){
      this.signals[key]=smooth(this.signals[key],this.targets[key]*macroIntensity,dt,
        key==='frameSkip'||key==='timeDesync'?7.2:3.8);
    }
    const rates=this.signals.ribbonRates as [number,number,number];
    for(let index=0;index<3;index++)rates[index]=smooth(rates[index],this.ribbonRateTargets[index],dt,8.5);
    return this.signals;
  }

  private beginRun(){
    this.peakSeverity=.45+Math.random()*.53;
    this.beginStage('early',1.9+Math.random()*1.25);
    this.chooseEvent();
  }

  private beginStage(stage:CriticalStage,duration:number){
    this.stage=stage;this.stageElapsed=0;this.stageDuration=duration;
    this.targets=blankTargets();this.ribbonRateTargets=[1,1,1];
    this.rotationBurstsRemaining=2;
    this.signals.seed=Math.random()*113;
    this.eventElapsed=this.eventDuration;
    if(stage==='containment'){
      this.targets.coreAbsorption=1;
      this.targets.coreOverload=.86;
    }
  }

  private advanceStage(){
    if(this.stage==='early')this.beginStage('mid',2.25+Math.random()*1.6);
    else if(this.stage==='mid')this.beginStage('severe',2.4+Math.random()*1.75);
    else if(this.stage==='severe'&&this.containmentEnding)
      this.beginStage('containment',Number.POSITIVE_INFINITY);
    else if(this.stage==='severe')this.beginStage('recovery',2.05+Math.random()*1.2);
    else this.beginRun();
  }

  private chooseEvent(){
    this.eventElapsed=0;this.eventDuration=.325+Math.random()*.875;
    this.targets=blankTargets();
    this.signals.seed=Math.random()*113;
    this.signals.affectedRibbon=Math.floor(Math.random()*3);
    const pools:Record<CriticalStage,DamageKey[]>={
      early:['timeDesync','frameSkip','gradientDamage','ghost'],
      mid:['timeDesync','frameSkip','ghost','missingData','binaryEjection','binaryAttraction',
        'gradientDamage','geometryDamage'],
      severe:['frameSkip','ghost','missingData','binaryEjection','binaryAttraction',
        'gradientDamage','geometryDamage','coreAbsorption','coreOverload'],
      containment:[],
      recovery:['binaryEjection','binaryAttraction','ghost'],
    };
    const count=this.stage==='early'?2:this.stage==='mid'?3:this.stage==='severe'?4:2;
    const available=[...pools[this.stage]];
    for(let i=0;i<count&&available.length;i++){
      const choice=Math.floor(Math.random()*available.length);
      const key=available.splice(choice,1)[0];
      const strength=this.stage==='recovery'?.18+Math.random()*.22:.42+Math.random()*.58;
      this.targets[key]=strength;
    }
    if(this.stage==='severe'){
      this.targets.geometryDamage=Math.max(this.targets.geometryDamage,.42);
      if(Math.random()<.72)
        this.targets.coreAbsorption=.58+Math.random()*.42;
    }
    if(this.stage==='recovery'){
      this.targets.binaryEjection=Math.max(this.targets.binaryEjection,.28);
      this.targets.binaryAttraction=0;
    }
    this.chooseRibbonTiming();
  }

  private chooseRibbonTiming(){
    this.ribbonRateTargets=[1,1,1];
    const affected=this.signals.affectedRibbon;
    const desync=Math.max(this.targets.timeDesync,this.targets.frameSkip);
    if(desync>.05){
      const canCatchUp=this.rotationBurstsRemaining>0;
      const modes=canCatchUp?[0,.12,.35,1.5,1.72]:[0,.18,.42,1.08];
      const mode=modes[Math.floor(Math.random()*modes.length)];
      this.ribbonRateTargets[affected]=1+(mode-1)*desync;
      if(mode>1.1)this.rotationBurstsRemaining--;
      if(this.targets.frameSkip>.45&&this.rotationBurstsRemaining>0&&Math.random()<.42){
        this.ribbonRateTargets[(affected+1)%3]=1.28+Math.random()*.34;
        this.rotationBurstsRemaining--;
      }
    }
  }
}
