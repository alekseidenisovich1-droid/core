import './style.css';
import './drag.css';
import './controls.css';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { CodexActivityInterpreter } from './activity';
import {
  ALL_CRITICAL_DAMAGE_TYPES,type CriticalDamage,
} from './critical-error-director';
import { CoreStore,getVisualState } from './state';
import { CoreVisual } from './visual';

const scene=document.querySelector<HTMLElement>('#scene')!;
const app=document.querySelector<HTMLElement>('#app')!;
const hud=document.querySelector<HTMLElement>('#hud')!;
const hint=document.querySelector<HTMLElement>('#hint')!;
const chaosControls=document.querySelector<HTMLElement>('#chaos-controls')!;
const chaosActivity=document.querySelector<HTMLInputElement>('#chaos-activity')!;
const chaosActivityValue=document.querySelector<HTMLOutputElement>('#chaos-activity-value')!;
const ribbonReliefToggle=document.querySelector<HTMLButtonElement>('#ribbon-relief-toggle')!;
const ribbonRelief=document.querySelector<HTMLInputElement>('#ribbon-relief')!;
const ribbonReliefValue=document.querySelector<HTMLOutputElement>('#ribbon-relief-value')!;
const chaosLivingToggle=document.querySelector<HTMLButtonElement>('#chaos-living-toggle')!;
const store=new CoreStore();
const visual=new CoreVisual(scene);
let lastRibbonReliefPercent=50;
let hudPinned=false;
let demoTimer=0;
let autoIntegration=true;
let criticalDamageIndex=-1;
let lastArrowSwitch=0;

const damageLabel=(damage:CriticalDamage)=>damage.replace(/[A-Z]/g,letter=>`_${letter}`).toUpperCase();
const damageNumber=(damage:CriticalDamage)=>ALL_CRITICAL_DAMAGE_TYPES.indexOf(damage)+1;
const isEffectState=(state:string)=>state==='error'||state==='critical'||state==='critical2';
const damageTypesFor=(_state:string)=>ALL_CRITICAL_DAMAGE_TYPES;

const fields={
  state:document.querySelector('#hud-state')!,source:document.querySelector('#hud-source')!,
  files:document.querySelector('#hud-files')!,commands:document.querySelector('#hud-commands')!,
  errors:document.querySelector('#hud-errors')!,
};

store.subscribe(snapshot=>{
  visual.setSnapshot(snapshot);
  const visualState=getVisualState(snapshot.state);
  if(isEffectState(visualState)&&criticalDamageIndex>=0){
    const damageTypes=damageTypesFor(visualState);
    const damage=damageTypes[criticalDamageIndex];
    fields.state.textContent=`${visualState} · ${String(damageNumber(damage)).padStart(2,'0')}/10 ${damageLabel(damage)}`;
  }else{
    fields.state.textContent=visualState;
  }
  fields.source.textContent=snapshot.source;
  fields.files.textContent=String(snapshot.files);
  fields.commands.textContent=String(snapshot.commands);
  fields.errors.textContent=String(snapshot.errors);
  hud.classList.toggle('visible',snapshot.hovered||hudPinned);
  chaosControls.classList.toggle('visible',visualState==='calm'||visualState==='work');
  document.body.dataset.state=snapshot.state;
});

chaosActivity.addEventListener('input',()=>{
  const percent=Number(chaosActivity.value);
  chaosActivityValue.value=`${percent}%`;
  visual.setChaosSpeed(percent/100);
});

ribbonReliefToggle.addEventListener('click',()=>{
  const enabled=ribbonReliefToggle.getAttribute('aria-pressed')!=='true';
  const percent=enabled?lastRibbonReliefPercent:0;
  ribbonReliefToggle.setAttribute('aria-pressed',String(enabled));
  ribbonReliefToggle.textContent=`RIBBON RELIEF · ${enabled?'ON':'OFF'}`;
  ribbonRelief.value=String(percent);
  ribbonReliefValue.value=`${percent}%`;
  visual.setWorkRibbonRelief(enabled);
  visual.setWorkRibbonReliefStrength(percent/50);
});

ribbonRelief.addEventListener('input',()=>{
  const percent=Number(ribbonRelief.value);
  const enabled=percent>0;
  if(enabled)lastRibbonReliefPercent=percent;
  ribbonReliefValue.value=`${percent}%`;
  ribbonReliefToggle.setAttribute('aria-pressed',String(enabled));
  ribbonReliefToggle.textContent=`RIBBON RELIEF · ${enabled?'ON':'OFF'}`;
  visual.setWorkRibbonRelief(enabled);
  // The previous experimental relief is the 50% reference point.
  visual.setWorkRibbonReliefStrength(percent/50);
});

chaosLivingToggle.addEventListener('click',()=>{
  const enabled=chaosLivingToggle.getAttribute('aria-pressed')!=='true';
  chaosLivingToggle.setAttribute('aria-pressed',String(enabled));
  chaosLivingToggle.textContent=`CHAOS · ${enabled?'ON':'OFF'}`;
  visual.setLivingChaos(enabled);
});

