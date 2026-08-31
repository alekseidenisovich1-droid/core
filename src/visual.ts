import * as THREE from 'three';
import { CONFIG,STATE_TUNING,TRANSITION_TUNING,type StateTuning } from './config';
import {
  CriticalErrorDirector,type CriticalDamage,type CriticalSignals,
} from './critical-error-director';
import { ErrorDirector,type ErrorSignals } from './error-director';
import { getVisualState,type Snapshot,type VisualState } from './state';
import {
  TransitionInvariantMonitor,transitionInvariantViolations,
  type TransitionDebugSnapshot,type TransitionPrimitive,type TransitionTopology,
} from './transition-debug';
import { TransitionController } from './transition-controller';
import {
  resolveVisualOwnership,type VisualEntityKey,type VisualOwnershipSnapshot,
} from './visual-ownership';
export type { VisualEntityKey } from './visual-ownership';
import {
  CONTAINMENT_LOCK_EPSILON,CONTAINMENT_RELEASE_EPSILON,OWNERSHIP_EPSILON,
  TERRAIN_FORMATION_START,TERRAIN_PHASE_SPLIT,TERRAIN_SOURCE_COMPLETE,
  advanceNormalized,resolveCubeTimeline,terrainCompactFill,terrainMiniChaosRemaining,
  terrainSourceConsumption,
} from './transition-primitives';
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
  uCorePalette:{value:number};uPaletteActivity:{value:number};
  uMissingData:{value:number};uGradientDamage:{value:number};uGeometryDamage:{value:number};
  uDepthFade:{value:number};
  uRibbonAbsorption:{value:number};uRibbonAbsorptionAnchor:{value:number};
  uReliefActivity:{value:number};uWorkRelief:{value:number};uReliefRatio:{value:number};
};
type ParticleUniforms={
  uTime:{value:number};uIntensity:{value:number};uTear:{value:number};
  uCollapse:{value:number};uEject:{value:number};uContainment:{value:number};
  uErrorSeed:{value:number};uPixelRatio:{value:number};uTransitionWarm:{value:number};
};
type ContainmentUniforms={
  uTime:{value:number};uIntensity:{value:number};uSeed:{value:number};uLayer:{value:number};
  uLiving:{value:number};uMatterRemaining:{value:number};uConversion:{value:number};
  uCompression:{value:number};uSeedMorph:{value:number};uSeedCenter:{value:THREE.Vector3};
  uFillProgress:{value:number};uTerrainWarm:{value:number};uCorePalette:{value:number};uPaletteActivity:{value:number};
};
type CoreChaosUniforms={
  uTime:{value:number};uIntensity:{value:number};uVisibility:{value:number};uPixelRatio:{value:number};
  uCompression:{value:number};uSeedMorph:{value:number};uSeedCenter:{value:THREE.Vector3};
  uFillProgress:{value:number};uTransitionWarm:{value:number};
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
  centers:THREE.Vector3[];seeds:Float32Array;formationStarts:Float32Array;
  presence:number;matterRemaining:number;seedIndex:number;
};

export type TerrainParameterKey='amplitude'|'macroFrequency'|'macroSpeed'|'mediumStrength'
  |'mediumFrequency'|'waveDirectionCount'|'localEventFrequency'|'localEventRadius'
  |'localEventStrength'|'localEventLifetime'|'simulationDamping'|'propagationStrength'
  |'microDisplacement'|'pointDensity'
  |'edgeFadeStart'|'edgeFadeWidth'|'emission'|'warmWhiteIntensity'|'amberThreshold'
  |'redThreshold'|'aoStrength'|'bloomThreshold'|'bloomStrength'|'bloomRadius'
  |'exposure'|'fogAttenuation';
type TerrainParameters=Record<TerrainParameterKey,number>;
type TerrainMatter={
  group:THREE.Group;points:THREE.Points;material:THREE.ShaderMaterial;
  uniforms:Record<string,THREE.IUniform>;
  parameterUniforms:Record<TerrainParameterKey,{value:number}>;
};
const TERRAIN_DEFAULTS:TerrainParameters={
  amplitude:.8,macroFrequency:.24,macroSpeed:.1,mediumStrength:.23,mediumFrequency:1.08,
  waveDirectionCount:9,localEventFrequency:1.25,localEventRadius:1.2,localEventStrength:.64,
  localEventLifetime:3.8,simulationDamping:.92,propagationStrength:.52,microDisplacement:.022,
  pointDensity:.96,edgeFadeStart:.56,edgeFadeWidth:.4,
  emission:.88,warmWhiteIntensity:.92,amberThreshold:.82,redThreshold:.95,aoStrength:.62,
  bloomThreshold:.74,bloomStrength:.52,bloomRadius:.34,exposure:.94,fogAttenuation:.2,
};
const TERRAIN_LIMITS:Record<TerrainParameterKey,readonly[number,number]>={
  amplitude:[0,1.4],macroFrequency:[.04,.8],macroSpeed:[0,.4],mediumStrength:[0,.8],
  mediumFrequency:[.2,3],waveDirectionCount:[1,10],localEventFrequency:[.1,2.5],
  localEventRadius:[.2,2.8],localEventStrength:[0,1.4],localEventLifetime:[1,12],
  simulationDamping:[0,1],propagationStrength:[0,1.5],microDisplacement:[0,.18],
  pointDensity:[.15,1],
  edgeFadeStart:[.35,.95],edgeFadeWidth:[.05,.6],emission:[0,2],warmWhiteIntensity:[0,2],
  amberThreshold:[.2,.98],redThreshold:[.5,1],aoStrength:[0,1],bloomThreshold:[0,1],
  bloomStrength:[0,2],bloomRadius:[0,1],exposure:[.2,2],fogAttenuation:[0,1],
};

export type CubeTransitionPhase='inactive'|'convergeToError'|'kernelHold'|'morphToSeed'
  |'seedOnly'|'expand'|'idle'|'collapseCube'|'reverseSeedOnly'|'seedToKernel'
  |'reverseKernelHold'|'releaseRibbons';
export type TerrainTransitionPhase='inactive'|'convergeSource'|'sourceHold'
  |'releasePoints'|'propagate'|'idle'|'collapsePoints'|'compactPaletteHandoff'|'releaseTarget';
type LightingDebugKey='directLight'|'shadows'|'contactShadows'|'ambientOcclusion'|'emissive'
  |'indirectLightSpill'|'depthFade';
type LightingDebug=Record<LightingDebugKey,boolean>;

