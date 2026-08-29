import * as THREE from 'three';
import { CONFIG,STATE_TUNING,type StateTuning } from './config';
import {
  CriticalErrorDirector,type CriticalDamage,type CriticalSignals,
} from './critical-error-director';
import { ErrorDirector,type ErrorSignals } from './error-director';
import { getVisualState,type Snapshot,type VisualState } from './state';
import {
  containmentFragmentShader,containmentVertexShader,coreChaosVertexShader,cubeGlyphFragmentShader,cubeGlyphVertexShader,fragmentShader,
  particleFragmentShader,particleVertexShader,terrainFragmentShader,terrainVertexShader,vertexShader,
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
  uTerrainMorph:{value:number};
  uReliefActivity:{value:number};uWorkRelief:{value:number};uReliefRatio:{value:number};
};
type ParticleUniforms={
  uTime:{value:number};uIntensity:{value:number};uTear:{value:number};
  uCollapse:{value:number};uEject:{value:number};uContainment:{value:number};
  uErrorSeed:{value:number};uPixelRatio:{value:number};
};
type ContainmentUniforms={
  uTime:{value:number};uIntensity:{value:number};uSeed:{value:number};uLayer:{value:number};
  uLiving:{value:number};uMatterRemaining:{value:number};uConversion:{value:number};
  uCompression:{value:number};uSeedMorph:{value:number};uSeedCenter:{value:THREE.Vector3};
  uTerrainMorph:{value:number};
};
type CoreChaosUniforms={
  uTime:{value:number};uIntensity:{value:number};uVisibility:{value:number};uPixelRatio:{value:number};
  uCompression:{value:number};uSeedMorph:{value:number};uSeedCenter:{value:THREE.Vector3};
  uTerrainMorph:{value:number};
};
type Ribbon={
  group:THREE.Group;mesh:THREE.Mesh;surface:THREE.Mesh;uniforms:Uniforms;baseRotation:THREE.Euler;
  surfaceGeometry:THREE.BufferGeometry;surfaceBasePositions:Float32Array;radius:number;
  particles:THREE.Points;particleUniforms:ParticleUniforms;
  ghosts:{group:THREE.Group;mesh:THREE.Mesh;uniforms:Uniforms;lag:number}[];
  phase:number;orbitAngle:number;selfPhase:number;waveOffset:number;
  gradientPhase:number;digitPhase:number;
};
type CubeGlyphUniforms={
  uTime:{value:number};uVisibility:{value:number};uPixelRatio:{value:number};
  uPeriod:{value:number};uDuration:{value:number};uTransition:{value:number};uSeedMorph:{value:number};
};
type CubeMatter={
  group:THREE.Group;cells:THREE.InstancedMesh;material:THREE.MeshStandardMaterial;
  seedCell:THREE.Mesh;seedMaterial:THREE.MeshStandardMaterial;
  glyphs:THREE.Points;glyphUniforms:CubeGlyphUniforms;
  centerLight:THREE.PointLight;violetLight:THREE.PointLight;
  core:THREE.Mesh;centers:THREE.Vector3[];seeds:Float32Array;formationStarts:Float32Array;
  presence:number;formedMass:number;matterRemaining:number;seedIndex:number;
};

export type TerrainParameterKey='amplitude'|'macroFrequency'|'macroSpeed'|'mediumStrength'
  |'mediumFrequency'|'waveDirectionCount'|'localEventFrequency'|'localEventRadius'
  |'localEventStrength'|'localEventLifetime'|'simulationDamping'|'propagationStrength'
  |'microDisplacement'|'binaryDensity'|'binaryFlipRate'|'activityFlipCoupling'
  |'edgeFadeStart'|'edgeFadeWidth'|'emission'|'warmWhiteIntensity'|'amberThreshold'
  |'redThreshold'|'aoStrength'|'bloomThreshold'|'bloomStrength'|'bloomRadius'
  |'exposure'|'fogAttenuation';
type TerrainParameters=Record<TerrainParameterKey,number>;
type TerrainMatter={
  group:THREE.Group;mesh:THREE.Mesh;material:THREE.ShaderMaterial;
  uniforms:Record<string,{value:number}>;
  parameterUniforms:Record<TerrainParameterKey,{value:number}>;
};

const TERRAIN_DEFAULTS:TerrainParameters={
  amplitude:.74,macroFrequency:.24,macroSpeed:.055,mediumStrength:.2,mediumFrequency:1.08,
  waveDirectionCount:5,localEventFrequency:.82,localEventRadius:1.12,localEventStrength:.58,
  localEventLifetime:4.8,simulationDamping:.92,propagationStrength:.46,microDisplacement:.032,
  binaryDensity:.92,binaryFlipRate:1,activityFlipCoupling:.34,edgeFadeStart:.68,edgeFadeWidth:.3,
  emission:.88,warmWhiteIntensity:.92,amberThreshold:.72,redThreshold:.93,aoStrength:.62,
  bloomThreshold:.74,bloomStrength:.52,bloomRadius:.34,exposure:.94,fogAttenuation:.2,
};
const TERRAIN_LIMITS:Record<TerrainParameterKey,readonly[number,number]>={
  amplitude:[0,1.4],macroFrequency:[.04,.8],macroSpeed:[0,.4],mediumStrength:[0,.8],
  mediumFrequency:[.2,3],waveDirectionCount:[1,5],localEventFrequency:[.1,2.5],
  localEventRadius:[.2,2.8],localEventStrength:[0,1.4],localEventLifetime:[1,12],
  simulationDamping:[0,1],propagationStrength:[0,1.5],microDisplacement:[0,.18],
  binaryDensity:[.15,1],binaryFlipRate:[0,3],activityFlipCoupling:[0,2],
  edgeFadeStart:[.35,.95],edgeFadeWidth:[.05,.6],emission:[0,2],warmWhiteIntensity:[0,2],
  amberThreshold:[.2,.98],redThreshold:[.5,1],aoStrength:[0,1],bloomThreshold:[0,1],
  bloomStrength:[0,2],bloomRadius:[0,1],exposure:[.2,2],fogAttenuation:[0,1],
};

export type CubeTransitionPhase='inactive'|'convergeToError'|'kernelHold'|'morphToSeed'
  |'seedOnly'|'expand'|'idle'|'collapseCube'|'reverseSeedOnly'|'seedToKernel'
  |'reverseKernelHold'|'releaseRibbons';
