import * as THREE from 'three';
import { CONFIG,STATE_TUNING,type StateTuning } from './config';
import {
  CriticalErrorDirector,type CriticalDamage,type CriticalSignals,
} from './critical-error-director';
import { ErrorDirector,type ErrorSignals } from './error-director';
import { getVisualState,type Snapshot,type VisualState } from './state';
import {
  containmentFragmentShader,containmentVertexShader,coreChaosVertexShader,fragmentShader,
  particleFragmentShader,particleVertexShader,vertexShader,
} from './shaders';

type Uniforms={
  uTime:{value:number};uEnergy:{value:number};uGlitch:{value:number};uMobius:{value:number};
  uOffset:{value:number};uGrid:{value:THREE.Vector2};uRibbonRadius:{value:number};
  uWavePhase:{value:number};uWaveAmplitude:{value:number};uWaveComplexity:{value:number};
  uDeformation:{value:number};uWidthVariation:{value:number};uTwist:{value:number};
  uDigitScale:{value:number};uDigitDensity:{value:number};
  uGradientPhase:{value:number};uDigitPhase:{value:number};
  uErrorDistort:{value:number};uErrorTear:{value:number};uErrorCollapse:{value:number};
  uErrorEject:{value:number};uErrorContainment:{value:number};uErrorJerk:{value:number};uErrorSeed:{value:number};
  uVisibility:{value:number};uRgbSplit:{value:number};uErrorStructure:{value:number};uSaturation:{value:number};
  uMissingData:{value:number};uGradientDamage:{value:number};uGeometryDamage:{value:number};
  uDepthFade:{value:number};
  uReliefActivity:{value:number};uWorkRelief:{value:number};uReliefRatio:{value:number};
};
type ParticleUniforms={
  uTime:{value:number};uIntensity:{value:number};uTear:{value:number};
  uCollapse:{value:number};uEject:{value:number};uContainment:{value:number};
  uErrorSeed:{value:number};uPixelRatio:{value:number};
};
type ContainmentUniforms={
  uTime:{value:number};uIntensity:{value:number};uSeed:{value:number};uLayer:{value:number};
  uLiving:{value:number};
};
type CoreChaosUniforms={
  uTime:{value:number};uIntensity:{value:number};uVisibility:{value:number};uPixelRatio:{value:number};
};
type Ribbon={
  group:THREE.Group;mesh:THREE.Mesh;surface:THREE.Mesh;uniforms:Uniforms;baseRotation:THREE.Euler;
  surfaceGeometry:THREE.BufferGeometry;surfaceBasePositions:Float32Array;radius:number;
  particles:THREE.Points;particleUniforms:ParticleUniforms;
  ghosts:{group:THREE.Group;mesh:THREE.Mesh;uniforms:Uniforms;lag:number}[];
  phase:number;orbitAngle:number;selfPhase:number;waveOffset:number;
  gradientPhase:number;digitPhase:number;
};

type LightingDebugKey='directLight'|'shadows'|'contactShadows'|'ambientOcclusion'|'emissive'
  |'microGlow'|'mesoGlow'|'macroGlow'|'indirectLightSpill'|'depthFade';
type LightingDebug=Record<LightingDebugKey,boolean>;

const damp=(current:number,target:number,dt:number,rate:number=CONFIG.STATE_TRANSITION_SPEED)=>
  THREE.MathUtils.lerp(current,target,1-Math.exp(-dt*rate));

function makeMaterial(offset:number,grid:THREE.Vector2,side:THREE.Side,mobius:number,radius=0){
  const calm=STATE_TUNING.calm;
  const uniforms:Uniforms={
    uTime:{value:0},uEnergy:{value:calm.energy},uGlitch:{value:0},uMobius:{value:mobius},
    uOffset:{value:offset},uGrid:{value:grid},uRibbonRadius:{value:radius},uWavePhase:{value:0},
    uWaveAmplitude:{value:calm.waveAmplitude},uWaveComplexity:{value:calm.waveComplexity},
    uDeformation:{value:calm.deformation},uWidthVariation:{value:calm.widthVariation},
    uTwist:{value:calm.twist},uDigitScale:{value:calm.digitScale},
    uDigitDensity:{value:calm.digitDensity},uGradientPhase:{value:offset},uDigitPhase:{value:offset*3},
    uErrorDistort:{value:0},uErrorTear:{value:0},uErrorCollapse:{value:0},uErrorEject:{value:0},
    uErrorContainment:{value:0},
    uErrorJerk:{value:0},uErrorSeed:{value:0},uVisibility:{value:1},uRgbSplit:{value:0},
    uSaturation:{value:1},
    uErrorStructure:{value:0},uMissingData:{value:0},uGradientDamage:{value:0},
    uGeometryDamage:{value:0},
    uDepthFade:{value:CONFIG.LIGHTING.depthFadeStrength},
    uReliefActivity:{value:1},uWorkRelief:{value:0},
    uReliefRatio:{value:CONFIG.EXPERIMENTS.ribbonReliefRadiusRatio},
  };
  const material=new THREE.ShaderMaterial({
    uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,side,
    blending:THREE.NormalBlending,
  });
  return{material,uniforms};
}

// The dark physical skin writes real depth and both casts and receives soft
// shadows. The existing digit shader stays above it as the emissive material.
function makeSurfaceMaterial(){
  return new THREE.MeshStandardMaterial({
    color:0x21172b,emissive:0x210b2e,
    emissiveIntensity:CONFIG.LIGHTING.ribbonEmission,
    roughness:.64,metalness:.18,transparent:true,opacity:CONFIG.LIGHTING.surfaceOpacity,
    side:THREE.DoubleSide,depthWrite:true,
  });
}