type CorePaletteState={mix:number;activity:number;surface:THREE.Color;emitterColors:readonly number[]};
const CORE_PALETTES:Record<VisualState,CorePaletteState>={
  calm:{mix:1,activity:.22,surface:new THREE.Color(0x100d17),emitterColors:[0x22162f,0x3b2458,0x1a1720,0x9d632b]},
  work:{mix:1,activity:.84,surface:new THREE.Color(0x15101c),emitterColors:[0x352047,0x5a3680,0x33221b,0xb87932]},
  error:{mix:0,activity:0,surface:new THREE.Color(0x21172b),emitterColors:[0xff4fa3,0xc65cff,0xff78bc,0x9b67ff]},
  critical:{mix:0,activity:0,surface:new THREE.Color(0x21172b),emitterColors:[0xff4fa3,0xc65cff,0xff78bc,0x9b67ff]},
  critical2:{mix:0,activity:0,surface:new THREE.Color(0x21172b),emitterColors:[0xff4fa3,0xc65cff,0xff78bc,0x9b67ff]},
  cube:{mix:0,activity:0,surface:new THREE.Color(0x21172b),emitterColors:[0xff4fa3,0xc65cff,0xff78bc,0x9b67ff]},
  terrain:{mix:0,activity:0,surface:new THREE.Color(0x21172b),emitterColors:[0xff4fa3,0xc65cff,0xff78bc,0x9b67ff]},
};

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
    uSaturation:{value:1},uCorePalette:{value:1},uPaletteActivity:{value:.22},
    uErrorStructure:{value:0},uMissingData:{value:0},uGradientDamage:{value:0},
    uGeometryDamage:{value:0},
    uDepthFade:{value:CONFIG.LIGHTING.depthFadeStrength},
    uRibbonAbsorption:{value:0},uRibbonAbsorptionAnchor:{value:offset},
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
  private coreAreaLightBasePositions:THREE.Vector3[]=[];
  private coreAreaPaletteColors:THREE.Color[]=[];
  private cubeMatter:CubeMatter;
  private cubeClock=0;
  private cubeMatrix=new THREE.Matrix4();
  private cubePosition=new THREE.Vector3();
  private cubeScale=new THREE.Vector3();
  private cubeAxis=new THREE.Vector3();
  private cubeRotation=new THREE.Quaternion();
  private cameraTarget=new THREE.Vector3();
  private terrainMatter:TerrainMatter;
  private terrainClock=0;
  private terrainPresence=0;
  private terrainTransition=0;
  private terrainConvergence=0;
  private terrainSourceConsumption=0;
  private chaosFillProgress=1;
  private chaosVisualPresence=1;
  private terrainChaosPaletteProgress=0;
  private terrainChaosStartScale=STATE_TUNING.work.coreScale;
  private terrainCompactScale=STATE_TUNING.work.coreScale*.5;
  private terrainPhase:TerrainTransitionPhase='inactive';
  private terrainEntrySource:'core'|'cube'|null=null;
  private terrainPhaseElapsed=0;
  // 0..1 controls the shared matter reorganisation, independently of the
  // final CUBE idle animation.  Every existing state enters through it.
  private cubeTransition=0;
  private cubeCompression=0;
  private cubeSeedMorph=0;
  private cubeExpansion=0;
  private cubeSeedComplete=false;
  private cubePhase:CubeTransitionPhase='inactive';
  private cubeReverseActive=false;
  private cubeTerrainHandoff=false;
  private frozenCubeRotation=new THREE.Euler();
  private cubeTransitionTimeScale:number=TRANSITION_TUNING.timeScaleDefault;
  private cubeAmberBrightness=1;
  private cubeVioletBrightness=1;
  private visualEntityDebug:Record<VisualEntityKey,boolean>={
    ribbons:true,ribbonShadows:true,ribbonGhosts:true,faultParticles:true,
    kernel:true,chaos:true,chaosDigits:true,seedCube:true,cubeCells:true,cubeGlyphs:true,
    cubeLight:true,terrain:true,
  };
  private lightingDebug:LightingDebug={
    directLight:true,shadows:true,contactShadows:true,ambientOcclusion:true,emissive:true,
    indirectLightSpill:true,depthFade:true,
  };
  private transitionController=new TransitionController('calm');
  // `state` is committed early so topology workers know their destination.
  // Appearance changes only at the primitive's ownership boundary.
  private appearanceState:VisualState='calm';
  // Palette is an appearance input with one writer. It follows the existing
  // appearance handoff, so no topology/transition owner is changed.
  private corePaletteMix=1;
  private corePaletteActivity=.22;
  private corePaletteSurface=new THREE.Color(0x100d17);
  private hovered=false;
  private current:StateTuning={...STATE_TUNING.calm};
  private errorStructure=0;
  private workCoreChaos=0;
  private stableChaosPresence=1;
  private coreChaosTime=0;
  private coreChaosSpeed=1/3;
  private chaosLayerTimes:[number,number]=[0,2.7];
  private chaosLayerTimeAdvancing=true;
  private chaosSpeedControl:number=CONFIG.EXPERIMENTS.chaosSpeedDefault;
  private livingChaosEnabled=true;
  private livingChaosMix=1;
  private workRibbonReliefEnabled:boolean=CONFIG.EXPERIMENTS.workRibbonRelief;
  private workRibbonReliefStrength=1;
  private workRibbonRelief=0;
  private organismWavePhase=0;
  // CORE -> CUBE is a containment transition, not a request to slow the
  // ribbons down to CUBE's idle tuning. Capture the source orbit once and
  // keep using it until the ribbons are fully inside compact CHAOS.
  private absorptionOrbitSpeed=STATE_TUNING.calm.orbitSpeed;
  private absorptionSelfRotation=STATE_TUNING.calm.selfRotation;
  private coreGradientPhase=.1;
  private coreDigitPhase=.3;
  private coreRotation=0;
  private containmentLatched=false;
  private frozenRootPosition=new THREE.Vector3();
  private orientationLocks={root:false,kernel:false,ribbons:false};
  private frozenTopologyRootQuaternion=new THREE.Quaternion();
  private frozenTopologyCoreQuaternion=new THREE.Quaternion();
  private frozenTopologyRibbonQuaternions:THREE.Quaternion[]=[];
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
  private transitionInvariantMonitor=new TransitionInvariantMonitor();

  private get state(){return this.transitionController.stableState;}

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
      this.coreAreaLights.push(light);
      this.coreAreaPaletteColors.push(new THREE.Color(CORE_PALETTES.calm.emitterColors[index]));
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
    this.frozenTopologyRibbonQuaternions=this.ribbons.map(
      ribbon=>ribbon.group.quaternion.clone(),
    );
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
        uFillProgress:{value:1},uTerrainWarm:{value:0},uCorePalette:{value:1},uPaletteActivity:{value:.22},
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
      uFillProgress:{value:1},uTransitionWarm:{value:0},
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
    const wasLeavingTerrain=this.state==='terrain'
      &&this.transitionController.requestedState!=='terrain';
    this.transitionController.request(next);
    // While TERRAIN collapses, the requested destination is remembered but is
    // not allowed to own tuning, directors or renderers yet. The active visual
    // state changes only after the inward front has delivered compact Chaos.
    if(this.state==='terrain'&&next!=='terrain'){
      this.cubeTerrainHandoff=false;
      if(this.terrainPhase!=='collapsePoints'){
        this.terrainPhase='collapsePoints';
        this.terrainPhaseElapsed=0;
        this.terrainEntrySource='core';
      }
      this.hovered=snapshot.hovered;
      return;
    }
    // A rapid return to 7 cancels an unfinished exit from its conserved
    // progress. No destination topology has been released at this point.
    if(this.state==='terrain'&&next==='terrain'&&wasLeavingTerrain){
      this.terrainPhase=this.terrainTransition<TERRAIN_PHASE_SPLIT?'releasePoints':'propagate';
      this.terrainEntrySource='core';
      this.terrainPhaseElapsed=0;
      this.hovered=snapshot.hovered;
      return;
    }
    if(next!==this.state){
      if(next==='terrain'&&this.state!=='terrain'){
        this.lockTransitionOrientations();
        this.terrainChaosStartScale=Math.max(.08,this.containmentChaos.scale.x);
        this.terrainCompactScale=STATE_TUNING.work.coreScale*.5;
        const wasContainedDestinationRelease=this.terrainPhase==='releaseTarget'
          &&this.terrainConvergence>.85;
        this.terrainEntrySource=this.state==='cube'?'cube':'core';
        this.terrainPhase='convergeSource';
        this.terrainPhaseElapsed=0;
        this.terrainTransition=0;
        this.terrainSourceConsumption=0;
        this.chaosFillProgress=0;
        const alreadyContained=(this.state==='error'&&this.errorSignals.containment>.85)
          ||wasContainedDestinationRelease;
        this.terrainConvergence=alreadyContained?1:0;
      }
      if(next==='cube'&&this.state!=='cube'){
        if(this.state!=='terrain'){
          this.absorptionOrbitSpeed=this.current.orbitSpeed;
          this.absorptionSelfRotation=this.current.selfRotation;
        }
        this.lockTransitionOrientations();
        this.cubeTerrainHandoff=false;
        if(this.cubeReverseActive){
          // A re-entry during the reverse transition resumes from the exact
          // conserved topology instead of restarting or popping.
          this.cubeReverseActive=false;
        }else{
          const alreadyPrepared=this.state==='error'&&this.errorSignals.containment>.85;
          this.cubeTransition=alreadyPrepared
            ?TRANSITION_TUNING.cube.coreGatherSeconds/TRANSITION_TUNING.cube.totalSeconds:0;
        }
      }else if(this.state==='cube'&&next!=='cube'){
        this.cubeTerrainHandoff=false;
        this.cubeReverseActive=this.cubeTransition>0;
        this.frozenCubeRotation.copy(this.cubeMatter.group.rotation);
      }
      this.commitStableState(next);
    }
    this.hovered=snapshot.hovered;
    if(this.state===next&&this.cubePhase==='inactive'&&this.terrainPhase==='inactive'){
      this.transitionController.complete();
    }
  }

  private commitStableState(next:VisualState){
    this.transitionController.commitStableState(next);
    this.errorDirector.setActive(next==='error');
    const criticalActive=next==='critical'||next==='critical2';
    this.criticalDirector.setContainmentEnding(next==='critical');
    this.criticalDirector.setActive(criticalActive);
  }

  private lockTransitionOrientations(){
    if(this.orientationLocks.root&&this.orientationLocks.kernel&&this.orientationLocks.ribbons)return;
    this.orientationLocks.root=true;
    this.orientationLocks.kernel=true;
    this.orientationLocks.ribbons=true;
    this.frozenTopologyRootQuaternion.copy(this.root.quaternion);
    this.frozenTopologyCoreQuaternion.copy(this.core.quaternion);
    this.ribbons.forEach((ribbon,index)=>{
      this.frozenTopologyRibbonQuaternions[index].copy(ribbon.group.quaternion);
    });
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
  getTerrainTransitionPhase(){return this.terrainPhase;}
  private syncTransitionDescriptor(){
    const cubeActive=(this.cubePhase!=='inactive'&&this.cubePhase!=='idle')
      ||this.cubeReverseActive||(this.cubeTransition>0&&this.cubeTransition<1);
    const terrainActive=this.terrainPhase!=='inactive'&&this.terrainPhase!=='idle';
    let primitive:TransitionPrimitive='none';
    let sourceTopology:TransitionTopology=this.state==='cube'?'cube':this.state==='terrain'?'terrain':'core';
    let targetTopology:TransitionTopology=sourceTopology;
    let progress=0;
    let phase:string=terrainActive?this.terrainPhase:this.cubePhase;
    let interruption:'reversible'|'finish-to-handoff'='finish-to-handoff';
    if(this.terrainPhase==='convergeSource'||this.terrainPhase==='sourceHold'){
      const cubeIsReturningToCompact=this.terrainEntrySource==='cube'
        &&(this.cubePhase==='seedToKernel'||this.cubePhase==='reverseKernelHold');
      primitive=cubeIsReturningToCompact?'seed-to-compact'
        :this.terrainEntrySource==='cube'?'collapse-cube-to-seed':'absorb-core-to-compact';
      sourceTopology=cubeIsReturningToCompact?'seed':this.terrainEntrySource==='cube'?'cube':'core';
      targetTopology='compact';
      progress=cubeIsReturningToCompact?1-this.cubeSeedMorph:this.terrainConvergence;
    }else if(this.terrainPhase==='releasePoints'||this.terrainPhase==='propagate'){
      primitive='release-compact-to-terrain';sourceTopology='compact';targetTopology='terrain';
      progress=this.terrainTransition;interruption='reversible';
    }else if(this.terrainPhase==='collapsePoints'||this.terrainPhase==='compactPaletteHandoff'){
      primitive='collapse-terrain-to-compact';sourceTopology='terrain';targetTopology='compact';
      progress=1-this.terrainTransition;interruption='reversible';
    }else if(this.terrainPhase==='releaseTarget'){
      primitive='release-compact-to-core';sourceTopology='compact';targetTopology='core';
      progress=1-this.terrainConvergence;
    }else if(cubeActive){
      const reverse=this.cubeReverseActive;
      const reverseTarget:TransitionTopology=
        this.transitionController.requestedState==='terrain'?'compact':'core';
      phase=this.cubePhase==='inactive'?'morphToSeed':this.cubePhase;
      if(reverse){
        if(this.cubePhase==='collapseCube'||this.cubePhase==='reverseSeedOnly'){
          primitive='collapse-cube-to-seed';sourceTopology='cube';targetTopology='seed';
          progress=1-this.cubeExpansion;
        }else if(this.cubePhase==='seedToKernel'){
          primitive='seed-to-compact';sourceTopology='seed';targetTopology='compact';
          progress=1-this.cubeSeedMorph;
        }else{
          primitive='release-compact-to-core';sourceTopology='compact';targetTopology=reverseTarget;
          progress=1-this.cubeCompression;
        }
      }else if(this.cubePhase==='convergeToError'||this.cubePhase==='kernelHold'){
        primitive='absorb-core-to-compact';sourceTopology='core';targetTopology='compact';
        progress=this.cubeCompression;
      }else if(this.cubePhase==='morphToSeed'||this.cubePhase==='inactive'){
        primitive='compact-to-seed';sourceTopology='compact';targetTopology='seed';
        progress=this.cubeSeedMorph;
      }else{
        primitive='expand-seed-to-cube';sourceTopology='seed';targetTopology='cube';
        progress=this.cubeExpansion;
      }
      interruption='reversible';
    }else{
      const errorStatus=this.errorDirector.getStatus();
      const criticalStatus=this.criticalDirector.getStatus();
      const recoveryActivity=Math.max(
        errorStatus.recovering?errorStatus.activity:0,
        criticalStatus.recovering?criticalStatus.activity:0,
      );
      if(recoveryActivity>OWNERSHIP_EPSILON){
        this.transitionController.describe(
          'settle-core-state','directorRecovery',1-recoveryActivity,'core','core','reversible',
        );
      }else{
        if(this.state!=='error')this.errorDirector.stopImmediately();
        if(this.state!=='critical'&&this.state!=='critical2'){
          this.criticalDirector.stopImmediately();
        }
        this.transitionController.complete();
      }
      return;
    }
    this.transitionController.describe(
      primitive,phase,progress,sourceTopology,targetTopology,interruption,
    );
  }

  getTransitionDebug():Readonly<TransitionDebugSnapshot>{
    const pixelContributors:string[]=[];
    if(this.terrainMatter.group.visible&&this.terrainPresence>OWNERSHIP_EPSILON)pixelContributors.push('Terrain points');
    if(this.ribbons.some(ribbon=>ribbon.group.visible&&ribbon.uniforms.uVisibility.value>.01)){
      pixelContributors.push('Möbius ribbons');
    }
    if(this.core.visible&&this.coreUniforms.uVisibility.value>.01)pixelContributors.push('Kernel');
    if(this.containmentChaos.visible&&this.chaosVisualPresence>.01){
      pixelContributors.push('Chaos shells');
    }
    if(this.containmentChaos.visible&&this.coreChaosUniforms.uVisibility.value>.01){
      pixelContributors.push('Disco Ball digits');
    }
    if(this.cubeMatter.group.visible&&(this.cubeMatter.cells.visible||this.cubeMatter.seedCell.visible)){
      pixelContributors.push(this.cubeMatter.seedCell.visible?'Seed Cube':'Cube cells');
    }
    const active=this.transitionController.activeTransition;
    const transitionActive=active!==null;
    const primitive=active?.primitive??'none';
    const sourceTopology=active?.sourceTopology
      ??(this.state==='cube'?'cube':this.state==='terrain'?'terrain':'core');
    const targetTopology=active?.targetTopology??sourceTopology;
    const progress=active?.progress??0;
    const ownership={core:0,compact:0,seed:0,cube:0,terrain:0};
    if(!active){ownership[sourceTopology]=1;}
    else if(primitive==='settle-core-state'){ownership.core=1;}
    else if(primitive==='absorb-core-to-compact'){
      ownership.core=1-progress;ownership.compact=progress;
    }else if(primitive==='release-compact-to-core'){
      ownership.compact=1-progress;ownership.core=progress;
    }else if(primitive==='compact-to-seed'){
      ownership.compact=1-progress;ownership.seed=progress;
    }else if(primitive==='seed-to-compact'){
      ownership.seed=1-progress;ownership.compact=progress;
    }else if(primitive==='expand-seed-to-cube'){
      ownership.seed=1-progress;ownership.cube=progress;
    }else if(primitive==='collapse-cube-to-seed'){
      ownership.cube=1-progress;ownership.seed=progress;
    }else if(primitive==='release-compact-to-terrain'){
      ownership.compact=1-progress;ownership.terrain=progress;
    }else if(primitive==='collapse-terrain-to-compact'){
      ownership.terrain=1-progress;ownership.compact=progress;
    }
    const matterOwners=Object.entries(ownership).filter(([,weight])=>weight>OWNERSHIP_EPSILON).map(([owner])=>owner);
    const errorStatus=this.errorDirector.getStatus();
    const criticalStatus=this.criticalDirector.getStatus();
    const activeDirectors=[
      errorStatus.requested?'error':errorStatus.recovering?'error-recovery':null,
      criticalStatus.requested?'critical':criticalStatus.recovering?'critical-recovery':null,
    ].filter((value):value is string=>value!==null);
    const base={
      finalState:this.state,requestedState:this.transitionController.requestedState,transitionActive,primitive,
      phase:active?.phase??(this.state==='terrain'?this.terrainPhase:this.cubePhase),
      progress,sourceTopology,targetTopology,
      matterOwners,ownership,
      orientationLocked:this.orientationLocks.root||this.orientationLocks.kernel
        ||this.orientationLocks.ribbons,
      chaosClocksEnabled:this.chaosLayerTimeAdvancing,activeDirectors,pixelContributors,
    };
    return{...base,invariantViolations:transitionInvariantViolations(base)};
  }

  setCubeAmberBrightness(value:number){
    this.cubeAmberBrightness=THREE.MathUtils.clamp(value,0,2);
  }

  setCubeVioletBrightness(value:number){
    this.cubeVioletBrightness=THREE.MathUtils.clamp(value,0,2);
  }

  private getVisualOwnership():VisualOwnershipSnapshot{
    return resolveVisualOwnership({
      state:this.state,cubePhase:this.cubePhase,terrainPhase:this.terrainPhase,
      terrainEntrySource:this.terrainEntrySource,
      terrainSourceConsumption:this.terrainSourceConsumption,
      terrainPresence:this.terrainPresence,terrainConvergence:this.terrainConvergence,
      chaosPresence:this.chaosVisualPresence,cubePresence:this.cubeMatter.presence,
      debug:this.visualEntityDebug,
    });
  }

  private applyVisualOwnership(owned:VisualOwnershipSnapshot){
    const showRibbons=owned.ribbons.visible;
    this.ribbons.forEach(ribbon=>{
      ribbon.group.visible=showRibbons;
      ribbon.surface.visible=owned.ribbonShadows.visible
        &&ribbon.uniforms.uVisibility.value>.01&&this.cubeMatter.presence<.997
        &&ribbon.uniforms.uRibbonAbsorption.value<TERRAIN_SOURCE_COMPLETE;
      ribbon.ghosts.forEach(ghost=>{ghost.group.visible=owned.ribbonGhosts.visible;});
      ribbon.particles.visible=owned.faultParticles.visible;
    });
    this.core.visible=owned.kernel.visible;
    this.containmentChaos.visible=owned.chaos.visible;
    this.containmentChaos.children[2].visible=owned.chaosDigits.visible;
    const showSeed=owned.seedCube.visible;
    const showCells=owned.cubeCells.visible;
    this.cubeMatter.group.scale.setScalar(1);
    this.cubeMatter.group.visible=showSeed||showCells||owned.cubeLight.visible;
    this.cubeMatter.cells.visible=showCells;
    this.cubeMatter.seedCell.visible=showSeed;
    this.cubeMatter.glyphs.visible=owned.cubeGlyphs.visible;
    this.cubeMatter.centerLight.visible=owned.cubeLight.visible;
    this.cubeMatter.violetLight.visible=owned.cubeLight.visible;
    this.terrainMatter.group.visible=owned.terrain.visible;
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
        uPixelRatio:{value:Math.min(devicePixelRatio,2)},uTransitionWarm:{value:0},
      };
    const material=new THREE.ShaderMaterial({
      uniforms:particleUniforms,vertexShader:particleVertexShader,fragmentShader:particleFragmentShader,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    const particles=new THREE.Points(geometry,material);particles.frustumCulled=false;particles.renderOrder=8;
    return{particles,particleUniforms};
  }

  /**
   * Persistent point samples of a GPU height field. There is no carrier plane,
   * glyph quad or texture: every vertex is one microscopic piece of TERRAIN.
   */
  private createTerrainMatter():TerrainMatter{
    const columns=CONFIG.EXPERIMENTS.terrainColumns,rows=CONFIG.EXPERIMENTS.terrainRows;
    const count=columns*rows;
    const geometry=new THREE.BufferGeometry();
    const positions=new Float32Array(count*3),grid=new Float32Array(count*2);
    const seeds=new Float32Array(count),formationDelays=new Float32Array(count);
    let point=0;
    for(let z=0;z<rows;z++)for(let x=0;x<columns;x++,point++){
      const px=(x/(columns-1)-.5)*CONFIG.EXPERIMENTS.terrainWidth;
      const pz=(z/(rows-1)-.5)*CONFIG.EXPERIMENTS.terrainDepth;
      const seed=Math.abs(Math.sin((point+1)*91.731+x*17.13+z*7.91)*43758.5453)%1;
      const normalizedX=px/(CONFIG.EXPERIMENTS.terrainWidth*.5);
      const normalizedZ=pz/(CONFIG.EXPERIMENTS.terrainDepth*.5);
      const fieldDistance=Math.hypot(normalizedX,normalizedZ*1.34);
      const arrivalDistortion=Math.sin(px*.31+pz*.19)*.034
        +Math.sin(px*.13-pz*.37+1.7)*.022;
      positions[point*3]=px;positions[point*3+2]=pz;
      grid[point*2]=px;grid[point*2+1]=pz;seeds[point]=seed;
      // Stable low-frequency arrival distortion keeps one coherent anisotropic
      // ownership front without turning persistent samples into projectiles.
      formationDelays[point]=THREE.MathUtils.clamp(
        fieldDistance*.82+arrivalDistortion+(seed-.5)*.024
          +px/CONFIG.EXPERIMENTS.terrainWidth*.035,0,.9,
      );
    }
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aGrid',new THREE.BufferAttribute(grid,2));
    geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
    geometry.setAttribute('aFormationDelay',new THREE.BufferAttribute(formationDelays,1));
    geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),10.5);

    const parameterUniforms=Object.fromEntries(
      (Object.keys(TERRAIN_DEFAULTS) as TerrainParameterKey[]).map(key=>[key,{value:TERRAIN_DEFAULTS[key]}]),
    ) as Record<TerrainParameterKey,{value:number}>;
    const uniforms:Record<string,THREE.IUniform>={
      uTime:{value:0},uPresence:{value:0},uTopologyProgress:{value:0},
      uFormationDirection:{value:0},uTransitionWarm:{value:0},
      uPixelRatio:{value:this.renderer.getPixelRatio()},
      uTerrainHalfSize:{value:new THREE.Vector2(
        CONFIG.EXPERIMENTS.terrainWidth*.5,CONFIG.EXPERIMENTS.terrainDepth*.5,
      )},
      uAmplitude:parameterUniforms.amplitude,uMacroFrequency:parameterUniforms.macroFrequency,
      uMacroSpeed:parameterUniforms.macroSpeed,uMediumStrength:parameterUniforms.mediumStrength,
      uMediumFrequency:parameterUniforms.mediumFrequency,uWaveDirectionCount:parameterUniforms.waveDirectionCount,
      uLocalEventFrequency:parameterUniforms.localEventFrequency,uLocalEventRadius:parameterUniforms.localEventRadius,
      uLocalEventStrength:parameterUniforms.localEventStrength,uLocalEventLifetime:parameterUniforms.localEventLifetime,
      uSimulationDamping:parameterUniforms.simulationDamping,uPropagationStrength:parameterUniforms.propagationStrength,
      uMicroDisplacement:parameterUniforms.microDisplacement,uPointDensity:parameterUniforms.pointDensity,
      uEdgeFadeStart:parameterUniforms.edgeFadeStart,uEdgeFadeWidth:parameterUniforms.edgeFadeWidth,
      uEmission:parameterUniforms.emission,uWarmWhiteIntensity:parameterUniforms.warmWhiteIntensity,
      uAmberThreshold:parameterUniforms.amberThreshold,uRedThreshold:parameterUniforms.redThreshold,
      uAoStrength:parameterUniforms.aoStrength,uBloomThreshold:parameterUniforms.bloomThreshold,
      uBloomStrength:parameterUniforms.bloomStrength,uBloomRadius:parameterUniforms.bloomRadius,
      uExposure:parameterUniforms.exposure,uFogAttenuation:parameterUniforms.fogAttenuation,
    };
    const material=new THREE.ShaderMaterial({
      uniforms,vertexShader:terrainVertexShader,fragmentShader:terrainFragmentShader,
      transparent:true,depthWrite:false,depthTest:true,blending:THREE.NormalBlending,
    });
    const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.renderOrder=18;
    const group=new THREE.Group();group.add(points);group.visible=false;
    // TERRAIN stays horizontal in world space. Perspective comes from the
    // state camera, not from rotating the field into an isometric view.
    group.rotation.set(0,0,0);group.position.set(.08,-.28,.45);
    return{group,points,material,uniforms,parameterUniforms};
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
    const centerLight=new THREE.PointLight(0xff9b4a,0,3.6,2);
    // Permanent cube-owned violet energy. This is a real internal light, not
    // a leftover Kernel layer and not an exterior fill source.
    const violetLight=new THREE.PointLight(0xb765ff,0,3.6,2);
    violetLight.position.set(-.2,.14,.06);
    centerLight.castShadow=false;violetLight.castShadow=false;
    const group=new THREE.Group();group.visible=false;
    group.add(cells,seedCellMesh,glyphs,centerLight,violetLight);
    return{group,cells,seedCell:seedCellMesh,seedMaterial,material,glyphs,glyphUniforms,centerLight,violetLight,centers,seeds,formationStarts,
      presence:0,matterRemaining:1,seedIndex:seedCell};
  }

  private updateCubeMatter(dt:number,time:number){
    const cube=this.cubeMatter;
    const progressCommand=this.transitionController.cubeProgressCommand(
      this.cubeReverseActive,this.terrainPhase,
    );
    if(progressCommand==='forward'){
      this.cubeTransition=advanceNormalized(
        this.cubeTransition,dt*this.cubeTransitionTimeScale,
        TRANSITION_TUNING.cube.totalSeconds,1,
      );
    }else if(progressCommand==='reverse'){
      const compactReady=(TRANSITION_TUNING.cube.coreGatherSeconds
        +TRANSITION_TUNING.cube.coreHoldSeconds)/TRANSITION_TUNING.cube.totalSeconds;
      const reverseFloor=this.transitionController.cubeReverseFloor(compactReady);
      this.cubeTransition=Math.max(reverseFloor,advanceNormalized(
        this.cubeTransition,dt*this.cubeTransitionTimeScale,
        TRANSITION_TUNING.cube.totalSeconds,-1,
      ));
      if(this.cubeTransition<=reverseFloor+.0001){
        if(this.transitionController.requestedState==='terrain'){
          // Terrain observes and consumes the compact source from its own
          // worker, keeping the typed 6 -> 7 handoff frame-accurate.
        }else{
          this.transitionController.publishHandoff({kind:'cube-compact-to-core'});
        }
      }
    }else if(progressCommand==='reset'){
      this.cubeTransition=0;
    }
    const {seedMorph,expansion}=this.syncCubePhaseFromProgress();
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
    cube.centerLight.intensity=(.35+1.8*THREE.MathUtils.smoothstep(expansion,.08,.78))
      *cube.presence*this.cubeAmberBrightness;
    for(let i=0;i<cube.centers.length;i++){
      const local=((time/period+cube.seeds[i])%1)*period;
      const rise=THREE.MathUtils.smoothstep(local,0,.28);
      const fall=1-THREE.MathUtils.smoothstep(local,duration-.3,duration);
      const living=THREE.MathUtils.smoothstep(expansion,.78,1);
      const active=(local<duration?rise*fall:0)*living;
      const formation=i===cube.seedIndex?seedMorph
        :THREE.MathUtils.smoothstep(expansion,cube.formationStarts[i],cube.formationStarts[i]+.22);
      const center=cube.centers[i];
      this.cubeAxis.set(Math.sin(cube.seeds[i]*71.3),Math.cos(cube.seeds[i]*127.1),Math.sin(cube.seeds[i]*193.7)+.18).normalize();
      if(i===cube.seedIndex){
        // An even-axis lattice has no mathematical centre cell. The seed is the
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
      const contraction=formation<=.001?0:(.03+.97*formation)*(1-active*.44);
      this.cubeScale.setScalar(contraction);
      this.cubeMatrix.compose(this.cubePosition,this.cubeRotation,this.cubeScale);
      cube.cells.setMatrixAt(i,this.cubeMatrix);
    }
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
    }else if(this.cubePhase==='expand'||this.cubePhase==='idle'){
      // Rotation is already alive during the late formation field. Its
      // velocity reaches the idle value continuously, so CUBE never reads as
      // a static finished object that wakes up on the next frame.
      const motion=THREE.MathUtils.smoothstep(expansion,.55,.94);
      cube.group.rotation.y+=dt*.075*motion;
      cube.group.rotation.x=damp(cube.group.rotation.x,Math.sin(time*.19)*.08,dt,2.8);
      cube.group.rotation.z=damp(cube.group.rotation.z,0,dt,2.8);
    }
  }

  private syncCubePhaseFromProgress(){
    const timeline=resolveCubeTimeline(this.cubeTransition,{
      total:TRANSITION_TUNING.cube.totalSeconds,
      gather:TRANSITION_TUNING.cube.coreGatherSeconds,
      hold:TRANSITION_TUNING.cube.coreHoldSeconds,
      seedMorph:TRANSITION_TUNING.cube.seedMorphSeconds,
      seedOnly:TRANSITION_TUNING.cube.seedOnlySeconds,
    });
    const {elapsed,holdEnd,seedEnd,seedOnlyEnd,compression,seedMorph,expansion}=timeline;
    if(this.cubeTerrainHandoff&&seedMorph>=.999)this.cubeTerrainHandoff=false;
    if(this.cubeReverseActive){
      this.cubePhase=elapsed>seedOnlyEnd?'collapseCube'
        :elapsed>seedEnd?'reverseSeedOnly'
        :elapsed>holdEnd?'seedToKernel'
        :elapsed>TRANSITION_TUNING.cube.coreGatherSeconds?'reverseKernelHold'
        :'releaseRibbons';
    }else{
      this.cubePhase=this.state!=='cube'?'inactive'
        :elapsed<TRANSITION_TUNING.cube.coreGatherSeconds?'convergeToError'
        :elapsed<holdEnd?'kernelHold'
        :elapsed<seedEnd?'morphToSeed'
        :elapsed<seedOnlyEnd?'seedOnly'
        :this.cubeTransition<1?'expand':'idle';
    }
    this.cubeCompression=compression;
    this.cubeSeedMorph=seedMorph;
    this.cubeExpansion=expansion;
    this.cubeSeedComplete=this.cubePhase==='seedOnly'||this.cubePhase==='expand'||
      this.cubePhase==='idle'||this.cubePhase==='collapseCube'||
      this.cubePhase==='reverseSeedOnly';
    return timeline;
  }

  private updateTerrainTransition(dt:number){
    const scaledDt=dt*this.cubeTransitionTimeScale;
    const gatherDuration=TRANSITION_TUNING.terrain.coreGatherSeconds;
    const holdDuration=TRANSITION_TUNING.terrain.sourceHoldSeconds;
    const propagationDuration=TRANSITION_TUNING.terrain.formationSeconds;
    const compactReady=(TRANSITION_TUNING.cube.coreGatherSeconds
      +TRANSITION_TUNING.cube.coreHoldSeconds)/TRANSITION_TUNING.cube.totalSeconds;

    this.terrainChaosPaletteProgress=0;

    if(this.terrainPhase==='collapsePoints'){
      this.terrainTransition=advanceNormalized(
        this.terrainTransition,scaledDt,propagationDuration,-1,
      );
      this.terrainConvergence=1;
      this.terrainSourceConsumption=terrainSourceConsumption(this.terrainTransition);
      // The inward front condenses directly into the same two-shell CHAOS.
      // A separate point ball read as an unexplained yellow object, so it no
      // longer receives visual ownership during the handoff.
      const compactChaosFill=terrainCompactFill(this.terrainTransition);
      this.chaosFillProgress=compactChaosFill;
      this.chaosVisualPresence=compactChaosFill;
      if(this.terrainTransition<=0){
        this.terrainTransition=0;this.terrainSourceConsumption=0;
        this.chaosFillProgress=1;this.chaosVisualPresence=1;
        this.terrainPhase='compactPaletteHandoff';this.terrainPhaseElapsed=0;
      }
    }else if(this.terrainPhase==='compactPaletteHandoff'){
      this.terrainConvergence=1;
      this.terrainPhaseElapsed+=scaledDt;
      this.terrainChaosPaletteProgress=THREE.MathUtils.smoothstep(
        this.terrainPhaseElapsed,0,TRANSITION_TUNING.terrain.paletteHandoffSeconds,
      );
      this.chaosFillProgress=1;
      this.chaosVisualPresence=1;
      if(this.terrainPhaseElapsed>=TRANSITION_TUNING.terrain.paletteHandoffSeconds){
        const requested=this.transitionController.requestedState;
        const destination=requested==='terrain'?null:requested;
        this.terrainChaosPaletteProgress=1;
        this.chaosFillProgress=1;this.chaosVisualPresence=1;
        if(destination==='cube'){
          // The cube-sized warm CHAOS turns directly into the accepted seed.
          // Starting at morphToSeed avoids an unrelated Kernel/disco sphere.
          const cubeProgress=(TRANSITION_TUNING.cube.coreGatherSeconds
            +TRANSITION_TUNING.cube.coreHoldSeconds)
            /TRANSITION_TUNING.cube.totalSeconds;
          this.transitionController.publishHandoff({kind:'compact-to-cube',cubeProgress});
          this.terrainConvergence=0;this.terrainPhase='inactive';
          this.terrainEntrySource=null;
        }else if(destination){
          this.transitionController.publishHandoff({kind:'compact-to-core',target:destination});
          this.terrainPhase='releaseTarget';this.terrainPhaseElapsed=0;
        }
      }
    }else if(this.terrainPhase==='releaseTarget'){
      this.chaosFillProgress=1;this.chaosVisualPresence=1;
      this.terrainPhaseElapsed+=scaledDt;
      this.terrainConvergence=1-THREE.MathUtils.smoothstep(
        this.terrainPhaseElapsed,0,TRANSITION_TUNING.terrain.targetReleaseSeconds,
      );
      if(this.terrainConvergence<=0){
        this.terrainConvergence=0;this.terrainPhase='inactive';
        this.terrainEntrySource=null;
      }
    }else if(this.state==='terrain'){
      if(this.terrainPhase==='convergeSource'){
        if(this.terrainEntrySource==='cube'){
          // updateCubeMatter owns the reversible CUBE -> SEED -> COMPACT
          // path. Terrain accepts the typed handoff only once actual CHAOS
          // owns the matter; a seed is never a universal Terrain source.
          this.terrainConvergence=1;
          if(this.cubeTransition<=compactReady+.0001){
            this.transitionController.publishHandoff({kind:'cube-compact-ready'});
          }
        }else{
          this.terrainPhaseElapsed+=scaledDt;
          this.terrainConvergence=THREE.MathUtils.smoothstep(
            this.terrainPhaseElapsed,0,gatherDuration,
          );
          if(this.terrainPhaseElapsed>=gatherDuration){
            this.terrainConvergence=1;
            this.terrainPhase='sourceHold';this.terrainPhaseElapsed=0;
          }
        }
        if(this.terrainEntrySource==='cube'){
          this.chaosFillProgress=0;this.chaosVisualPresence=0;
        }else{
          this.chaosFillProgress=THREE.MathUtils.smoothstep(
            this.terrainConvergence,.34,.96,
          );
          // The two CHAOS shells are conserved matter during absorption. Their
          // scale/fill changes, but their presence never dips between CORE and
          // Mini CHAOS ownership; otherwise 2 -> 7 reads as a brief vanish.
          this.chaosVisualPresence=1;
        }
      }else if(this.terrainPhase==='sourceHold'){
        this.terrainConvergence=1;
        const usesCompactChaos=this.terrainEntrySource!=='cube';
        this.chaosFillProgress=usesCompactChaos?1:0;
        this.chaosVisualPresence=usesCompactChaos?1:0;
        this.terrainPhaseElapsed+=scaledDt;
        if(this.terrainPhaseElapsed>=holdDuration){
          this.terrainPhase='releasePoints';this.terrainPhaseElapsed=0;
        }
      }else if(this.terrainPhase==='releasePoints'||this.terrainPhase==='propagate'){
        this.terrainTransition=advanceNormalized(
          this.terrainTransition,scaledDt,propagationDuration,1,
        );
        this.terrainConvergence=1;
        this.terrainSourceConsumption=terrainSourceConsumption(this.terrainTransition);
        const usesCompactChaos=this.terrainEntrySource!=='cube';
        this.chaosFillProgress=usesCompactChaos
          ?terrainMiniChaosRemaining(this.terrainTransition):0;
        this.chaosVisualPresence=usesCompactChaos?this.chaosFillProgress:0;
        this.terrainPhase=this.terrainTransition<TERRAIN_PHASE_SPLIT?'releasePoints':'propagate';
        if(this.terrainTransition>=1){
          this.terrainTransition=1;this.terrainSourceConsumption=1;
          this.chaosFillProgress=0;this.chaosVisualPresence=0;
          this.terrainChaosPaletteProgress=0;
          this.terrainPhase='idle';this.terrainEntrySource=null;
        }
      }else if(this.terrainPhase==='idle'){
        this.terrainTransition=1;this.terrainConvergence=1;
        this.terrainSourceConsumption=1;
        this.chaosFillProgress=0;this.chaosVisualPresence=0;
        this.terrainChaosPaletteProgress=0;
      }
    }

    const terrainTarget=THREE.MathUtils.smoothstep(this.terrainTransition,TERRAIN_FORMATION_START,.2);
    this.terrainPresence=damp(this.terrainPresence,terrainTarget,dt,9.5);
    this.terrainMatter.uniforms.uPresence.value=this.terrainPresence;
    this.terrainMatter.uniforms.uTopologyProgress.value=this.terrainTransition;
    this.terrainMatter.uniforms.uFormationDirection.value=this.terrainPhase==='releasePoints'
      ||this.terrainPhase==='propagate'?1:this.terrainPhase==='collapsePoints'?-1:0;
    this.terrainMatter.uniforms.uTransitionWarm.value=Math.abs(
      this.terrainMatter.uniforms.uFormationDirection.value as number,
    );
  }

  private applyTransitionHandoff(){
    const handoff=this.transitionController.consumeHandoff();
    if(!handoff)return;
    if(handoff.kind==='compact-to-cube'){
      this.commitStableState('cube');
      this.cubeTerrainHandoff=true;
      this.cubeTransition=handoff.cubeProgress;
      // The handoff happens after this frame's Cube worker. Synchronize the
      // entire Cube snapshot now so ownership cannot render one frame as CORE.
      this.syncCubePhaseFromProgress();
      return;
    }
    if(handoff.kind==='compact-to-core'){
      this.commitStableState(handoff.target);
      return;
    }
    if(handoff.kind==='cube-compact-ready'){
      this.cubeReverseActive=false;
      this.cubeTransition=0;
      this.cubePhase='inactive';
      this.terrainEntrySource='core';
      this.terrainCompactScale=this.getCubeCompactScale();
      this.terrainPhase='sourceHold';
      this.terrainPhaseElapsed=0;
      this.chaosFillProgress=1;
      this.chaosVisualPresence=1;
      return;
    }
    if(handoff.kind==='cube-compact-to-core'){
      // Reuse the exact Terrain -> CORE release primitive: compact mini-CHAOS
      // stays visible while the three Möbius ribbons unfold section by section.
      this.cubeReverseActive=false;
      this.cubeTransition=0;
      this.cubePhase='inactive';
      this.terrainEntrySource='core';
      this.terrainCompactScale=STATE_TUNING.work.coreScale*.5;
      this.terrainConvergence=1;
      this.terrainPhase='releaseTarget';
      this.terrainPhaseElapsed=0;
      this.chaosFillProgress=1;
      this.chaosVisualPresence=1;
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
    if(this.terrainMatter)this.terrainMatter.uniforms.uPixelRatio.value=this.renderer.getPixelRatio();
  }

  private blendState(dt:number){
    const target=STATE_TUNING[this.appearanceState];
    for(const key of Object.keys(target) as (keyof StateTuning)[]){
      const rate=key==='glitch'?CONFIG.GLITCH_TRANSITION_SPEED:CONFIG.STATE_TRANSITION_SPEED;
      this.current[key]=damp(this.current[key],target[key],dt,rate);
    }
  }

  private syncAppearanceState(){
    const active=this.transitionController.activeTransition;
    if(!active){
      this.appearanceState=this.state;
      return;
    }
    // Source tuning remains with source matter through absorption/collapse.
    // Destination tuning starts only while that destination is being released
    // or formed, so the stable loop inherits an already-live phase.
    switch(active.primitive){
      case'expand-seed-to-cube':
      case'compact-to-seed':
      case'release-compact-to-core':
      case'release-compact-to-terrain':
        this.appearanceState=active.requestedState;
        break;
      default:
        this.appearanceState=active.sourceState;
    }
  }

  private updateCorePalette(dt:number){
    const target=CORE_PALETTES[this.appearanceState];
    this.corePaletteMix=damp(this.corePaletteMix,target.mix,dt,2.4);
    this.corePaletteActivity=damp(this.corePaletteActivity,target.activity,dt,2.4);
    this.corePaletteSurface.lerp(target.surface,1-Math.exp(-dt*2.4));
    this.coreAreaPaletteColors.forEach((color,index)=>{
      color.lerp(new THREE.Color(target.emitterColors[index]),1-Math.exp(-dt*2.4));
    });
  }

  private getCubeCompactScale(){
    return CONFIG.EXPERIMENTS.cubeCellSize/(CONFIG.CORE_RADIUS*.74*2);
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
    u.uCorePalette.value=this.corePaletteMix;
    u.uPaletteActivity.value=this.corePaletteActivity;
    u.uReliefActivity.value=this.workRibbonReliefStrength;u.uWorkRelief.value=this.workRibbonRelief;
    u.uRgbSplit.value=this.state==='error'?THREE.MathUtils.clamp(
      this.errorSignals.distortion*.55+this.errorSignals.tear*.9
      +this.errorSignals.collapse*.45+this.errorSignals.eject*.72,0,1):0;
  }

  private updateLightRig(ownership:VisualOwnershipSnapshot){
    const debug=this.lightingDebug;
    this.keyLight.intensity=debug.directLight?CONFIG.LIGHTING.keyIntensity:0;
    this.keyLight.castShadow=debug.shadows&&debug.contactShadows;
    this.ambientLight.intensity=debug.ambientOcclusion?CONFIG.LIGHTING.ambientIntensity:0;
    this.fillLight.intensity=debug.directLight?CONFIG.LIGHTING.fillIntensity:0;
    const cubeTopologyActive=ownership.cubeCells.lifecycle!=='inactive'
      ||ownership.seedCube.lifecycle!=='inactive';
    const cubeVioletPresence=cubeTopologyActive
      ?THREE.MathUtils.smoothstep(this.cubeTransition,.54,.94):0;
    this.cubeMatter.violetLight.intensity=debug.indirectLightSpill&&this.visualEntityDebug.cubeLight
      ?2.35*cubeVioletPresence*this.cubeVioletBrightness:0;
    this.coreAreaLights.forEach((light,index)=>{
      const cubeLightAllowed=ownership.cubeLight.lifecycle==='inactive';
      light.intensity=debug.indirectLightSpill&&cubeLightAllowed
        ?CONFIG.LIGHTING.spillIntensity*(.17+this.current.energy*.08)
          *(1-this.terrainSourceConsumption)*(1-cubeVioletPresence):0;
      // Legacy Kernel emitters fade away completely as the dedicated internal
      // CUBE violet source takes over. They never move outside the cube.
      light.color.copy(this.coreAreaPaletteColors[index]);
      light.position.copy(this.coreAreaLightBasePositions[index]);
      light.castShadow=debug.shadows&&debug.contactShadows;
    });
    this.ribbons.forEach(ribbon=>{
      ribbon.surface.position.copy(ribbon.mesh.position);
      const surfaceMaterial=ribbon.surface.material as THREE.MeshStandardMaterial;
      surfaceMaterial.color.copy(this.corePaletteSurface);
      surfaceMaterial.emissive.copy(this.corePaletteSurface).multiplyScalar(.72);
      surfaceMaterial.opacity=CONFIG.LIGHTING.surfaceOpacity*(1-this.cubeMatter.presence);
      surfaceMaterial.emissiveIntensity=debug.emissive
        ?CONFIG.LIGHTING.ribbonEmission*(.62+this.current.energy*.28):0;
    });
  }

  private updateCameraRig(ownership:VisualOwnershipSnapshot){
    const terrainCamera=THREE.MathUtils.smoothstep(
      ownership.terrain.matterWeight,.03,.96,
    );
    this.camera.position.set(
      0,
      THREE.MathUtils.lerp(0,.18,terrainCamera),
      THREE.MathUtils.lerp(CONFIG.CAMERA_Z,4.55,terrainCamera),
    );
    this.camera.fov=THREE.MathUtils.lerp(34,39,terrainCamera);
    this.camera.updateProjectionMatrix();
    this.cameraTarget.set(0,THREE.MathUtils.lerp(0,-.18,terrainCamera),
      THREE.MathUtils.lerp(0,-3.3,terrainCamera));
    this.camera.lookAt(this.cameraTarget);
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
      const surfaceU=uvs.getX(i);
      const p=i*3,theta=surfaceU*Math.PI*2,c=Math.cos(theta),s=Math.sin(theta);
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
      const arc=Math.abs((((surfaceU-u.uRibbonAbsorptionAnchor.value+.5)%1)+1)%1-.5)*2;
      const front=u.uRibbonAbsorption.value*1.16-.08;
      const absorption=u.uRibbonAbsorption.value<=.001?0
        :1-THREE.MathUtils.smoothstep(arc,front-.105,front+.105);
      const suctionScale=THREE.MathUtils.lerp(1,.055,absorption);
      const displacedX=ribbon.radius*c+x+c*radial+normals.getX(i)*livingRelief;
      const displacedY=ribbon.radius*s+y+s*radial+normals.getY(i)*livingRelief;
      const displacedZ=z+u.uDeformation.value*Math.sin(theta*2-u.uTime.value*.21+u.uOffset.value*9.)*(.45+u.uEnergy.value*.85)
        +wave*u.uWaveAmplitude.value*Math.max(0,(u.uEnergy.value-.62)/.38)*1.35
        +normals.getZ(i)*livingRelief;
      positions.setXYZ(i,displacedX*suctionScale,displacedY*suctionScale,displacedZ*suctionScale);
    }
    positions.needsUpdate=true;
  }

  update(dt:number,time:number){
    const requested=this.transitionController.requestedState;
    const cubeClockEnabled=this.state==='cube'||requested==='cube'||this.cubeReverseActive;
    const terrainClockEnabled=this.state==='terrain'||requested==='terrain'
      ||this.terrainPhase!=='inactive';
    if(cubeClockEnabled)this.cubeClock+=dt;
    if(terrainClockEnabled)this.terrainClock+=dt;
    this.updateCubeMatter(dt,this.cubeClock);
    this.updateTerrainTransition(dt);
    this.applyTransitionHandoff();
    this.syncTransitionDescriptor();
    this.syncAppearanceState();
    this.updateCorePalette(dt);
    this.blendState(dt);
    const cubeTopologyActive=this.state==='cube'||this.cubeReverseActive;
    const ownership=this.getVisualOwnership();
    this.terrainMatter.uniforms.uTime.value=this.terrainClock;
    // CALM and WORK are the same chaotic matter at different scales/speeds.
    // Keeping one representation removes the old sphere-over-chaos crossfade.
    this.workCoreChaos=damp(this.workCoreChaos,this.state==='work'?1:0,dt,2.8);
    this.workRibbonRelief=damp(this.workRibbonRelief,
      this.state==='work'&&this.workRibbonReliefEnabled?1:0,dt,3.2);
    this.livingChaosMix=damp(this.livingChaosMix,this.livingChaosEnabled?1:0,dt,4.2);
    const cubeGatherEnd=TRANSITION_TUNING.cube.coreGatherSeconds/TRANSITION_TUNING.cube.totalSeconds;
    const cubeGather=cubeTopologyActive
      ?THREE.MathUtils.smoothstep(this.cubeTransition,0,cubeGatherEnd):0;
    // Cube topology may lock the root and Kernel, but the ribbons keep their
    // own natural orbit while their visible length enters or leaves CHAOS.
    // The quaternion captured below follows that trajectory, preventing the
    // old release-end snap back to the orientation frozen at transition start.
    const activeTransition=this.transitionController.activeTransition;
    const ribbonTransitionMotionAllowed=activeTransition?.primitive==='absorb-core-to-compact'
      ||activeTransition?.primitive==='release-compact-to-core'
      ||(this.cubeReverseActive&&activeTransition?.targetTopology==='core');
    const ribbonOrbitClockEnabled=(ownership.ribbons.animate||ribbonTransitionMotionAllowed)
      &&(!this.orientationLocks.ribbons||ribbonTransitionMotionAllowed);
    const preserveAbsorptionOrbit=activeTransition?.primitive==='absorb-core-to-compact';
    const ribbonOrbitSpeed=preserveAbsorptionOrbit
      ?this.absorptionOrbitSpeed:this.current.orbitSpeed;
    const ribbonSelfRotation=preserveAbsorptionOrbit
      ?this.absorptionSelfRotation:this.current.selfRotation;
    // The familiar chaotic core remains the material reservoir until the
    // growing cell field has claimed it; it is not faded out at state entry.
    const cubeChaosReservoir=cubeTopologyActive
      ?this.cubeMatter.matterRemaining:0;
    // Route state becomes TERRAIN at request time, but during 2 -> 7 the
    // existing two shells still own the source matter. Keep their energy until
    // Terrain begins intentionally consuming compact CHAOS; otherwise the
    // shells geometrically converge while their shader intensity fades to 0.
    const terrainRetainsChaos=this.terrainPhase==='convergeSource'
      ||this.terrainPhase==='sourceHold'||this.terrainPhase==='releasePoints'
      ||this.terrainPhase==='propagate';
    const stableChaosTarget=this.state==='calm'||this.state==='work'||terrainRetainsChaos
      ?1:cubeChaosReservoir;
    this.stableChaosPresence=damp(this.stableChaosPresence,stableChaosTarget,dt,cubeTopologyActive?7.2:4.8);
    this.coreChaosSpeed=damp(this.coreChaosSpeed,this.state==='calm'?1/3:1,dt,3.6);
    const controlledChaosStep=dt*this.coreChaosSpeed*this.chaosSpeedControl;
    if(ownership.chaos.animate)this.coreChaosTime+=controlledChaosStep;
    // Topology progress controls angular velocity, never the accumulated
    // angle. Entry therefore coasts to a stop; reverse exit resumes in the
    // same direction instead of rewinding or explosively catching up.
    // Orientation safety and internal Chaos life are separate concerns. A
    // topology lock freezes root/Kernel/ribbon quaternions, but living Chaos
    // must already be advancing when CALM/WORK/ERROR/CRITICAL owns it. CUBE
    // compression remains the only transition that deliberately slows the
    // shell clocks as their matter becomes a seed.
    const chaosTopologyVelocity=cubeTopologyActive
      ?1-this.cubeCompression:(ownership.chaos.animate?1:0);
    this.chaosLayerTimeAdvancing=chaosTopologyVelocity>.0001;
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
    // CUBE and TERRAIN share the same compact containment destination, while
    // retaining independent phase controllers after that canonical source.
    const legacyTopologyContainment=Math.max(containment,cubeGather);
    const topologyContainment=Math.max(legacyTopologyContainment,this.terrainConvergence);
    const terrainRibbonAbsorption=this.terrainPhase==='inactive'?0:this.terrainConvergence;
    const cubeRibbonAbsorption=this.cubeReverseActive
      ?1-this.cubeCompression
      :cubeTopologyActive?this.cubeCompression:0;
    const ribbonAbsorption=Math.max(terrainRibbonAbsorption,cubeRibbonAbsorption);
    const anyOrientationLocked=this.orientationLocks.root||this.orientationLocks.kernel
      ||this.orientationLocks.ribbons;
    if(topologyContainment>CONTAINMENT_LOCK_EPSILON&&!anyOrientationLocked){
      this.lockTransitionOrientations();
    }else if(topologyContainment<CONTAINMENT_RELEASE_EPSILON&&anyOrientationLocked){
      this.orientationLocks.root=false;
      this.orientationLocks.kernel=false;
      this.orientationLocks.ribbons=false;
    }
    const rebuildingFromContainment=containment>OWNERSHIP_EPSILON&&(
      this.state==='calm'||this.state==='work'||this.state==='critical2'||critical.previewMode>0
    );
    if(containment>CONTAINMENT_LOCK_EPSILON&&!this.containmentLatched){
      this.containmentLatched=true;
      this.frozenRootPosition.copy(this.root.position);
    }else if(containment<CONTAINMENT_RELEASE_EPSILON&&this.containmentLatched){
      this.containmentLatched=false;
    }
    const brokenTempo=THREE.MathUtils.clamp(1+this.errorSignals.jerk*(.55+this.errorSignals.distortion*.65),.18,2.15);
    this.organismWavePhase+=dt*this.current.waveSpeed*brokenTempo;
    this.coreGradientPhase+=dt*(this.current.gradientSpeed*(1-containment)+containment*.28);
    this.coreDigitPhase+=dt*(this.current.rewriteSpeed*(1-containment)+containment*4.2);
    if(ownership.kernel.animate&&!this.orientationLocks.kernel){
      this.coreRotation+=dt*(.035+this.current.orbitSpeed*.07)*(1-containment);
    }
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
      this.cubePhase==='convergeToError'||this.cubePhase==='releaseRibbons';
    const cubeKernelReleaseGate=this.cubePhase==='releaseRibbons'
      ?THREE.MathUtils.smoothstep(1-cubeGather,.62,.96):1;
    const terrainKernelOwnership=this.terrainPhase==='convergeSource'
      ?0
      :this.terrainPhase==='releaseTarget'
        ?THREE.MathUtils.smoothstep(1-this.terrainConvergence,.72,.98)
      :this.terrainPhase==='sourceHold'||this.terrainPhase==='releasePoints'
        ||this.terrainPhase==='propagate'||this.terrainPhase==='collapsePoints'
        ||this.terrainPhase==='compactPaletteHandoff'?0:1;
    this.coreUniforms.uVisibility.value=legacyKernelAllowed
      ?coreVisibility*(1-this.terrainSourceConsumption)*terrainKernelOwnership
        *cubeKernelReleaseGate:0;
    if(this.orientationLocks.kernel){
      this.core.quaternion.copy(this.frozenTopologyCoreQuaternion);
    }else{
      const dynamicCoreX=Math.sin(time*.19)*.075+Math.sin(time*.071)*.025;
      this.core.rotation.set(dynamicCoreX,this.coreRotation,0);
    }

    const legacyChaosComplete=this.cubeSeedComplete;
    // ERROR containment may still be decaying internally when CUBE is entered.
    // In CUBE, only conserved remaining matter is allowed to keep old chaos visible.
    const chaosIntensity=cubeTopologyActive
      ?(legacyChaosComplete?0:THREE.MathUtils.lerp(1,.72,this.cubeSeedMorph))
      :Math.max(containment,critical.coreOverload*.72,this.stableChaosPresence);
    const terrainChaosControlled=this.terrainPhase!=='inactive';
    const effectiveChaosPresence=terrainChaosControlled?this.chaosVisualPresence:1;
    const effectiveChaosIntensity=terrainChaosControlled
      ?Math.max(chaosIntensity,this.chaosFillProgress):chaosIntensity;
    const terrainChaosWarm=this.terrainPhase==='convergeSource'
      ?THREE.MathUtils.smoothstep(this.chaosFillProgress,.58,1)
      :this.terrainPhase==='sourceHold'?1
        :this.terrainPhase==='releasePoints'||this.terrainPhase==='propagate'
          ?this.chaosFillProgress
          :this.terrainPhase==='collapsePoints'?1
            :this.terrainPhase==='compactPaletteHandoff'
              ?this.transitionController.requestedState==='cube'?1:1-this.terrainChaosPaletteProgress
              :this.cubeTerrainHandoff?1-this.cubeSeedMorph:0;
    this.containmentUniforms.forEach((uniforms,index)=>{
      uniforms.uTime.value=this.chaosLayerTimes[index];
      // The sphere's mass is removed only as individual cells complete.
      // The fragment shader turns this mass loss into clustered holes/streams.
      uniforms.uIntensity.value=effectiveChaosIntensity*effectiveChaosPresence;
      uniforms.uSeed.value=this.errorSignals.seed+(index===0?.17:.73);
      uniforms.uLiving.value=this.livingChaosMix;
      uniforms.uMatterRemaining.value=cubeTopologyActive?this.cubeMatter.matterRemaining:1;
      uniforms.uConversion.value=cubeTopologyActive?this.cubeSeedMorph:0;
      uniforms.uCompression.value=cubeTopologyActive?this.cubeCompression:0;
      uniforms.uSeedMorph.value=cubeTopologyActive?this.cubeSeedMorph:0;
      uniforms.uFillProgress.value=effectiveChaosPresence;
      uniforms.uTerrainWarm.value=terrainChaosWarm;
      uniforms.uCorePalette.value=this.corePaletteMix;
      uniforms.uPaletteActivity.value=this.corePaletteActivity;
      uniforms.uSeedCenter.value.set(0,0,0);
    });
    this.coreChaosUniforms.uTime.value=this.coreChaosTime;
    const terrainFaultGate=this.terrainPhase==='inactive'?1
      :this.terrainPhase==='convergeSource'||this.terrainPhase==='releaseTarget'
        ?1-this.terrainConvergence:0;
    const faultDigits=cubeTopologyActive?0
      :Math.max(containment,critical.coreOverload*.72)*terrainFaultGate;
    // The outer free-particle layer is reserved for faults. CALM <-> WORK only
    // changes speed and scale, so no transient spherical shell can appear.
    this.coreChaosUniforms.uIntensity.value=cubeTopologyActive
      ?(legacyChaosComplete?0:1)
      :Math.max(faultDigits,this.stableChaosPresence);
    // The 640 legacy ERROR digits belong only to the gathered chaos reservoir.
    // Stop drawing them as soon as the topology morph starts; otherwise their
    // compressed spherical distribution briefly reads as a halo around the seed.
    // The 640 binary points are part of the DISCO BALL, not CHAOS. They may
    // belong to an ERROR final state, but never to a Cube/Terrain handoff.
    this.coreChaosUniforms.uVisibility.value=faultDigits*effectiveChaosPresence;
    this.coreChaosUniforms.uCompression.value=cubeTopologyActive?this.cubeCompression:0;
    this.coreChaosUniforms.uSeedMorph.value=cubeTopologyActive?this.cubeSeedMorph:0;
    this.coreChaosUniforms.uFillProgress.value=terrainChaosControlled?this.chaosFillProgress:1;
    this.coreChaosUniforms.uTransitionWarm.value=terrainChaosWarm;
    this.coreChaosUniforms.uSeedCenter.value.set(0,0,0);
    // The remaining chaos compacts as actual mass leaves for stabilised cells;
    // holes are generated in its shader at the same time, avoiding a plain
    // opacity fade or a residual full-size sphere.
    const baseChaosScale=THREE.MathUtils.lerp(coreScale,1,this.cubeSeedMorph);
    const miniChaosScale=STATE_TUNING.work.coreScale*.5;
    const cubeSizedChaosScale=this.getCubeCompactScale();
    let resolvedChaosScale=baseChaosScale;
    if(this.terrainPhase==='convergeSource'&&this.terrainEntrySource!=='cube'){
      resolvedChaosScale=THREE.MathUtils.lerp(
        this.terrainChaosStartScale,this.terrainCompactScale,this.terrainConvergence,
      );
    }else if(this.terrainPhase==='sourceHold'&&this.terrainEntrySource!=='cube'){
      resolvedChaosScale=this.terrainCompactScale;
    }else if((this.terrainPhase==='releasePoints'||this.terrainPhase==='propagate')
      &&this.terrainEntrySource!=='cube'){
      // As field ownership spreads, the warm source is consumed and can only
      // become smaller. It is no longer coupled to terrain.coreScale.
      resolvedChaosScale=this.terrainCompactScale*THREE.MathUtils.lerp(
        1,.16,this.terrainSourceConsumption,
      );
    }else if(this.terrainPhase==='collapsePoints'||this.terrainPhase==='compactPaletteHandoff'){
      const compactTarget=this.transitionController.requestedState==='cube'
        ?cubeSizedChaosScale:miniChaosScale;
      const materialisation=THREE.MathUtils.smoothstep(this.chaosVisualPresence,0,1);
      resolvedChaosScale=compactTarget*THREE.MathUtils.lerp(.55,1,materialisation);
    }else if(this.terrainPhase==='releaseTarget'){
      resolvedChaosScale=THREE.MathUtils.lerp(
        baseChaosScale,miniChaosScale,this.terrainConvergence,
      );
    }else if(this.cubeTerrainHandoff){
      resolvedChaosScale=THREE.MathUtils.lerp(
        cubeSizedChaosScale,1,this.cubeSeedMorph,
      );
    }
    this.containmentChaos.scale.setScalar(resolvedChaosScale);
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
      if(ribbonOrbitClockEnabled){
        ribbon.orbitAngle+=dt*ribbonOrbitSpeed*(.13+index*.025)*(index===1?-1:1)*localTempo;
        ribbon.selfPhase+=dt*ribbonSelfRotation*(.88+index*.13)*localTempo;
      }
      ribbon.gradientPhase+=dt*this.current.gradientSpeed*(.91+index*.08)*ribbonRate;
      ribbon.digitPhase+=dt*this.current.rewriteSpeed*(.9+index*.1)*ribbonRate;
      const desyncPhase=critical.timeDesync*localDamage*Math.sin(Math.floor((time+index*.17)*9.)*1.91);
      this.updateUniforms(ribbon.uniforms,time,this.organismWavePhase-ribbon.waveOffset+desyncPhase,
        ribbon.gradientPhase,ribbon.digitPhase,individuality);
      ribbon.uniforms.uMissingData.value*=localDamage;
      ribbon.uniforms.uGradientDamage.value*=localDamage;
      ribbon.uniforms.uGeometryDamage.value*=localDamage;
      const collapseBlend=rebuildingFromContainment?0:this.errorSignals.collapse;
      ribbon.uniforms.uRibbonAbsorption.value=ribbonAbsorption;
      ribbon.uniforms.uRibbonAbsorptionAnchor.value=(.08+index*.317)%1;
      ribbon.uniforms.uVisibility.value=(1-collapseBlend*(index===1?0:.72))
        *(1-legacyTopologyContainment*.995)*(1-this.cubeMatter.presence);
      const particles=ribbon.particleUniforms;
      const phaseParticleIntensity=Math.max(
        phaseError.distortion,phaseError.tear,phaseError.collapse,phaseError.eject,
      );
      const criticalParticleIntensity=Math.max(
        critical.missingData,critical.binaryEjection,critical.binaryAttraction,
        critical.coreAbsorption,critical.coreOverload*.55,
      );
      const terrainParticleGate=this.terrainPhase==='inactive'?1
        :this.terrainPhase==='convergeSource'||this.terrainPhase==='releaseTarget'
          ?1-this.terrainConvergence:0;
      particles.uTime.value=time;
      particles.uIntensity.value=Math.max(phaseParticleIntensity,criticalParticleIntensity)
        *terrainParticleGate;
      particles.uTear.value=this.errorSignals.tear*localDamage;
      particles.uCollapse.value=Math.max(this.errorSignals.collapse,critical.binaryAttraction*localDamage);
      particles.uEject.value=this.errorSignals.eject*localDamage;
      particles.uContainment.value=legacyTopologyContainment*terrainParticleGate;
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
      if(this.orientationLocks.ribbons&&!ribbonTransitionMotionAllowed){
        ribbon.group.quaternion.copy(this.frozenTopologyRibbonQuaternions[index]);
      }else if(rebuildingFromContainment){
        // Reorient while the ribbon is still hidden in the core, then reveal it
        // already on its CALM/WORK orbit instead of visibly unwinding outward.
        ribbon.group.rotation.set(regularX,regularY,regularZ);
      }else{
        ribbon.group.rotation.set(collapsedX,collapsedY,collapsedZ);
      }
      if(ribbonTransitionMotionAllowed){
        // Record the live orbital quaternion every frame. Releasing a ribbon
        // must reveal this exact trajectory, never blend it back toward the
        // quaternion frozen at Cube entry.
        this.frozenTopologyRibbonQuaternions[index].copy(ribbon.group.quaternion);
      }
      const complexBreath=(Math.sin(time*.47+ribbon.phase)*.58+Math.sin(time*.197+ribbon.phase*1.37)*.29
        +Math.sin(time*.083+ribbon.phase*.61)*.13)*this.current.widthVariation*.14;
      const normalScale=1-this.current.contraction+complexBreath;
      const collapsedScale=dominantRadius/CONFIG.RIBBON_RADII[index];
      const activeScale=THREE.MathUtils.lerp(normalScale,collapsedScale,collapseBlend);
      const containedScale=CONFIG.CORE_RADIUS*fixedCoreScale*.92/CONFIG.RIBBON_RADII[index];
      const desiredScale=THREE.MathUtils.lerp(activeScale,containedScale,legacyTopologyContainment);
      ribbon.group.scale.setScalar(THREE.MathUtils.clamp(desiredScale,.08,maxSafeScale));
      ribbon.mesh.position.z=Math.sin(time*.31+ribbon.phase)*(.018+this.current.deformation*.09)*(1-topologyContainment);
      this.deformShadowSurface(ribbon);
      ribbon.ghosts.forEach(ghost=>{
        this.updateUniforms(ghost.uniforms,time-ghost.lag,
          this.organismWavePhase-ribbon.waveOffset+desyncPhase-ghost.lag*this.current.waveSpeed,
          ribbon.gradientPhase-ghost.lag*this.current.gradientSpeed,
          ribbon.digitPhase-ghost.lag*this.current.rewriteSpeed,individuality);
        ghost.uniforms.uRibbonAbsorption.value=ribbonAbsorption;
        ghost.uniforms.uRibbonAbsorptionAnchor.value=(.08+index*.317)%1;
        const baseGhost=this.state==='work'?.34:this.state==='calm'?.24:0;
        const baseGhostAlpha=baseGhost*(ghost.lag<.1?1:.56);
        const damageGhostAlpha=critical.ghost*localDamage*(ghost.lag<.1?.28:.16);
        ghost.uniforms.uVisibility.value=Math.max(baseGhostAlpha,damageGhostAlpha)
          *(1-legacyTopologyContainment)*(1-this.cubeMatter.presence);
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
    const rootPositionTarget=cubeTopologyActive?0:1;
    if(this.orientationLocks.root){
      this.root.quaternion.copy(this.frozenTopologyRootQuaternion);
    }else{
      this.root.rotation.set(dynamicRootX,dynamicRootY,0);
    }
    this.root.position.x=THREE.MathUtils.lerp(0,
      this.frozenRootPosition.x*rootPositionTarget,cubeRootLock);
    this.root.position.y=THREE.MathUtils.lerp(dynamicRootYPosition,
      this.frozenRootPosition.y*rootPositionTarget,cubeRootLock);
    this.root.position.z=THREE.MathUtils.lerp(0,
      this.frozenRootPosition.z*rootPositionTarget,cubeRootLock);
    this.updateLightRig(ownership);
    this.applyVisualOwnership(ownership);
    this.transitionInvariantMonitor.report(this.getTransitionDebug());
    this.updateCameraRig(ownership);
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.renderer.dispose();}
}