const activity=new CodexActivityInterpreter({
  onWorking:()=>store.dispatch({type:'WORKING_STARTED',source:'codex-live'}),
  onSuccess:()=>store.dispatch({type:'WORKING_COMPLETED'}),
  onIdle:()=>store.dispatch({type:'IDLE',source:'codex-live'}),
});

function setSimulatedState(number:number){
  if(number===1)store.dispatch({type:'IDLE',source:'codex-sim'});
  if(number===2){
    store.dispatch({type:'WORKING_STARTED',source:'codex-sim'});
    store.dispatch({type:'WORKING_PROGRESS',files:3,commands:2});
  }
  if(number===3)store.dispatch({type:'ERROR_RAISED'});
  if(number===4)store.dispatch({type:'CRITICAL_ERROR_RAISED'});
  if(number===5)store.dispatch({type:'CRITICAL2_ERROR_RAISED'});
}

function enterManualMode(){
  autoIntegration=false;
  activity.reset();
  clearInterval(demoTimer);
}

const handleKeyDown=(event:KeyboardEvent)=>{
  if(/^[1-5]$/.test(event.key)){
    enterManualMode();
    criticalDamageIndex=-1;
    visual.clearCriticalDamagePreview();
    setSimulatedState(Number(event.key));
  }
  const currentVisualState=getVisualState(store.snapshot.state);
  const arrowCode=event.code==='ArrowRight'||event.code==='ArrowLeft'?event.code:event.key;
  if((arrowCode==='ArrowRight'||arrowCode==='ArrowLeft')
    &&!event.repeat&&isEffectState(currentVisualState)
    &&performance.now()-lastArrowSwitch>220){
    lastArrowSwitch=performance.now();
    const damageTypes=damageTypesFor(currentVisualState);
    const direction=arrowCode==='ArrowRight'?1:-1;
    criticalDamageIndex=criticalDamageIndex<0
      ?(direction>0?0:damageTypes.length-1)
      :(criticalDamageIndex+direction+damageTypes.length)%damageTypes.length;
    const damage=damageTypes[criticalDamageIndex];
    visual.setCriticalDamagePreview(damage);
    fields.state.textContent=`${currentVisualState} · ${String(damageNumber(damage)).padStart(2,'0')}/10 ${damageLabel(damage)}`;
    event.preventDefault();
  }
  if(event.key.toLowerCase()==='h'){
    hudPinned=!hudPinned;
    hud.classList.toggle('visible',hudPinned||store.snapshot.hovered);
  }
  if(event.key.toLowerCase()==='d'){
    enterManualMode();
    criticalDamageIndex=-1;visual.clearCriticalDamagePreview();
    let index=0;
    setSimulatedState(1);
    demoTimer=window.setInterval(()=>setSimulatedState(++index%5+1),6500);
  }
  if(event.key.toLowerCase()==='a'){
    clearInterval(demoTimer);
    criticalDamageIndex=-1;visual.clearCriticalDamagePreview();
    autoIntegration=!autoIntegration;
    activity.reset(autoIntegration);
  }
};

type CoreWindow=Window&{__coreKeyHandler?:((event:KeyboardEvent)=>void)};
const coreWindow=window as CoreWindow;
if(coreWindow.__coreKeyHandler)removeEventListener('keydown',coreWindow.__coreKeyHandler);
coreWindow.__coreKeyHandler=handleKeyDown;
addEventListener('keydown',handleKeyDown);

interface ActivityPayload { codexCpu:number; vscodeCpu:number; active:boolean }
listen<ActivityPayload>('core-activity',({payload})=>{
  if(autoIntegration)activity.sample(payload.codexCpu);
}).catch(()=>{ /* Browser development keeps the manual simulator available. */ });

let pointerNearCore=false;
app.addEventListener('pointermove',event=>{
  const bounds=app.getBoundingClientRect();
  const dx=event.clientX-(bounds.left+bounds.width*.5);
  const dy=event.clientY-(bounds.top+bounds.height*.5);
  // The HUD reacts only near the actual core/chaos volume, not anywhere in
  // the large transparent native window.
  const hoverRadius=Math.max(52,Math.min(bounds.width,bounds.height)*.105);
  const next=dx*dx+dy*dy<=hoverRadius*hoverRadius;
  if(next===pointerNearCore)return;
  pointerNearCore=next;
  store.dispatch({type:next?'HOVER_ENTER':'HOVER_LEAVE'});
});
app.addEventListener('pointerleave',()=>{
  if(!pointerNearCore)return;
  pointerNearCore=false;
  store.dispatch({type:'HOVER_LEAVE'});
});
hud.onpointerdown=event=>{
  if(event.button!==0)return;
  event.preventDefault();
  getCurrentWindow().startDragging().catch(()=>{
    // Browser preview has no native window; the existing top drag strip and
    // keyboard simulator remain available there.
  });
};
setTimeout(()=>hint.classList.add('hidden'),6500);

let previous=performance.now();
function frame(now:number){
  const dt=Math.min((now-previous)/1000,.05);
  previous=now;
  visual.update(dt,now/1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