export type VisualEntityKey='ribbons'|'kernel'|'chaos'|'seedCube'|'cubeCells'|'cubeLight';
type VisualOwnership=Record<VisualEntityKey,boolean>;

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
    uTerrainMorph:{value:0},
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
  private coreAreaLightBaseColors:THREE.Color[]=[];
  private coreAreaLightBasePositions:THREE.Vector3[]=[];
  private cubeMatter:CubeMatter;
  private cubeMatrix=new THREE.Matrix4();
  private cubePosition=new THREE.Vector3();
  private cubeScale=new THREE.Vector3();
  private cubeAxis=new THREE.Vector3();
  private cubeRotation=new THREE.Quaternion();
  private cameraTarget=new THREE.Vector3();
  private terrainMatter:TerrainMatter;
  private terrainPresence=0;
  private terrainTransition=0;
  // 0..1 controls the shared matter reorganisation, independently of the
  // final CUBE idle animation.  Every existing state enters through it.
  private cubeTransition=0;
  private cubeCompression=0;
  private cubeSeedMorph=0;
  private cubeSeedComplete=false;
  private cubePhase:CubeTransitionPhase='inactive';
  private cubeReverseActive=false;
  private frozenCubeRotation=new THREE.Euler();
  private cubeTransitionTimeScale:number=CONFIG.EXPERIMENTS.cubeTransitionTimeScale;
  private cubeAmberBrightness=1;
  private cubeVioletBrightness=1;
  private visualEntityDebug:VisualOwnership={
    ribbons:true,kernel:true,chaos:true,seedCube:true,cubeCells:true,cubeLight:true,
  };
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
      this.coreAreaLights.push(light);this.coreAreaLightBaseColors.push(new THREE.Color(emitterColors[index]));
      this.coreAreaLightBasePositions.push(light.position.clone());
      this.root.add(light);
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
    this.cubeMatter=this.createCubeMatter();
    this.root.add(this.cubeMatter.group);
    this.terrainMatter=this.createTerrainMatter();
    this.scene.add(this.terrainMatter.group);
    this.resize();addEventListener('resize',()=>this.resize());
  }

  private createContainmentChaos(){
    const group=new THREE.Group();
    const makeLayer=(geometry:THREE.BufferGeometry,layer:number,seed:number)=>{
      const uniforms:ContainmentUniforms={
        uTime:{value:0},uIntensity:{value:0},uSeed:{value:seed},uLayer:{value:layer},uLiving:{value:1},
        uMatterRemaining:{value:1},uConversion:{value:0},
        uCompression:{value:0},uSeedMorph:{value:0},uSeedCenter:{value:new THREE.Vector3()},
        uTerrainMorph:{value:0},
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
      uCompression:{value:0},uSeedMorph:{value:0},uSeedCenter:{value:new THREE.Vector3()},
      uTerrainMorph:{value:0},
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
      if(next==='cube'&&this.state!=='cube'){
        if(this.cubeReverseActive){
          // A re-entry during the reverse transition resumes from the exact
          // conserved topology instead of restarting or popping.
          this.cubeReverseActive=false;
        }else{
          const alreadyPrepared=this.state==='error'&&this.errorSignals.containment>.85;
          this.cubeTransition=alreadyPrepared
            ?CONFIG.EXPERIMENTS.cubeCoreGatherSeconds/CONFIG.EXPERIMENTS.cubeTransitionSeconds:0;
        }
      }else if(this.state==='cube'&&next!=='cube'){
        this.cubeReverseActive=this.cubeTransition>0;
        this.frozenCubeRotation.copy(this.cubeMatter.group.rotation);
      }
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
  setCubeTransitionTimeScale(value:number){
    this.cubeTransitionTimeScale=THREE.MathUtils.clamp(value,.1,2);
  }
  setTerrainParameter(key:TerrainParameterKey,value:number){
    const [minimum,maximum]=TERRAIN_LIMITS[key];
    this.terrainMatter.parameterUniforms[key].value=THREE.MathUtils.clamp(value,minimum,maximum);
  }
  getTerrainParameters():Readonly<TerrainParameters>{
    return Object.fromEntries((Object.keys(this.terrainMatter.parameterUniforms) as TerrainParameterKey[])
      .map(key=>[key,this.terrainMatter.parameterUniforms[key].value])) as TerrainParameters;
  }
  setVisualEntityDebug(entity:VisualEntityKey,enabled:boolean){
    this.visualEntityDebug[entity]=enabled;
  }
  getCubeTransitionPhase(){return this.cubePhase;}

  setCubeAmberBrightness(value:number){
    this.cubeAmberBrightness=THREE.MathUtils.clamp(value,0,2);
  }

  setCubeVioletBrightness(value:number){
    this.cubeVioletBrightness=THREE.MathUtils.clamp(value,0,2);
  }

  private getVisualOwnership():VisualOwnership{
    if(this.cubePhase==='inactive'){
      return{ribbons:true,kernel:true,chaos:true,seedCube:false,cubeCells:false,cubeLight:false};
    }
    if(this.cubePhase==='convergeToError'){
      return{ribbons:true,kernel:true,chaos:true,seedCube:false,cubeCells:false,cubeLight:false};
    }
    if(this.cubePhase==='kernelHold'){
      return{ribbons:false,kernel:true,chaos:true,seedCube:false,cubeCells:false,cubeLight:false};
    }
    if(this.cubePhase==='morphToSeed'){
      // The contained old matter owns this phase. The actual seed is prepared
      // offscreen and takes ownership only after the topology morph completes,
      // preventing a spherical shell and square from being visible together.
      return{ribbons:false,kernel:true,chaos:true,seedCube:false,cubeCells:false,cubeLight:true};
    }
    if(this.cubePhase==='seedOnly'){
      return{ribbons:false,kernel:false,chaos:false,seedCube:true,cubeCells:false,cubeLight:true};
    }
    if(this.cubePhase==='collapseCube'){
      return{ribbons:false,kernel:false,chaos:false,seedCube:false,cubeCells:true,cubeLight:true};
    }
    if(this.cubePhase==='reverseSeedOnly'){
      return{ribbons:false,kernel:false,chaos:false,seedCube:true,cubeCells:false,cubeLight:true};
    }
    if(this.cubePhase==='seedToKernel'){
      return{ribbons:false,kernel:false,chaos:true,seedCube:false,cubeCells:false,cubeLight:false};
    }
    if(this.cubePhase==='reverseKernelHold'){
      return{ribbons:false,kernel:true,chaos:true,seedCube:false,cubeCells:false,cubeLight:false};
    }
    if(this.cubePhase==='releaseRibbons'){
      return{ribbons:true,kernel:true,chaos:true,seedCube:false,cubeCells:false,cubeLight:false};
    }
    return{ribbons:false,kernel:false,chaos:false,seedCube:false,cubeCells:true,cubeLight:true};
  }

  private applyVisualOwnership(){
    const owned=this.getVisualOwnership(),debug=this.visualEntityDebug;
    const terrainExclusive=this.state==='terrain'&&this.terrainPresence>.995;
    const showRibbons=owned.ribbons&&debug.ribbons&&!terrainExclusive;
    this.ribbons.forEach(ribbon=>{
      ribbon.group.visible=showRibbons;
      ribbon.ghosts.forEach(ghost=>{ghost.group.visible=showRibbons;});
    });
    this.core.visible=owned.kernel&&debug.kernel&&!terrainExclusive;
    this.containmentChaos.visible=owned.chaos&&debug.chaos&&!terrainExclusive;
    const showSeed=owned.seedCube&&debug.seedCube;
    const showCells=owned.cubeCells&&debug.cubeCells;
    this.cubeMatter.group.visible=showSeed||showCells||(owned.cubeLight&&debug.cubeLight);
    this.cubeMatter.cells.visible=showCells;
    this.cubeMatter.seedCell.visible=showSeed;
    this.cubeMatter.glyphs.visible=showSeed||showCells;
    this.cubeMatter.centerLight.visible=owned.cubeLight&&debug.cubeLight;
    this.cubeMatter.violetLight.visible=owned.cubeLight&&debug.cubeLight;
  }

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

  /**
   * Dense binary height field. One four-vertex glyph quad is instanced across
   * the logical X/Z domain; deformation, normals, bit lifetimes, light and edge
   * dissolution all remain on the GPU.
   */
  private createTerrainMatter():TerrainMatter{
    const columns=CONFIG.EXPERIMENTS.terrainColumns,rows=CONFIG.EXPERIMENTS.terrainRows;
    const count=columns*rows;
    const geometry=new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      -1,-1,0, 1,-1,0, 1,1,0, -1,1,0,
    ],3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute([
      0,0, 1,0, 1,1, 0,1,
    ],2));
    geometry.setIndex([0,1,2,0,2,3]);
    const grid=new Float32Array(count*2),seeds=new Float32Array(count),bits=new Float32Array(count);
    let instance=0;
    for(let z=0;z<rows;z++)for(let x=0;x<columns;x++,instance++){
      const px=(x/(columns-1)-.5)*CONFIG.EXPERIMENTS.terrainWidth;
      const pz=(z/(rows-1)-.5)*CONFIG.EXPERIMENTS.terrainDepth;
      const seed=Math.abs(Math.sin((instance+1)*91.731+x*17.13+z*7.91)*43758.5453)%1;
      grid[instance*2]=px;grid[instance*2+1]=pz;seeds[instance]=seed;
      bits[instance]=seed>.5?1:0;
    }
    geometry.setAttribute('aGrid',new THREE.InstancedBufferAttribute(grid,2));
    geometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,1));
    geometry.setAttribute('aBit',new THREE.InstancedBufferAttribute(bits,1));
    geometry.instanceCount=count;
    geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),5.6);

    const parameterUniforms=Object.fromEntries(
      (Object.keys(TERRAIN_DEFAULTS) as TerrainParameterKey[]).map(key=>[key,{value:TERRAIN_DEFAULTS[key]}]),
    ) as Record<TerrainParameterKey,{value:number}>;
    const uniforms:Record<string,{value:number}>={
      uTime:{value:0},uPresence:{value:0},uTopologyProgress:{value:0},
      uAmplitude:parameterUniforms.amplitude,uMacroFrequency:parameterUniforms.macroFrequency,
      uMacroSpeed:parameterUniforms.macroSpeed,uMediumStrength:parameterUniforms.mediumStrength,
      uMediumFrequency:parameterUniforms.mediumFrequency,uWaveDirectionCount:parameterUniforms.waveDirectionCount,
      uLocalEventFrequency:parameterUniforms.localEventFrequency,uLocalEventRadius:parameterUniforms.localEventRadius,
      uLocalEventStrength:parameterUniforms.localEventStrength,uLocalEventLifetime:parameterUniforms.localEventLifetime,
      uSimulationDamping:parameterUniforms.simulationDamping,uPropagationStrength:parameterUniforms.propagationStrength,
      uMicroDisplacement:parameterUniforms.microDisplacement,uBinaryDensity:parameterUniforms.binaryDensity,
      uBinaryFlipRate:parameterUniforms.binaryFlipRate,uActivityFlipCoupling:parameterUniforms.activityFlipCoupling,
      uEdgeFadeStart:parameterUniforms.edgeFadeStart,uEdgeFadeWidth:parameterUniforms.edgeFadeWidth,
      uEmission:parameterUniforms.emission,uWarmWhiteIntensity:parameterUniforms.warmWhiteIntensity,
      uAmberThreshold:parameterUniforms.amberThreshold,uRedThreshold:parameterUniforms.redThreshold,
      uAoStrength:parameterUniforms.aoStrength,uBloomThreshold:parameterUniforms.bloomThreshold,
      uBloomStrength:parameterUniforms.bloomStrength,uBloomRadius:parameterUniforms.bloomRadius,
      uExposure:parameterUniforms.exposure,uFogAttenuation:parameterUniforms.fogAttenuation,
    };
    const material=new THREE.ShaderMaterial({
      uniforms,vertexShader:terrainVertexShader,fragmentShader:terrainFragmentShader,
      transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
      blending:THREE.NormalBlending,
    });
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=18;
    const group=new THREE.Group();group.add(mesh);group.visible=false;
    // TERRAIN stays horizontal in world space. Perspective comes from the
    // state camera, not from rotating the field into an isometric view.
    group.rotation.set(0,0,0);group.position.set(.08,-.28,.45);
    return{group,mesh,material,uniforms,parameterUniforms};
  }

  /**
   * A new topology made from the same binary matter vocabulary.  The physical
   * lattice is an InstancedMesh (one draw call), while a separate GPU glyph
   * layer keeps the 0/1 atoms continuous when a cell temporarily loses form.
   */
  private createCubeMatter():CubeMatter{
    const axis=CONFIG.EXPERIMENTS.cubeCellsPerAxis;
    const count=axis**3;
    const pitch=CONFIG.EXPERIMENTS.cubeCellSize+CONFIG.EXPERIMENTS.cubeCellGap;
    const centers:THREE.Vector3[]=[];
    const seeds=new Float32Array(count);
    const formationStarts=new Float32Array(count);
    const seedCell=(Math.floor(axis/2)-1)*axis*axis+Math.floor(axis/2)*axis+(Math.floor(axis/2)-1);
    const material=new THREE.MeshStandardMaterial({
      color:0x171518,emissive:0x120d08,emissiveIntensity:.1,
      metalness:.34,roughness:.46,transparent:true,opacity:0,vertexColors:true,
    });
    const cells=new THREE.InstancedMesh(
      new THREE.BoxGeometry(CONFIG.EXPERIMENTS.cubeCellSize,CONFIG.EXPERIMENTS.cubeCellSize,CONFIG.EXPERIMENTS.cubeCellSize),
      material,count,
    );
    cells.castShadow=true;cells.receiveShadow=true;cells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cells.renderOrder=3;
    const seedMaterial=material.clone();
    const seedCellMesh=new THREE.Mesh(
      new THREE.BoxGeometry(CONFIG.EXPERIMENTS.cubeCellSize,CONFIG.EXPERIMENTS.cubeCellSize,CONFIG.EXPERIMENTS.cubeCellSize),
      seedMaterial,
    );
    seedCellMesh.castShadow=true;seedCellMesh.receiveShadow=true;seedCellMesh.renderOrder=3;
    seedCellMesh.visible=false;
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1);
    const graphite=new THREE.Color(),warm=new THREE.Color(0x5e3517);
    let cell=0;
    for(let z=0;z<axis;z++)for(let y=0;y<axis;y++)for(let x=0;x<axis;x++,cell++){
      position.set((x-(axis-1)/2)*pitch,(y-(axis-1)/2)*pitch,(z-(axis-1)/2)*pitch);
      centers.push(position.clone());
      const seed=Math.abs(Math.sin((cell+1)*127.13)*43758.5453)%1;
      seeds[cell]=seed;
      // A centre-outward tendency with locally correlated variation makes
      // crystallisation cluster and bridge rather than scan as a voxel printer.
      formationStarts[cell]=cell===seedCell?.12
        :.25+Math.min(1,position.length()/2.25)*.42+seed*.13;
      matrix.compose(position,new THREE.Quaternion(),scale);cells.setMatrixAt(cell,matrix);
      const warmth=Math.pow(Math.max(0,1-position.length()/1.8),2.8);
      graphite.setRGB(.055+seed*.025,.05+seed*.022,.048+seed*.02).lerp(warm,warmth*.42);
      cells.setColorAt(cell,graphite);
    }
    cells.instanceMatrix.needsUpdate=true;
    if(cells.instanceColor)cells.instanceColor.needsUpdate=true;

    const glyphsPerCell=4;
    const glyphCount=count*glyphsPerCell;
    const glyphPositions=new Float32Array(glyphCount*3);
    const glyphCells=new Float32Array(glyphCount*3);
    const glyphOffsets=new Float32Array(glyphCount*3);
    const glyphSeeds=new Float32Array(glyphCount),glyphAtoms=new Float32Array(glyphCount);
    const glyphBits=new Float32Array(glyphCount),glyphStarts=new Float32Array(glyphCount);
    const glyphIsSeed=new Float32Array(glyphCount);
    for(let i=0;i<glyphCount;i++){
      const source=Math.floor(i/glyphsPerCell),center=centers[source],atom=i%glyphsPerCell;
      const angle=atom*Math.PI*.5+Math.PI*.25;
      glyphCells.set(center.toArray(),i*3);
      glyphOffsets.set([Math.cos(angle)*.038,Math.sin(angle)*.038,(atom&1?1:-1)*.022],i*3);
      glyphSeeds[i]=seeds[source];
      glyphStarts[i]=formationStarts[source];
      glyphIsSeed[i]=source===seedCell?1:0;
      glyphAtoms[i]=Math.abs(Math.sin((i+3)*91.71)*43758.5453)%1;
      glyphBits[i]=glyphAtoms[i]>.5?1:0;
    }
    const glyphGeometry=new THREE.BufferGeometry();
    glyphGeometry.setAttribute('position',new THREE.BufferAttribute(glyphPositions,3));
    glyphGeometry.setAttribute('aCell',new THREE.BufferAttribute(glyphCells,3));
    glyphGeometry.setAttribute('aOffset',new THREE.BufferAttribute(glyphOffsets,3));
    glyphGeometry.setAttribute('aSeed',new THREE.BufferAttribute(glyphSeeds,1));
    glyphGeometry.setAttribute('aAtom',new THREE.BufferAttribute(glyphAtoms,1));
    glyphGeometry.setAttribute('aBit',new THREE.BufferAttribute(glyphBits,1));
    glyphGeometry.setAttribute('aFormationStart',new THREE.BufferAttribute(glyphStarts,1));
    glyphGeometry.setAttribute('aIsSeed',new THREE.BufferAttribute(glyphIsSeed,1));
    const glyphUniforms:CubeGlyphUniforms={
      uTime:{value:0},uVisibility:{value:0},uPixelRatio:{value:Math.min(devicePixelRatio,2)},
      uPeriod:{value:CONFIG.EXPERIMENTS.cubeFragmentPeriod},uDuration:{value:CONFIG.EXPERIMENTS.cubeFragmentDuration},
      uTransition:{value:0},uSeedMorph:{value:0},
    };
    const glyphMaterial=new THREE.ShaderMaterial({
      uniforms:glyphUniforms,vertexShader:cubeGlyphVertexShader,fragmentShader:cubeGlyphFragmentShader,
      transparent:true,depthWrite:false,depthTest:true,blending:THREE.NormalBlending,
    });
    const glyphs=new THREE.Points(glyphGeometry,glyphMaterial);glyphs.frustumCulled=false;glyphs.renderOrder=5;
    const core=new THREE.Mesh(new THREE.SphereGeometry(.27,32,20),new THREE.MeshBasicMaterial({
      color:0xffa64d,transparent:true,opacity:0,depthWrite:false,
    }));
    core.renderOrder=1;
    const centerLight=new THREE.PointLight(0xff9b4a,0,3.6,2);
    // Permanent cube-owned violet energy. This is a real internal light, not
    // a leftover Kernel layer and not an exterior fill source.
    const violetLight=new THREE.PointLight(0xb765ff,0,3.6,2);
    violetLight.position.set(-.2,.14,.06);
    centerLight.castShadow=false;violetLight.castShadow=false;
    const group=new THREE.Group();group.visible=false;
    group.add(core,cells,seedCellMesh,glyphs,centerLight,violetLight);
    return{group,cells,seedCell:seedCellMesh,seedMaterial,material,glyphs,glyphUniforms,centerLight,violetLight,core,centers,seeds,formationStarts,
      presence:0,formedMass:0,matterRemaining:1,seedIndex:seedCell};
  }

  private updateCubeMatter(dt:number,time:number){
    const cube=this.cubeMatter;
    const transitionStep=dt*this.cubeTransitionTimeScale/CONFIG.EXPERIMENTS.cubeTransitionSeconds;
    if(this.state==='cube'){
      this.cubeTransition=Math.min(1,this.cubeTransition+transitionStep);
    }else if(this.cubeReverseActive){
      this.cubeTransition=Math.max(0,this.cubeTransition-transitionStep);
      if(this.cubeTransition<=0)this.cubeReverseActive=false;
    }else{
      this.cubeTransition=0;
    }
    const elapsed=this.cubeTransition*CONFIG.EXPERIMENTS.cubeTransitionSeconds;
    const holdEnd=CONFIG.EXPERIMENTS.cubeCoreGatherSeconds+CONFIG.EXPERIMENTS.cubeCoreHoldSeconds;
    const seedEnd=holdEnd+CONFIG.EXPERIMENTS.cubeSeedMorphSeconds;
    const seedOnlyEnd=seedEnd+CONFIG.EXPERIMENTS.cubeSeedOnlySeconds;
    const compression=THREE.MathUtils.smoothstep(
      elapsed,CONFIG.EXPERIMENTS.cubeCoreGatherSeconds*.45,holdEnd,
    );
    const seedMorph=THREE.MathUtils.smoothstep(elapsed,holdEnd,seedEnd);
    const expansion=THREE.MathUtils.smoothstep(
      elapsed,seedOnlyEnd,CONFIG.EXPERIMENTS.cubeTransitionSeconds,
    );
    if(this.cubeReverseActive){
      this.cubePhase=elapsed>seedOnlyEnd?'collapseCube'
        :elapsed>seedEnd?'reverseSeedOnly'
        :elapsed>holdEnd?'seedToKernel'
        :elapsed>CONFIG.EXPERIMENTS.cubeCoreGatherSeconds?'reverseKernelHold'
        :'releaseRibbons';
    }else{
      this.cubePhase=this.state!=='cube'?'inactive'
        :elapsed<CONFIG.EXPERIMENTS.cubeCoreGatherSeconds?'convergeToError'
        :elapsed<holdEnd?'kernelHold'
        :elapsed<seedEnd?'morphToSeed'
        :elapsed<seedOnlyEnd?'seedOnly'
        :this.cubeTransition<1?'expand':'idle';
    }
    this.cubeCompression=compression;
    this.cubeSeedMorph=seedMorph;
    this.cubeSeedComplete=this.cubePhase==='seedOnly'||this.cubePhase==='expand'||
      this.cubePhase==='idle'||this.cubePhase==='collapseCube'||
      this.cubePhase==='reverseSeedOnly';
    // Only the real seed instance joins the final frames of the topology
    // morph. All remaining instances wait for SEED_CUBE_COMPLETE.
    const cubeTopologyActive=this.state==='cube'||this.cubeReverseActive;
    const cubeTarget=cubeTopologyActive?THREE.MathUtils.smoothstep(seedMorph,.62,.98):0;
    const reverseSeedGuaranteed=this.cubePhase==='collapseCube'||this.cubePhase==='reverseSeedOnly';
    cube.presence=reverseSeedGuaranteed?1:damp(cube.presence,cubeTarget,dt,5.4);
    const period=CONFIG.EXPERIMENTS.cubeFragmentPeriod;
    const duration=CONFIG.EXPERIMENTS.cubeFragmentDuration;
    cube.glyphUniforms.uTime.value=time;
    cube.glyphUniforms.uVisibility.value=cube.presence;
    cube.glyphUniforms.uTransition.value=expansion;
    cube.glyphUniforms.uSeedMorph.value=seedMorph;
    cube.material.opacity=.76*cube.presence;
    cube.material.emissiveIntensity=.06+.11*cube.presence;
    // The isolated seed has separate geometry for a stable renderer handoff,
    // but must remain visually identical to an ordinary cube cell.
    cube.seedMaterial.opacity=cube.material.opacity;
    cube.seedMaterial.emissiveIntensity=cube.material.emissiveIntensity;
    // This is only the brief materialising seed. It is gone before the final
    // cube settles, so the internal light never reads as a leftover sphere.
    (cube.core.material as THREE.MeshBasicMaterial).opacity=0;
    cube.centerLight.intensity=(.35+1.8*THREE.MathUtils.smoothstep(expansion,.08,.78))
      *cube.presence*this.cubeAmberBrightness;
    let formedMass=0;
    for(let i=0;i<cube.centers.length;i++){
      const local=((time/period+cube.seeds[i])%1)*period;
      const rise=THREE.MathUtils.smoothstep(local,0,.28);
      const fall=1-THREE.MathUtils.smoothstep(local,duration-.3,duration);
      const living=THREE.MathUtils.smoothstep(expansion,.78,1);
      const active=(local<duration?rise*fall:0)*living;
      const formation=i===cube.seedIndex?seedMorph
        :THREE.MathUtils.smoothstep(expansion,cube.formationStarts[i],cube.formationStarts[i]+.22);
      formedMass+=formation;
      const center=cube.centers[i];
      this.cubeAxis.set(Math.sin(cube.seeds[i]*71.3),Math.cos(cube.seeds[i]*127.1),Math.sin(cube.seeds[i]*193.7)+.18).normalize();
      if(i===cube.seedIndex){
        // A 10x10x10 lattice has no mathematical centre cell. The seed is the
        // conserved transition matter, so it remains at the origin instead of
        // sliding into an off-centre lattice slot when expansion begins.
        this.cubePosition.set(0,0,0);
      }else{
        // The same conserved path works in both directions: cells grow out of
        // the central seed on entry and return to it on exit.
        this.cubePosition.copy(center).multiplyScalar(formation);
      }
      if(i!==cube.seedIndex){
        this.cubePosition.addScaledVector(this.cubeAxis,active*(.045+cube.seeds[i]*.11));
        this.cubePosition.x+=Math.sin(time*3.1+cube.seeds[i]*31.)*active*.018;
        this.cubePosition.y+=Math.cos(time*2.3+cube.seeds[i]*17.)*active*.018;
      }
      this.cubeRotation.setFromAxisAngle(this.cubeAxis,active*(.32+cube.seeds[i]*.8));
      // A cell condenses from a small, already-present local region rather
      // than all cells being scaled up together.
      const contraction=formation<=.001?0:(.03+.97*formation)*(1-active*.44);
      this.cubeScale.setScalar(contraction);
      this.cubeMatrix.compose(this.cubePosition,this.cubeRotation,this.cubeScale);
      cube.cells.setMatrixAt(i,this.cubeMatrix);
    }
    cube.formedMass=formedMass/cube.centers.length;
    // All old spherical matter has become the one seed before expansion.
    cube.matterRemaining=1-seedMorph;
    cube.cells.instanceMatrix.needsUpdate=true;
    // A low-frequency, non-repeating-looking field moves the final light only
    // through the inner six-cell volume. The source mesh above is hidden by
    // then; the location is perceived through illumination and gaps.
    const wander=THREE.MathUtils.smoothstep(expansion,.72,1);
    cube.centerLight.position.set(
      (Math.sin(time*.173+Math.sin(time*.041)*1.7)+Math.sin(time*.071+1.9)*.46)*.31*wander,
      (Math.cos(time*.139+Math.sin(time*.053)*1.2)+Math.sin(time*.097+.7)*.38)*.29*wander,
      (Math.sin(time*.113+2.3)+Math.cos(time*.061+time*.019)*.52)*.33*wander,
    );
    cube.violetLight.position.set(
      -.2+Math.sin(time*.067+.8)*.09*wander,
      .14+Math.cos(time*.059+1.7)*.08*wander,
      .06+Math.sin(time*.047+2.4)*.08*wander,
    );
    if(this.cubeReverseActive){
      // Preserve the cube's current natural orientation while its layers are
      // collected. This avoids introducing a transition-only unwind.
      cube.group.rotation.copy(this.frozenCubeRotation);
    }else{
      const idleRotation=THREE.MathUtils.smoothstep(expansion,.18,.82);
      // Rotation is integrated from dt. Never multiply absolute time or an
      // accumulated angle by transition progress: doing so turns an ordinary
      // reveal into an arbitrarily strong spin after the app has run awhile.
      cube.group.rotation.y+=dt*.075*idleRotation;
      cube.group.rotation.x=damp(cube.group.rotation.x,
        Math.sin(time*.19)*.08*idleRotation,dt,2.8);
      cube.group.rotation.z=damp(cube.group.rotation.z,0,dt,2.8);
    }
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
    u.uTerrainMorph.value=this.terrainTransition;
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
    const cubeTopologyActive=this.state==='cube'||this.cubeReverseActive;
    const cubeVioletPresence=cubeTopologyActive
      ?THREE.MathUtils.smoothstep(this.cubeTransition,.54,.94):0;
    this.cubeMatter.violetLight.intensity=debug.indirectLightSpill&&this.visualEntityDebug.cubeLight
      ?2.35*cubeVioletPresence*this.cubeVioletBrightness:0;
    this.cubeMatter.violetLight.visible=this.cubeMatter.violetLight.intensity>.001;
    this.coreAreaLights.forEach((light,index)=>{
      const cubeLightAllowed=this.state!=='cube'||this.visualEntityDebug.cubeLight;
      light.intensity=debug.indirectLightSpill&&cubeLightAllowed
        ?CONFIG.LIGHTING.spillIntensity*(.17+this.current.energy*.08)
          *(1-this.terrainPresence)*(1-cubeVioletPresence):0;
      light.visible=true;
      // Legacy Kernel emitters fade away completely as the dedicated internal
      // CUBE violet source takes over. They never move outside the cube.
      light.color.copy(this.coreAreaLightBaseColors[index]);
      light.position.copy(this.coreAreaLightBasePositions[index]);
      light.castShadow=debug.shadows&&debug.contactShadows;
    });
    this.ribbons.forEach(ribbon=>{
      ribbon.surface.position.copy(ribbon.mesh.position);
      ribbon.surface.visible=ribbon.uniforms.uVisibility.value>.01&&this.cubeMatter.presence<.997;
      const surfaceMaterial=ribbon.surface.material as THREE.MeshStandardMaterial;
      surfaceMaterial.opacity=CONFIG.LIGHTING.surfaceOpacity*(1-this.cubeMatter.presence)*(1-this.terrainPresence);
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
    this.updateCubeMatter(dt,time);
    const cubeTopologyActive=this.state==='cube'||this.cubeReverseActive;
    const terrainCanEnter=this.state==='terrain'&&!this.cubeReverseActive&&this.cubeTransition<=0;
    const terrainStep=dt*this.cubeTransitionTimeScale/CONFIG.EXPERIMENTS.terrainTransitionSeconds;
    this.terrainTransition=THREE.MathUtils.clamp(
      this.terrainTransition+(terrainCanEnter?terrainStep:-terrainStep),0,1,
    );
    const terrainTarget=THREE.MathUtils.smoothstep(this.terrainTransition,.08,.82);
    this.terrainPresence=damp(this.terrainPresence,terrainTarget,dt,8.5);
    this.terrainMatter.uniforms.uTime.value=time;
    this.terrainMatter.uniforms.uPresence.value=this.terrainPresence;
    this.terrainMatter.uniforms.uTopologyProgress.value=this.terrainTransition;
    this.terrainMatter.group.visible=this.terrainPresence>.002;
    // CALM and WORK are the same chaotic matter at different scales/speeds.
    // Keeping one representation removes the old sphere-over-chaos crossfade.
    this.workCoreChaos=damp(this.workCoreChaos,this.state==='work'?1:0,dt,2.8);
    this.workRibbonRelief=damp(this.workRibbonRelief,
      this.state==='work'&&this.workRibbonReliefEnabled?1:0,dt,3.2);
    this.livingChaosMix=damp(this.livingChaosMix,this.livingChaosEnabled?1:0,dt,4.2);
    const cubeGatherEnd=CONFIG.EXPERIMENTS.cubeCoreGatherSeconds/CONFIG.EXPERIMENTS.cubeTransitionSeconds;
    const cubeGather=cubeTopologyActive
      ?THREE.MathUtils.smoothstep(this.cubeTransition,0,cubeGatherEnd):0;
    // The familiar chaotic core remains the material reservoir until the
    // growing cell field has claimed it; it is not faded out at state entry.
    const cubeChaosReservoir=cubeTopologyActive
      ?this.cubeMatter.matterRemaining:0;
    const stableChaosTarget=this.state==='calm'||this.state==='work'?1:cubeChaosReservoir;
    this.stableChaosPresence=damp(this.stableChaosPresence,stableChaosTarget,dt,cubeTopologyActive?7.2:4.8);
    this.coreChaosSpeed=damp(this.coreChaosSpeed,this.state==='calm'?1/3:1,dt,3.6);
    const controlledChaosStep=dt*this.coreChaosSpeed*this.chaosSpeedControl;
    this.coreChaosTime+=controlledChaosStep;
    // Topology progress controls angular velocity, never the accumulated
    // angle. Entry therefore coasts to a stop; reverse exit resumes in the
    // same direction instead of rewinding or explosively catching up.
    const chaosTopologyVelocity=cubeTopologyActive?1-this.cubeCompression:1;
    this.chaosLayerTimes[0]+=controlledChaosStep*.82*chaosTopologyVelocity;
    this.chaosLayerTimes[1]+=controlledChaosStep*1.19*chaosTopologyVelocity;
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
    // Entering CUBE uses the same physical containment destination as the
    // final ERROR phase, then reorders that contained matter into a lattice.
    const topologyContainment=Math.max(containment,cubeGather);
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
    const coreScale=THREE.MathUtils.lerp(morphedCoreScale,fixedCoreScale,topologyContainment);
    this.core.scale.setScalar(coreScale);
    const coreVisibility=(1-this.stableChaosPresence)*(1-this.cubeMatter.presence);
    // Never let the legacy digit sphere re-emerge while the seed is forming.
    // Its previous visibility expression produced a short bell-shaped pulse
    // precisely as stable chaos handed ownership to the cube.
    const legacyKernelAllowed=!cubeTopologyActive||
      this.cubePhase==='convergeToError'||this.cubePhase==='kernelHold'||
      this.cubePhase==='reverseKernelHold'||this.cubePhase==='releaseRibbons';
    this.coreUniforms.uVisibility.value=legacyKernelAllowed?coreVisibility*(1-this.terrainPresence):0;
    const dynamicCoreX=Math.sin(time*.19)*.075+Math.sin(time*.071)*.025;
    const cubeCoreRotation=cubeTopologyActive?0:this.frozenCoreRotation.x;
    const cubeCoreYaw=cubeTopologyActive?0:this.frozenCoreRotation.y;
    const cubeCoreRoll=cubeTopologyActive?0:this.frozenCoreRotation.z;
    this.core.rotation.x=THREE.MathUtils.lerp(dynamicCoreX,cubeCoreRotation,topologyContainment);
    this.core.rotation.y=THREE.MathUtils.lerp(this.coreRotation,cubeCoreYaw,topologyContainment);
    this.core.rotation.z=THREE.MathUtils.lerp(0,cubeCoreRoll,topologyContainment);

    const legacyChaosComplete=this.cubeSeedComplete;
    // ERROR containment may still be decaying internally when CUBE is entered.
    // In CUBE, only conserved remaining matter is allowed to keep old chaos visible.
    const chaosIntensity=cubeTopologyActive
      ?(legacyChaosComplete?0:THREE.MathUtils.lerp(1,.72,this.cubeSeedMorph))
      :Math.max(containment,critical.coreOverload*.72,this.stableChaosPresence);
    this.containmentUniforms.forEach((uniforms,index)=>{
      uniforms.uTime.value=this.chaosLayerTimes[index];
      // The sphere's mass is removed only as individual cells complete.
      // The fragment shader turns this mass loss into clustered holes/streams.
      uniforms.uIntensity.value=chaosIntensity*(1-this.terrainPresence);
      uniforms.uSeed.value=this.errorSignals.seed+(index===0?.17:.73);
      uniforms.uLiving.value=this.livingChaosMix;
      uniforms.uMatterRemaining.value=cubeTopologyActive?this.cubeMatter.matterRemaining:1;
      uniforms.uConversion.value=cubeTopologyActive?this.cubeSeedMorph:0;
      uniforms.uCompression.value=cubeTopologyActive?this.cubeCompression:0;
      uniforms.uSeedMorph.value=cubeTopologyActive?this.cubeSeedMorph:0;
      uniforms.uTerrainMorph.value=this.terrainTransition;
      uniforms.uSeedCenter.value.set(0,0,0);
    });
    this.coreChaosUniforms.uTime.value=this.coreChaosTime;
    const faultDigits=cubeTopologyActive?0:Math.max(containment,critical.coreOverload*.72);
    // The outer free-particle layer is reserved for faults. CALM <-> WORK only
    // changes speed and scale, so no transient spherical shell can appear.
    this.coreChaosUniforms.uIntensity.value=cubeTopologyActive
      ?(legacyChaosComplete?0:1)
      :Math.max(faultDigits,this.stableChaosPresence);
    // The 640 legacy ERROR digits belong only to the gathered chaos reservoir.
    // Stop drawing them as soon as the topology morph starts; otherwise their
    // compressed spherical distribution briefly reads as a halo around the seed.
    const cubeBinaryReservoir=cubeTopologyActive&&(
      this.cubePhase==='convergeToError'||this.cubePhase==='kernelHold'||
      this.cubePhase==='reverseKernelHold'||this.cubePhase==='releaseRibbons'
    )?.82:0;
    this.coreChaosUniforms.uVisibility.value=Math.max(faultDigits,cubeBinaryReservoir)*(1-this.terrainPresence);
    this.coreChaosUniforms.uCompression.value=cubeTopologyActive?this.cubeCompression:0;
    this.coreChaosUniforms.uSeedMorph.value=cubeTopologyActive?this.cubeSeedMorph:0;
    this.coreChaosUniforms.uTerrainMorph.value=this.terrainTransition;
    this.coreChaosUniforms.uSeedCenter.value.set(0,0,0);
    // The remaining chaos compacts as actual mass leaves for stabilised cells;
    // holes are generated in its shader at the same time, avoiding a plain
    // opacity fade or a residual full-size sphere.
    this.containmentChaos.scale.setScalar(THREE.MathUtils.lerp(coreScale,1,this.cubeSeedMorph));
    this.containmentChaos.rotation.set(0,0,0);
    const outerChaos=this.containmentChaos.children[0];
    const innerChaos=this.containmentChaos.children[1];
    // Angles remain continuous across both directions. Their velocity was
    // already reduced above, so no transition may rescale accumulated angles.
    outerChaos.rotation.set(
      this.chaosLayerTimes[0]*.63,
      this.chaosLayerTimes[0]*-.91,
      this.chaosLayerTimes[0]*.47,
    );
    innerChaos.rotation.set(
      .7+this.chaosLayerTimes[1]*-1.08,
      .2+this.chaosLayerTimes[1]*.74,
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
      ribbon.orbitAngle+=dt*this.current.orbitSpeed*(.13+index*.025)*(index===1?-1:1)*localTempo*(1-topologyContainment);
      ribbon.selfPhase+=dt*this.current.selfRotation*(.88+index*.13)*localTempo*(1-topologyContainment);
      ribbon.gradientPhase+=dt*this.current.gradientSpeed*(.91+index*.08)*ribbonRate;
      ribbon.digitPhase+=dt*this.current.rewriteSpeed*(.9+index*.1)*ribbonRate;
      const desyncPhase=critical.timeDesync*localDamage*Math.sin(Math.floor((time+index*.17)*9.)*1.91);
      this.updateUniforms(ribbon.uniforms,time,this.organismWavePhase-ribbon.waveOffset+desyncPhase,
        ribbon.gradientPhase,ribbon.digitPhase,individuality);
      ribbon.uniforms.uMissingData.value*=localDamage;
      ribbon.uniforms.uGradientDamage.value*=localDamage;
      ribbon.uniforms.uGeometryDamage.value*=localDamage;
      const collapseBlend=rebuildingFromContainment?0:this.errorSignals.collapse;
      ribbon.uniforms.uVisibility.value=(1-collapseBlend*(index===1?0:.72))*(1-topologyContainment*.995)
        *(1-this.cubeMatter.presence)*(1-this.terrainPresence);
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
      particles.uEject.value=this.errorSignals.eject*localDamage;particles.uContainment.value=topologyContainment;
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
          THREE.MathUtils.lerp(collapsedX,dominant.baseRotation.x,topologyContainment),
          THREE.MathUtils.lerp(collapsedY,dominant.baseRotation.y,topologyContainment),
          THREE.MathUtils.lerp(collapsedZ,dominant.baseRotation.z,topologyContainment),
        );
      }
      const complexBreath=(Math.sin(time*.47+ribbon.phase)*.58+Math.sin(time*.197+ribbon.phase*1.37)*.29
        +Math.sin(time*.083+ribbon.phase*.61)*.13)*this.current.widthVariation*.14;
      const normalScale=1-this.current.contraction+complexBreath;
      const collapsedScale=dominantRadius/CONFIG.RIBBON_RADII[index];
      const activeScale=THREE.MathUtils.lerp(normalScale,collapsedScale,collapseBlend);
      const containedScale=CONFIG.CORE_RADIUS*fixedCoreScale*.92/CONFIG.RIBBON_RADII[index];
      const desiredScale=THREE.MathUtils.lerp(activeScale,containedScale,topologyContainment);
      ribbon.group.scale.setScalar(THREE.MathUtils.clamp(desiredScale,.08,maxSafeScale));
      ribbon.mesh.position.z=Math.sin(time*.31+ribbon.phase)*(.018+this.current.deformation*.09)*(1-topologyContainment);
      this.deformShadowSurface(ribbon);
      ribbon.ghosts.forEach(ghost=>{
        this.updateUniforms(ghost.uniforms,time-ghost.lag,
          this.organismWavePhase-ribbon.waveOffset+desyncPhase-ghost.lag*this.current.waveSpeed,
          ribbon.gradientPhase-ghost.lag*this.current.gradientSpeed,
          ribbon.digitPhase-ghost.lag*this.current.rewriteSpeed,individuality);
        const baseGhost=this.state==='work'?.34:this.state==='calm'?.24:0;
        const baseGhostAlpha=baseGhost*(ghost.lag<.1?1:.56);
        const damageGhostAlpha=critical.ghost*localDamage*(ghost.lag<.1?.28:.16);
        ghost.uniforms.uVisibility.value=Math.max(baseGhostAlpha,damageGhostAlpha)*(1-topologyContainment)
          *(1-this.cubeMatter.presence)*(1-this.terrainPresence);
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
    const cubeRootLock=cubeTopologyActive?cubeGather:containment;
    const rootTargetRotation=cubeTopologyActive?0:1;
    this.root.rotation.y=THREE.MathUtils.lerp(dynamicRootY,
      this.frozenRootRotation.y*rootTargetRotation,cubeRootLock);
    this.root.rotation.x=THREE.MathUtils.lerp(dynamicRootX,
      this.frozenRootRotation.x*rootTargetRotation,cubeRootLock);
    this.root.rotation.z=THREE.MathUtils.lerp(0,
      this.frozenRootRotation.z*rootTargetRotation,cubeRootLock);
    this.root.position.x=THREE.MathUtils.lerp(0,
      this.frozenRootPosition.x*rootTargetRotation,cubeRootLock);
    this.root.position.y=THREE.MathUtils.lerp(dynamicRootYPosition,
      this.frozenRootPosition.y*rootTargetRotation,cubeRootLock);
    this.root.position.z=THREE.MathUtils.lerp(0,
      this.frozenRootPosition.z*rootTargetRotation,cubeRootLock);
    this.updateLightRig();
    this.applyVisualOwnership();
    const terrainCamera=THREE.MathUtils.smoothstep(this.terrainPresence,.03,.96);
    this.camera.position.set(
      0,
      THREE.MathUtils.lerp(0,.48,terrainCamera),
      THREE.MathUtils.lerp(CONFIG.CAMERA_Z,4.35,terrainCamera),
    );
    this.camera.fov=THREE.MathUtils.lerp(34,42,terrainCamera);
    this.camera.updateProjectionMatrix();
    this.cameraTarget.set(0,THREE.MathUtils.lerp(0,-.08,terrainCamera),
      THREE.MathUtils.lerp(0,-.75,terrainCamera));
    this.camera.lookAt(this.cameraTarget);
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.renderer.dispose();}
}