function mobiusPoint(u:number,v:number,radius:number,out:THREE.Vector3){
  const half=u*.5;
  return out.set(
    (radius+v*Math.cos(half))*Math.cos(u),
    (radius+v*Math.cos(half))*Math.sin(u),
    v*Math.sin(half),
  );
}

/** A single Möbius surface. The coincident closure edge is position-welded and
 * its reversed vertex pairs receive identical averaged normals. This avoids the
 * overlapping double-cover and removes the visible lighting step at the seam. */
function createMobiusGeometry(radius:number,halfWidth:number,uSegments=420,vSegments=32){
  const row=vSegments+1;
  const positions=new Float32Array((uSegments+1)*row*3);
  const uvs=new Float32Array((uSegments+1)*row*2);
  const point=new THREE.Vector3();
  for(let i=0;i<=uSegments;i++){
    const u=i/uSegments;
    for(let j=0;j<=vSegments;j++){
      const v=(j/vSegments-.5)*halfWidth*2;
      mobiusPoint(u*Math.PI*2,v,radius,point);
      const vertex=i*row+j;
      positions.set(point.toArray(),vertex*3);
      uvs.set([u,j/vSegments],vertex*2);
    }
  }
  const indices:number[]=[];
  for(let i=0;i<uSegments;i++){
    for(let j=0;j<vSegments;j++){
      const a=i*row+j,b=(i+1)*row+j,c=(i+1)*row+j+1,d=i*row+j+1;
      indices.push(a,b,d,b,c,d);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const position=geometry.getAttribute('position') as THREE.BufferAttribute;
  const normal=geometry.getAttribute('normal') as THREE.BufferAttribute;
  const first=new THREE.Vector3(),last=new THREE.Vector3(),average=new THREE.Vector3();
  for(let j=0;j<=vSegments;j++){
    const start=j;
    const end=uSegments*row+(vSegments-j);
    first.fromBufferAttribute(position,start);
    position.setXYZ(end,first.x,first.y,first.z);
    first.fromBufferAttribute(normal,start);
    last.fromBufferAttribute(normal,end);
    average.copy(first).add(last).normalize();
    normal.setXYZ(start,average.x,average.y,average.z);
    normal.setXYZ(end,average.x,average.y,average.z);
  }
  position.needsUpdate=true;
  normal.needsUpdate=true;
  geometry.computeBoundingSphere();
  return geometry;
}

export class CoreVisual{
  private renderer:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera=new THREE.PerspectiveCamera(34,1,.1,50);
  private root=new THREE.Group();
  private ribbons:Ribbon[]=[];
  private coreUniforms:Uniforms;
  private core:THREE.Mesh;
  private containmentChaos:THREE.Group;
  private containmentUniforms:[ContainmentUniforms,ContainmentUniforms];
  private coreChaosUniforms:CoreChaosUniforms;
  private ambientLight:THREE.AmbientLight;
  private fillLight:THREE.HemisphereLight;
  private keyLight:THREE.DirectionalLight;
  private coreAreaLights:THREE.PointLight[]=[];
  private lightingDebug:LightingDebug={
    directLight:true,shadows:true,contactShadows:true,ambientOcclusion:true,emissive:true,
    microGlow:true,mesoGlow:true,macroGlow:true,indirectLightSpill:true,depthFade:true,
  };
  private state:VisualState='calm';
  private hovered=false;
  private current:StateTuning={...STATE_TUNING.calm};
  private errorStructure=0;
  private workCoreChaos=0;
  private stableChaosPresence=1;
  private coreChaosTime=0;
  private coreChaosSpeed=1/3;
  private chaosLayerTimes:[number,number]=[0,2.7];
  private chaosSpeedControl:number=CONFIG.EXPERIMENTS.chaosSpeedDefault;
  private livingChaosEnabled=true;
  private livingChaosMix=1;
  private workRibbonReliefEnabled:boolean=CONFIG.EXPERIMENTS.workRibbonRelief;
  private workRibbonReliefStrength=1;
  private workRibbonRelief=0;
  private organismWavePhase=0;
  private coreGradientPhase=.1;
  private coreDigitPhase=.3;
  private coreRotation=0;
  private containmentLatched=false;
  private frozenCoreRotation=new THREE.Euler();
  private frozenRootRotation=new THREE.Euler();
  private frozenRootPosition=new THREE.Vector3();
  private errorDirector=new ErrorDirector();
  private criticalDirector=new CriticalErrorDirector();
  private errorSignals:ErrorSignals={
    distortion:0,tear:0,collapse:0,eject:0,containment:0,jerk:0,seed:0,
  };
  private criticalSignals:Readonly<CriticalSignals>={
    severity:0,recovery:0,timeDesync:0,frameSkip:0,ghost:0,missingData:0,
    binaryEjection:0,binaryAttraction:0,gradientDamage:0,
    geometryDamage:0,coreAbsorption:0,coreOverload:0,containment:0,
    previewMode:0,affectedRibbon:0,ribbonRates:[1,1,1],seed:0,
  };

  constructor(container:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0,0);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.94;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.VSMShadowMap;
    container.append(this.renderer.domElement);this.camera.position.z=CONFIG.CAMERA_Z;this.scene.add(this.root);
    this.ambientLight=new THREE.AmbientLight(0x271839,CONFIG.LIGHTING.ambientIntensity);
    this.fillLight=new THREE.HemisphereLight(0x3b2752,0x030207,CONFIG.LIGHTING.fillIntensity);
    this.keyLight=new THREE.DirectionalLight(0xf3d8ff,CONFIG.LIGHTING.keyIntensity);
    this.keyLight.position.set(3.6,4.8,6.2);this.keyLight.castShadow=true;
    this.keyLight.shadow.mapSize.set(CONFIG.LIGHTING.shadowMapSize,CONFIG.LIGHTING.shadowMapSize);
    this.keyLight.shadow.bias=CONFIG.LIGHTING.shadowBias;
    this.keyLight.shadow.normalBias=CONFIG.LIGHTING.shadowNormalBias;
    this.keyLight.shadow.radius=CONFIG.LIGHTING.shadowSoftness;
    this.keyLight.shadow.intensity=CONFIG.LIGHTING.shadowIntensity;
    this.keyLight.shadow.blurSamples=CONFIG.LIGHTING.shadowBlurSamples;
    const shadowCamera=this.keyLight.shadow.camera as THREE.OrthographicCamera;
    shadowCamera.left=-4;shadowCamera.right=4;shadowCamera.top=4;shadowCamera.bottom=-4;
    shadowCamera.near=.4;shadowCamera.far=18;
    this.scene.add(this.ambientLight,this.fillLight,this.keyLight,this.keyLight.target);
    const emitterPoints=[
      new THREE.Vector3(1,1,1),new THREE.Vector3(-1,-1,1),
      new THREE.Vector3(-1,1,-1),new THREE.Vector3(1,-1,-1),
    ];
    const emitterColors=[0xff4fa3,0xc65cff,0xff78bc,0x9b67ff] as const;
    emitterPoints.forEach((point,index)=>{
      const light=new THREE.PointLight(emitterColors[index],CONFIG.LIGHTING.spillIntensity*.22,4.4,2);
      light.position.copy(point.normalize().multiplyScalar(CONFIG.CORE_RADIUS*.34));
      light.castShadow=true;light.shadow.mapSize.set(256,256);
      light.shadow.bias=-.0014;light.shadow.normalBias=.06;
      light.shadow.radius=8;light.shadow.intensity=.52;light.shadow.blurSamples=10;
      this.coreAreaLights.push(light);this.root.add(light);
    });
    const coreShader=makeMaterial(.1,new THREE.Vector2(
      CONFIG.CORE_DIGIT_GRID_X/CONFIG.DIGIT_SIZE*CONFIG.DIGIT_DENSITY,
      CONFIG.CORE_DIGIT_GRID_Y/CONFIG.DIGIT_SIZE*CONFIG.DIGIT_DENSITY,
    ),THREE.FrontSide,0);
    this.coreUniforms=coreShader.uniforms;
    const coreGeometry=new THREE.SphereGeometry(CONFIG.CORE_RADIUS,112,72);
    this.core=new THREE.Mesh(coreGeometry,coreShader.material);
    this.core.renderOrder=12;
    this.root.add(this.core);
    const containment=this.createContainmentChaos();
    this.containmentChaos=containment.group;this.containmentUniforms=containment.uniforms;
    this.coreChaosUniforms=containment.particleUniforms;
    this.root.add(this.containmentChaos);
    for(let i=0;i<3;i++)this.ribbons.push(this.createRibbon(i));
    this.resize();addEventListener('resize',()=>this.resize());
  }

  private createContainmentChaos(){
    const group=new THREE.Group();
    const makeLayer=(geometry:THREE.BufferGeometry,layer:number,seed:number)=>{
      const uniforms:ContainmentUniforms={
        uTime:{value:0},uIntensity:{value:0},uSeed:{value:seed},uLayer:{value:layer},uLiving:{value:1},
      };
      const material=new THREE.ShaderMaterial({
        uniforms,vertexShader:containmentVertexShader,fragmentShader:containmentFragmentShader,
        transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
        blending:THREE.AdditiveBlending,
      });
      return{mesh:new THREE.Mesh(geometry,material),uniforms};
    };
    const outerLayer=makeLayer(new THREE.SphereGeometry(CONFIG.CORE_RADIUS*.74,72,48),0,.17);
    const innerLayer=makeLayer(new THREE.IcosahedronGeometry(CONFIG.CORE_RADIUS*.48,5),1,.73);
    const outer=outerLayer.mesh,inner=innerLayer.mesh;
    outer.renderOrder=5;inner.renderOrder=6;inner.rotation.set(.7,.2,.4);
    const particleCount=640;
    const positions=new Float32Array(particleCount*3),seeds=new Float32Array(particleCount);
    for(let i=0;i<particleCount;i++){
      const seed=(i+.5)/particleCount;
      const y=1-2*seed;
      const radius=Math.sqrt(Math.max(0,1-y*y));
      const angle=i*2.399963229728653;
      const volume=.16+.79*Math.pow(Math.abs(Math.sin((i+1)*91.731)),1/3);
      positions[i*3]=Math.cos(angle)*radius*CONFIG.CORE_RADIUS*volume;
      positions[i*3+1]=y*CONFIG.CORE_RADIUS*volume;
      positions[i*3+2]=Math.sin(angle)*radius*CONFIG.CORE_RADIUS*volume;
      seeds[i]=seed;
    }
    const particleGeometry=new THREE.BufferGeometry();
    particleGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    particleGeometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
    const particleUniforms:CoreChaosUniforms={
      uTime:{value:0},uIntensity:{value:0},uVisibility:{value:0},
      uPixelRatio:{value:Math.min(devicePixelRatio,2)},
    };
    const particleMaterial=new THREE.ShaderMaterial({
      uniforms:particleUniforms,vertexShader:coreChaosVertexShader,fragmentShader:particleFragmentShader,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    const digits=new THREE.Points(particleGeometry,particleMaterial);digits.renderOrder=7;
    group.add(outer,inner,digits);
    return{group,uniforms:[outerLayer.uniforms,innerLayer.uniforms] as [ContainmentUniforms,ContainmentUniforms],particleUniforms};
  }

  setSnapshot(snapshot:Readonly<Snapshot>){
    const next=getVisualState(snapshot.state);
    if(next!==this.state){
      this.errorDirector.setActive(next==='error');
      const criticalActive=next==='critical'||next==='critical2';
      this.criticalDirector.setContainmentEnding(next==='critical');
      this.criticalDirector.setActive(criticalActive);
    }
    this.state=next;this.hovered=snapshot.hovered;
  }

  clearCriticalDamagePreview(){
    this.errorDirector.setManualOverride(false);
    this.criticalDirector.clearDamagePreview();
  }

  setCriticalDamagePreview(damage:CriticalDamage){
    if(this.state==='error')this.errorDirector.setManualOverride(true);
    this.criticalDirector.setDamagePreview(damage);
  }

  /** Debug hooks for the lighting study; the normal experience keeps all on. */
  setLightingDebug(flag:LightingDebugKey,enabled:boolean){
    this.lightingDebug[flag]=enabled;
  }

  setChaosSpeed(value:number){
    this.chaosSpeedControl=THREE.MathUtils.clamp(
      value,CONFIG.EXPERIMENTS.chaosSpeedMin,CONFIG.EXPERIMENTS.chaosSpeedMax,
    );
  }

  setWorkRibbonRelief(enabled:boolean){this.workRibbonReliefEnabled=enabled;}
  setWorkRibbonReliefStrength(value:number){this.workRibbonReliefStrength=THREE.MathUtils.clamp(value,0,2);}
  setLivingChaos(enabled:boolean){this.livingChaosEnabled=enabled;}

  private createEjectionParticles(radius:number,halfWidth:number,index:number){
    const count=CONFIG.ERROR_PARTICLES_PER_RIBBON;
    const positions=new Float32Array(count*3),seeds=new Float32Array(count);
    const point=new THREE.Vector3();
    for(let i=0;i<count;i++){
      const u=((i*.61803398875+index*.173)%1)*Math.PI*2;
      const random=Math.abs(Math.sin((i+1)*(12.9898+index*4.13))*43758.5453)%1;
      const v=(random-.5)*halfWidth*1.9;
      mobiusPoint(u,v,radius,point);positions.set(point.toArray(),i*3);
      seeds[i]=(i+.37)/(count+1)+index*.271;
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
    const particleUniforms:ParticleUniforms={
      uTime:{value:0},uIntensity:{value:0},uTear:{value:0},uCollapse:{value:0},
      uEject:{value:0},uContainment:{value:0},uErrorSeed:{value:0},
      uPixelRatio:{value:Math.min(devicePixelRatio,2)},
    };
    const material=new THREE.ShaderMaterial({
      uniforms:particleUniforms,vertexShader:particleVertexShader,fragmentShader:particleFragmentShader,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    const particles=new THREE.Points(geometry,material);particles.frustumCulled=false;particles.renderOrder=8;
    return{particles,particleUniforms};
  }

  private createRibbon(index:number):Ribbon{
    const radius=CONFIG.RIBBON_RADII[index];
    const geometry=createMobiusGeometry(radius,CONFIG.RIBBON_HALF_WIDTHS[index]);
    const shader=makeMaterial(index*.23,new THREE.Vector2(
      CONFIG.RIBBON_DIGIT_GRID_X/CONFIG.DIGIT_SIZE*CONFIG.DIGIT_DENSITY,
      CONFIG.RIBBON_DIGIT_GRID_Y/CONFIG.DIGIT_SIZE*CONFIG.DIGIT_DENSITY,
    ),THREE.DoubleSide,1,radius);
    const surfaceGeometry=createMobiusGeometry(radius,CONFIG.RIBBON_HALF_WIDTHS[index],180,16);
    const surfaceBasePositions=new Float32Array(
      (surfaceGeometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array,
    );
    const surface=new THREE.Mesh(surfaceGeometry,makeSurfaceMaterial());
    surface.castShadow=true;surface.receiveShadow=true;surface.renderOrder=3;
    const mesh=new THREE.Mesh(geometry,shader.material);mesh.renderOrder=4;
    const group=new THREE.Group();group.add(surface,mesh);
    const particleLayer=this.createEjectionParticles(radius,CONFIG.RIBBON_HALF_WIDTHS[index],index);
    group.add(particleLayer.particles);
    const ghosts=[.075,.145].map(lag=>{
      const ghostShader=makeMaterial(index*.23,new THREE.Vector2(
        CONFIG.RIBBON_DIGIT_GRID_X/CONFIG.DIGIT_SIZE*CONFIG.DIGIT_DENSITY,
        CONFIG.RIBBON_DIGIT_GRID_Y/CONFIG.DIGIT_SIZE*CONFIG.DIGIT_DENSITY,
      ),THREE.DoubleSide,1,radius);
      ghostShader.uniforms.uVisibility.value=0;
      const ghostMesh=new THREE.Mesh(geometry,ghostShader.material);ghostMesh.renderOrder=2;
      const ghostGroup=new THREE.Group();ghostGroup.add(ghostMesh);this.root.add(ghostGroup);
      return{group:ghostGroup,mesh:ghostMesh,uniforms:ghostShader.uniforms,lag};
    });
    const rotations=[
      new THREE.Euler(.72,.08,.16),new THREE.Euler(-.48,.62,1.38),new THREE.Euler(.16,-.72,-.58),
    ];
    group.rotation.copy(rotations[index]);this.root.add(group);
    return{group,mesh,surface,surfaceGeometry,surfaceBasePositions,radius,uniforms:shader.uniforms,particles:particleLayer.particles,ghosts,
      particleUniforms:particleLayer.particleUniforms,baseRotation:rotations[index],phase:index*2.137,
      orbitAngle:index*.43,selfPhase:index*1.71,waveOffset:index*.52,
      gradientPhase:index*.23,digitPhase:index*.71};
  }

  private resize(){
    const parent=this.renderer.domElement.parentElement!,width=parent.clientWidth,height=parent.clientHeight;
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
  }

  private blendState(dt:number){
    const target=STATE_TUNING[this.state];
    for(const key of Object.keys(target) as (keyof StateTuning)[]){
      const rate=key==='glitch'?CONFIG.GLITCH_TRANSITION_SPEED:CONFIG.STATE_TRANSITION_SPEED;
      this.current[key]=damp(this.current[key],target[key],dt,rate);
    }
  }

  private updateUniforms(u:Uniforms,time:number,wavePhase:number,gradientPhase:number,digitPhase:number,variation=1){
    u.uTime.value=time;u.uEnergy.value=this.current.energy;
    const keepBaseErrorGlitch=this.state==='error';
    u.uGlitch.value=this.current.glitch*(keepBaseErrorGlitch?1:1-this.criticalSignals.previewMode);
    u.uWavePhase.value=wavePhase;u.uWaveAmplitude.value=this.current.waveAmplitude*variation;
    u.uWaveComplexity.value=this.current.waveComplexity;u.uDeformation.value=this.current.deformation*variation;
    u.uWidthVariation.value=this.current.widthVariation*variation;u.uTwist.value=this.current.twist*variation;
    u.uDigitScale.value=this.current.digitScale;u.uDigitDensity.value=this.current.digitDensity;
    u.uGradientPhase.value=gradientPhase;u.uDigitPhase.value=digitPhase;
    u.uErrorDistort.value=this.errorSignals.distortion;u.uErrorTear.value=this.errorSignals.tear;
    u.uErrorCollapse.value=this.errorSignals.collapse;u.uErrorEject.value=this.errorSignals.eject;
    u.uErrorContainment.value=this.errorSignals.containment;
    u.uErrorJerk.value=this.errorSignals.jerk;u.uErrorSeed.value=this.errorSignals.seed;
    u.uErrorStructure.value=this.errorStructure;
    u.uMissingData.value=this.criticalSignals.missingData;
    u.uGradientDamage.value=this.criticalSignals.gradientDamage;
    u.uGeometryDamage.value=this.criticalSignals.geometryDamage;
    u.uDepthFade.value=this.lightingDebug.depthFade?CONFIG.LIGHTING.depthFadeStrength:0;
    u.uReliefActivity.value=this.workRibbonReliefStrength;u.uWorkRelief.value=this.workRibbonRelief;
    u.uRgbSplit.value=this.state==='error'?THREE.MathUtils.clamp(
      this.errorSignals.distortion*.55+this.errorSignals.tear*.9
      +this.errorSignals.collapse*.45+this.errorSignals.eject*.72,0,1):0;
  }

  private updateLightRig(){
    const debug=this.lightingDebug;
    this.keyLight.intensity=debug.directLight?CONFIG.LIGHTING.keyIntensity:0;
    this.keyLight.castShadow=debug.shadows&&debug.contactShadows;
    this.ambientLight.intensity=debug.ambientOcclusion?CONFIG.LIGHTING.ambientIntensity:0;
    this.fillLight.intensity=debug.directLight?CONFIG.LIGHTING.fillIntensity:0;
    this.coreAreaLights.forEach(light=>{
      light.intensity=debug.indirectLightSpill
        ?CONFIG.LIGHTING.spillIntensity*(.17+this.current.energy*.08):0;
      light.castShadow=debug.shadows&&debug.contactShadows;
    });
    this.ribbons.forEach(ribbon=>{
      ribbon.surface.position.copy(ribbon.mesh.position);
      ribbon.surface.visible=ribbon.uniforms.uVisibility.value>.01;
      const surfaceMaterial=ribbon.surface.material as THREE.MeshStandardMaterial;
      surfaceMaterial.emissiveIntensity=debug.emissive
        ?CONFIG.LIGHTING.ribbonEmission*(.62+this.current.energy*.28):0;
    });
  }

  // Reuses a compact physical proxy each frame. Its silhouette follows the
  // animated material closely enough for stable VSM contact/self-shadows,
  // while the dense glyph mesh remains entirely on the GPU.
  private deformShadowSurface(ribbon:Ribbon){
    const positions=ribbon.surfaceGeometry.getAttribute('position') as THREE.BufferAttribute;
    const uvs=ribbon.surfaceGeometry.getAttribute('uv') as THREE.BufferAttribute;
    const normals=ribbon.surfaceGeometry.getAttribute('normal') as THREE.BufferAttribute;
    const base=ribbon.surfaceBasePositions,u=ribbon.uniforms;
    const phase=u.uWavePhase.value-u.uOffset.value*.7+u.uErrorJerk.value*.42;
    for(let i=0;i<positions.count;i++){
      const p=i*3,theta=uvs.getX(i)*Math.PI*2,c=Math.cos(theta),s=Math.sin(theta);
      const wave=Math.sin(theta-phase)*.58+Math.sin(theta*2-phase*1.13)*.29+Math.sin(theta*4-phase*.91)*.13;
      const secondary=Math.sin(theta*2+u.uTime.value*.31+u.uOffset.value*5.3)*.44
        +Math.sin(theta*3-u.uTime.value*.19+u.uOffset.value*2.1)*.31;
      const irregular=Math.sin(theta+u.uTime.value*.41+u.uOffset.value*8.)*.56
        +Math.sin(theta*2-u.uTime.value*.23+u.uOffset.value*3.)*.29
        +Math.sin(theta*3+u.uTime.value*.13+u.uOffset.value*11.)*.15;
      const width=Math.max(.7,1+u.uWidthVariation.value*irregular+wave*u.uWaveAmplitude.value*1.42);
      const x=(base[p]-ribbon.radius*c)*width,y=(base[p+1]-ribbon.radius*s)*width,z=base[p+2]*width;
      const radial=u.uDeformation.value*(secondary*.28+Math.sin(theta-u.uTime.value*.17+u.uOffset.value)*.12)
        +wave*u.uWaveAmplitude.value*.26;
      const hillClock=u.uTime.value*(.64+u.uOffset.value*.17);
      const hillA=Math.pow(.5+.5*Math.sin(theta*5-hillClock
        +Math.sin(theta*2+hillClock*.37+u.uOffset.value*8)*1.25),4);
      const hillB=Math.pow(.5+.5*Math.sin(theta*7+hillClock*.71+u.uOffset.value*13),3);
      const livingRelief=(hillA*.9-hillB*.3+Math.sin(theta*11-hillClock*1.17)*.08)
        *ribbon.radius*u.uReliefRatio.value*u.uReliefActivity.value*u.uWorkRelief.value;
      positions.setXYZ(i,
        ribbon.radius*c+x+c*radial+normals.getX(i)*livingRelief,
        ribbon.radius*s+y+s*radial+normals.getY(i)*livingRelief,
        z+u.uDeformation.value*Math.sin(theta*2-u.uTime.value*.21+u.uOffset.value*9.)*(.45+u.uEnergy.value*.85)
        +wave*u.uWaveAmplitude.value*Math.max(0,(u.uEnergy.value-.62)/.38)*1.35
        +normals.getZ(i)*livingRelief,
      );
    }
    positions.needsUpdate=true;
  }

  update(dt:number,time:number){
    this.blendState(dt);
    // CALM and WORK are the same chaotic matter at different scales/speeds.
    // Keeping one representation removes the old sphere-over-chaos crossfade.
    this.workCoreChaos=damp(this.workCoreChaos,this.state==='work'?1:0,dt,2.8);
    this.workRibbonRelief=damp(this.workRibbonRelief,
      this.state==='work'&&this.workRibbonReliefEnabled?1:0,dt,3.2);
    this.livingChaosMix=damp(this.livingChaosMix,this.livingChaosEnabled?1:0,dt,4.2);
    const stableChaosTarget=this.state==='calm'||this.state==='work'?1:0;
    this.stableChaosPresence=damp(this.stableChaosPresence,stableChaosTarget,dt,4.8);
    this.coreChaosSpeed=damp(this.coreChaosSpeed,this.state==='calm'?1/3:1,dt,3.6);
    const controlledChaosStep=dt*this.coreChaosSpeed*this.chaosSpeedControl;
    this.coreChaosTime+=controlledChaosStep;
    this.chaosLayerTimes[0]+=controlledChaosStep*.82;
    this.chaosLayerTimes[1]+=controlledChaosStep*1.19;
    this.errorStructure=damp(this.errorStructure,
      this.state==='error'||this.state==='critical'?1:0,dt,CONFIG.STATE_TRANSITION_SPEED);
    const phaseError=this.errorDirector.update(dt,this.current.glitch);
    this.criticalSignals=this.criticalDirector.update(dt,this.current.glitch);
    const critical=this.criticalSignals;
    const criticalJerk=critical.frameSkip*Math.sin(Math.floor((time+critical.seed)*13.7)*2.17);
    this.errorSignals.distortion=Math.max(phaseError.distortion,critical.timeDesync*.72);
    this.errorSignals.tear=Math.max(phaseError.tear,critical.missingData);
    this.errorSignals.collapse=Math.max(phaseError.collapse,critical.coreAbsorption);
    this.errorSignals.eject=Math.max(phaseError.eject,critical.binaryEjection);
    this.errorSignals.containment=Math.max(phaseError.containment,critical.containment);
    this.errorSignals.jerk=THREE.MathUtils.clamp(phaseError.jerk+criticalJerk,-1,1);
    this.errorSignals.seed=critical.severity>.015?critical.seed:phaseError.seed;
    const containment=this.errorSignals.containment;
    const rebuildingFromContainment=containment>.002&&(
      this.state==='calm'||this.state==='work'||this.state==='critical2'||critical.previewMode>0
    );
    if(containment>.015&&!this.containmentLatched){
      this.containmentLatched=true;
      this.frozenCoreRotation.copy(this.core.rotation);
      this.frozenRootRotation.copy(this.root.rotation);
      this.frozenRootPosition.copy(this.root.position);
    }else if(containment<.008&&this.containmentLatched){
      this.containmentLatched=false;
    }
    const brokenTempo=THREE.MathUtils.clamp(1+this.errorSignals.jerk*(.55+this.errorSignals.distortion*.65),.18,2.15);
    this.organismWavePhase+=dt*this.current.waveSpeed*brokenTempo;
    this.coreGradientPhase+=dt*(this.current.gradientSpeed*(1-containment)+containment*.28);
    this.coreDigitPhase+=dt*(this.current.rewriteSpeed*(1-containment)+containment*4.2);
    this.coreRotation+=dt*(.035+this.current.orbitSpeed*.07)*(1-containment);
    this.updateUniforms(this.coreUniforms,time,this.organismWavePhase,this.coreGradientPhase,this.coreDigitPhase,.78);
    const overloadPulse=critical.coreOverload*(Math.sin(time*8.7+critical.seed)*.075
      +Math.sin(time*19.3)*.035+Math.sin(Math.floor(time*7.2))*.025);
    const coreBreath=Math.sin(this.organismWavePhase)*this.current.corePulse
      +Math.sin(time*.37)*this.current.corePulse*.26+overloadPulse;
    const absorption=1+this.errorSignals.collapse*.86+this.errorSignals.tear*.16-this.errorSignals.eject*.12;
    const dynamicCoreScale=this.current.coreScale*(1+coreBreath)*absorption+(this.hovered?.018:0);
    const workStableScale=STATE_TUNING.work.coreScale;
    const morphedCoreScale=THREE.MathUtils.lerp(dynamicCoreScale,workStableScale,this.workCoreChaos);
    const fixedCoreScale=STATE_TUNING.error.coreScale;
    const coreScale=THREE.MathUtils.lerp(morphedCoreScale,fixedCoreScale,containment);
    this.core.scale.setScalar(coreScale);
    this.coreUniforms.uVisibility.value=1-this.stableChaosPresence;
    const dynamicCoreX=Math.sin(time*.19)*.075+Math.sin(time*.071)*.025;
    this.core.rotation.x=THREE.MathUtils.lerp(dynamicCoreX,this.frozenCoreRotation.x,containment);
    this.core.rotation.y=THREE.MathUtils.lerp(this.coreRotation,this.frozenCoreRotation.y,containment);
    this.core.rotation.z=THREE.MathUtils.lerp(0,this.frozenCoreRotation.z,containment);

    const chaosIntensity=Math.max(containment,critical.coreOverload*.72,this.stableChaosPresence);
    this.containmentUniforms.forEach((uniforms,index)=>{
      uniforms.uTime.value=this.chaosLayerTimes[index];
      uniforms.uIntensity.value=chaosIntensity;
      uniforms.uSeed.value=this.errorSignals.seed+(index===0?.17:.73);
      uniforms.uLiving.value=this.livingChaosMix;
    });
    this.coreChaosUniforms.uTime.value=this.coreChaosTime;
    const faultDigits=Math.max(containment,critical.coreOverload*.72);
    // The outer free-particle layer is reserved for faults. CALM <-> WORK only
    // changes speed and scale, so no transient spherical shell can appear.
    this.coreChaosUniforms.uIntensity.value=Math.max(faultDigits,this.stableChaosPresence);
    this.coreChaosUniforms.uVisibility.value=faultDigits;
    this.containmentChaos.scale.setScalar(coreScale);
    this.containmentChaos.rotation.set(0,0,0);
    const outerChaos=this.containmentChaos.children[0];
    const innerChaos=this.containmentChaos.children[1];
    outerChaos.rotation.set(
      this.chaosLayerTimes[0]*.63,this.chaosLayerTimes[0]*-.91,this.chaosLayerTimes[0]*.47,
    );
    innerChaos.rotation.set(
      .7+this.chaosLayerTimes[1]*-1.08,.2+this.chaosLayerTimes[1]*.74,
      .4+this.chaosLayerTimes[1]*1.21,
    );

    const maxSafeScale=1+CONFIG.SAFE_RENDER_MARGIN*.22;
    const errorBaseScale=1-this.current.contraction;
    const dominantRadius=CONFIG.RIBBON_RADII[1]*errorBaseScale;
    const dominant=this.ribbons[1];
    this.ribbons.forEach((ribbon,index)=>{
      const individuality=1+(index-1)*.065;
      const localDamage=THREE.MathUtils.lerp(1,
        index===critical.affectedRibbon?1:.16+critical.severity*.18,critical.severity);
      const ribbonRate=critical.ribbonRates[index];
      const localTempo=brokenTempo*ribbonRate;
      ribbon.orbitAngle+=dt*this.current.orbitSpeed*(.13+index*.025)*(index===1?-1:1)*localTempo*(1-containment);
      ribbon.selfPhase+=dt*this.current.selfRotation*(.88+index*.13)*localTempo*(1-containment);
      ribbon.gradientPhase+=dt*this.current.gradientSpeed*(.91+index*.08)*ribbonRate;
      ribbon.digitPhase+=dt*this.current.rewriteSpeed*(.9+index*.1)*ribbonRate;
      const desyncPhase=critical.timeDesync*localDamage*Math.sin(Math.floor((time+index*.17)*9.)*1.91);
      this.updateUniforms(ribbon.uniforms,time,this.organismWavePhase-ribbon.waveOffset+desyncPhase,
        ribbon.gradientPhase,ribbon.digitPhase,individuality);
      ribbon.uniforms.uMissingData.value*=localDamage;
      ribbon.uniforms.uGradientDamage.value*=localDamage;
      ribbon.uniforms.uGeometryDamage.value*=localDamage;
      const collapseBlend=rebuildingFromContainment?0:this.errorSignals.collapse;
      ribbon.uniforms.uVisibility.value=(1-collapseBlend*(index===1?0:.72))*(1-containment*.995);
      const particles=ribbon.particleUniforms;
      const phaseParticleIntensity=Math.max(
        phaseError.distortion,phaseError.tear,phaseError.collapse,phaseError.eject,
      );
      const criticalParticleIntensity=Math.max(
        critical.missingData,critical.binaryEjection,critical.binaryAttraction,
        critical.coreAbsorption,critical.coreOverload*.55,
      );
      particles.uTime.value=time;
      particles.uIntensity.value=Math.max(phaseParticleIntensity,criticalParticleIntensity);
      particles.uTear.value=this.errorSignals.tear*localDamage;
      particles.uCollapse.value=Math.max(this.errorSignals.collapse,critical.binaryAttraction*localDamage);
      particles.uEject.value=this.errorSignals.eject*localDamage;particles.uContainment.value=containment;
      particles.uErrorSeed.value=this.errorSignals.seed+index*.37;
      const flexX=Math.sin(time*(.19+index*.017)+ribbon.phase)*(.055+this.current.deformation*.3);
      const flexZ=Math.sin(time*(.113+index*.013)+ribbon.phase*1.7)*(.04+this.current.deformation*.22);
      const selfRock=Math.sin(ribbon.selfPhase+ribbon.phase)*(.052+this.current.twist*.62);
      const errorTension=this.current.glitch*Math.sin(time*(17+index*2)+ribbon.phase)*.018
        +this.errorSignals.jerk*(.025+this.errorSignals.tear*.045);
      const regularX=ribbon.baseRotation.x+flexX;
      const regularY=ribbon.baseRotation.y+ribbon.orbitAngle+errorTension;
      const regularZ=ribbon.baseRotation.z+flexZ+selfRock;
      const collapseX=dominant.baseRotation.x+Math.sin(time*.23)*.035;
      const collapseY=dominant.baseRotation.y+dominant.orbitAngle+this.errorSignals.jerk*.04;
      const collapseZ=dominant.baseRotation.z+Math.sin(time*.17)*.04;
      const collapsedX=THREE.MathUtils.lerp(regularX,collapseX,collapseBlend);
      const collapsedY=THREE.MathUtils.lerp(regularY,collapseY,collapseBlend);
      const collapsedZ=THREE.MathUtils.lerp(regularZ,collapseZ,collapseBlend);
      if(rebuildingFromContainment){
        // Reorient while the ribbon is still hidden in the core, then reveal it
        // already on its CALM/WORK orbit instead of visibly unwinding outward.
        ribbon.group.rotation.set(regularX,regularY,regularZ);
      }else{
        ribbon.group.rotation.set(
          THREE.MathUtils.lerp(collapsedX,dominant.baseRotation.x,containment),
          THREE.MathUtils.lerp(collapsedY,dominant.baseRotation.y,containment),
          THREE.MathUtils.lerp(collapsedZ,dominant.baseRotation.z,containment),
        );
      }
      const complexBreath=(Math.sin(time*.47+ribbon.phase)*.58+Math.sin(time*.197+ribbon.phase*1.37)*.29
        +Math.sin(time*.083+ribbon.phase*.61)*.13)*this.current.widthVariation*.14;
      const normalScale=1-this.current.contraction+complexBreath;
      const collapsedScale=dominantRadius/CONFIG.RIBBON_RADII[index];
      const activeScale=THREE.MathUtils.lerp(normalScale,collapsedScale,collapseBlend);
      const containedScale=CONFIG.CORE_RADIUS*fixedCoreScale*.92/CONFIG.RIBBON_RADII[index];
      const desiredScale=THREE.MathUtils.lerp(activeScale,containedScale,containment);
      ribbon.group.scale.setScalar(THREE.MathUtils.clamp(desiredScale,.08,maxSafeScale));
      ribbon.mesh.position.z=Math.sin(time*.31+ribbon.phase)*(.018+this.current.deformation*.09)*(1-containment);
      this.deformShadowSurface(ribbon);
      ribbon.ghosts.forEach(ghost=>{
        this.updateUniforms(ghost.uniforms,time-ghost.lag,
          this.organismWavePhase-ribbon.waveOffset+desyncPhase-ghost.lag*this.current.waveSpeed,
          ribbon.gradientPhase-ghost.lag*this.current.gradientSpeed,
          ribbon.digitPhase-ghost.lag*this.current.rewriteSpeed,individuality);
        const baseGhost=this.state==='work'?.34:this.state==='calm'?.24:0;
        const baseGhostAlpha=baseGhost*(ghost.lag<.1?1:.56);
        const damageGhostAlpha=critical.ghost*localDamage*(ghost.lag<.1?.28:.16);
        ghost.uniforms.uVisibility.value=Math.max(baseGhostAlpha,damageGhostAlpha)*(1-containment);
        ghost.uniforms.uSaturation.value=ghost.lag<.1?.56:.22;
        ghost.group.rotation.set(
          ribbon.group.rotation.x-ghost.lag*(.25+critical.timeDesync),
          ribbon.group.rotation.y-ghost.lag*this.current.orbitSpeed*ribbonRate*(index===1?-1:1),
          ribbon.group.rotation.z+ghost.lag*(.18+critical.geometryDamage*.4),
        );
        ghost.group.scale.copy(ribbon.group.scale);
        ghost.mesh.position.copy(ribbon.mesh.position);
      });
    });
    const sharedEnergy=.05+this.current.energy*.016;
    const dynamicRootY=Math.sin(time*.13)*sharedEnergy+Math.sin(time*.047)*.03;
    const dynamicRootX=Math.cos(time*.17)*sharedEnergy*.5+Math.sin(time*.061)*.022;
    const dynamicRootYPosition=Math.sin(time*.41)*.028+Math.sin(time*.109)*.016;
    this.root.rotation.y=THREE.MathUtils.lerp(dynamicRootY,this.frozenRootRotation.y,containment);
    this.root.rotation.x=THREE.MathUtils.lerp(dynamicRootX,this.frozenRootRotation.x,containment);
    this.root.rotation.z=THREE.MathUtils.lerp(0,this.frozenRootRotation.z,containment);
    this.root.position.x=THREE.MathUtils.lerp(0,this.frozenRootPosition.x,containment);
    this.root.position.y=THREE.MathUtils.lerp(dynamicRootYPosition,this.frozenRootPosition.y,containment);
    this.root.position.z=THREE.MathUtils.lerp(0,this.frozenRootPosition.z,containment);
    this.updateLightRig();
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.renderer.dispose();}
}
