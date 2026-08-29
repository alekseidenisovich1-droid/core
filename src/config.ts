import type { VisualState } from './state';

export const CONFIG = {
  colors: ['#050507','#3b3942','#88858f','#dedee7','#ffffff','#ff4fa3','#8b4dff','#08060e'],
  CORE_RADIUS: 0.525,
  // Clearly separated radial shells prevent the three deformed surfaces from colliding.
  RIBBON_RADII: [1.30,1.90,2.52] as const,
  RIBBON_HALF_WIDTHS: [0.16,0.19,0.22] as const,
  RIBBON_DIGIT_GRID_X: 620,
  RIBBON_DIGIT_GRID_Y: 40,
  // Divided by DIGIT_SIZE at runtime: 72x36 visible cells, twice the old core density.
  CORE_DIGIT_GRID_X: 144,
  CORE_DIGIT_GRID_Y: 72,
  DIGIT_SIZE: 2,
  DIGIT_DENSITY: 1,
  CALM_WAVE_SPEED: 0.34,
  CALM_WAVE_AMPLITUDE: 0.07,
  ERROR_WAVE_SPEED: 3.10,
  ERROR_WAVE_AMPLITUDE: 0.23,
  ERROR_PARTICLES_PER_RIBBON: 260,
  STATE_TRANSITION_SPEED: 2.70,
  GLITCH_TRANSITION_SPEED: 3.10,
  SUCCESS_HOLD_TIME: 3000,
  WORKING_MIN_TIME: 4200,
  IDLE_DELAY: 3600,
  EVENT_DEBOUNCE_TIME: 1200,
  CODEX_START_CPU: 1.6,
  CODEX_RELEASE_CPU: 0.45,
  SAFE_RENDER_MARGIN: 0.15,
  CAMERA_Z: 10.4,
  // Centralized spatial-lighting controls. CORE remains mostly dark: the
  // binary matter is the source of visual energy, not a global wash of light.
  LIGHTING: {
    ambientIntensity: .16,
    fillIntensity: .3,
    keyIntensity: .28,
    shadowMapSize: 512,
    shadowIntensity: .22,
    shadowBlurSamples: 20,
    shadowBias: -.00035,
    shadowNormalBias: .042,
    shadowSoftness: 12,
    surfaceOpacity: .19,
    ribbonEmission: .2,
    spillIntensity: 1,
    depthFadeStrength: .18,
  },
  EXPERIMENTS: {
    workRibbonRelief: true,
    chaosSpeedDefault: 1,
    chaosSpeedMin: .4,
    chaosSpeedMax: 1.4,
    // Local hill height is proportional to the current Möbius radius.
    ribbonReliefRadiusRatio: .11,
    // 8 cells per axis. The .207/.062 pitch keeps the complete lattice about
    // 30% smaller than the former 10 x 10 x 10, 2.98-unit cube.
    cubeCellsPerAxis: 8,
    cubeCellSize: .207,
    cubeCellGap: .062,
    cubeTransitionSeconds: 5.2,
    cubeCoreGatherSeconds: 1.2,
    cubeCoreHoldSeconds: .5,
    cubeSeedMorphSeconds: 1.1,
    cubeSeedOnlySeconds: .25,
    cubeTransitionTimeScale: 1,
    cubeFragmentPeriod: 18,
    cubeFragmentDuration: 1.7,
    // The simulation domain deliberately extends well beyond the visible
    // field. 43k GPU points replace roughly 39k vertices from the old glyph
    // quads, so the denser point topology stays within the same order of cost.
    terrainColumns: 240,
    terrainRows: 180,
    terrainWidth: 14,
    terrainDepth: 6,
    terrainTransitionSeconds: 3.1,
    terrainCoreGatherSeconds: 1.2,
    terrainSourceHoldSeconds: .5,
    terrainCoreMorphSeconds: .9,
    terrainTargetReleaseSeconds: 1.2,
  },
} as const;

export interface StateTuning {
  orbitSpeed:number; contraction:number; openness:number; energy:number; glitch:number;
  widthVariation:number; deformation:number; twist:number; selfRotation:number;
  waveSpeed:number; waveComplexity:number; waveAmplitude:number;
  digitScale:number; digitDensity:number; gradientSpeed:number; rewriteSpeed:number;
  corePulse:number; coreScale:number; glow:number;
}

export const STATE_TUNING: Record<VisualState,StateTuning> = {
  calm: {
    orbitSpeed:.38,contraction:.333,openness:0,energy:.46,glitch:0,
    widthVariation:.105,deformation:.075,twist:.065,selfRotation:.085,
    waveSpeed:CONFIG.CALM_WAVE_SPEED,waveComplexity:0,waveAmplitude:CONFIG.CALM_WAVE_AMPLITUDE,
    digitScale:1,digitDensity:1,gradientSpeed:.03,rewriteSpeed:.48,corePulse:.045,coreScale:1,glow:.095,
  },
  work: {
    orbitSpeed:4.05,contraction:.5,openness:0,energy:1.04,glitch:0,
    widthVariation:.26,deformation:.21,twist:.18,selfRotation:1.08,
    waveSpeed:4.95,waveComplexity:.68,waveAmplitude:.18,
    digitScale:1.12,digitDensity:1.1,gradientSpeed:.48,rewriteSpeed:6.3,
    corePulse:.09,coreScale:.667,glow:.155,
  },
  error: {
    orbitSpeed:1.92,contraction:.333,openness:0,energy:1.3,glitch:1,
    widthVariation:.30,deformation:.25,twist:.30,selfRotation:.58,
    waveSpeed:CONFIG.ERROR_WAVE_SPEED,waveComplexity:1,waveAmplitude:CONFIG.ERROR_WAVE_AMPLITUDE,
    digitScale:1.2,digitDensity:1,gradientSpeed:.09,rewriteSpeed:2.6,
    corePulse:.12,coreScale:.667,glow:.19,
  },
  critical: {
    orbitSpeed:1.92,contraction:.333,openness:0,energy:1.3,glitch:1,
    widthVariation:.30,deformation:.25,twist:.30,selfRotation:.58,
    waveSpeed:CONFIG.ERROR_WAVE_SPEED,waveComplexity:1,waveAmplitude:CONFIG.ERROR_WAVE_AMPLITUDE,
    digitScale:1.2,digitDensity:1,gradientSpeed:.09,rewriteSpeed:2.6,
    corePulse:.12,coreScale:.667,glow:.19,
  },
  critical2: {
    orbitSpeed:.38,contraction:0,openness:0,energy:.46,glitch:1,
    widthVariation:.105,deformation:.075,twist:.065,selfRotation:.085,
    waveSpeed:CONFIG.CALM_WAVE_SPEED,waveComplexity:0,waveAmplitude:CONFIG.CALM_WAVE_AMPLITUDE,
    digitScale:1,digitDensity:1,gradientSpeed:.03,rewriteSpeed:.48,
    corePulse:.045,coreScale:.667,glow:.095,
  },
  cube: {
    orbitSpeed:.18,contraction:.333,openness:0,energy:.74,glitch:0,
    widthVariation:.105,deformation:.075,twist:.065,selfRotation:.085,
    waveSpeed:CONFIG.CALM_WAVE_SPEED,waveComplexity:0,waveAmplitude:CONFIG.CALM_WAVE_AMPLITUDE,
    digitScale:1,digitDensity:1,gradientSpeed:.03,rewriteSpeed:.48,
    corePulse:.02,coreScale:1,glow:.11,
  },
  terrain: {
    orbitSpeed:.08,contraction:0,openness:0,energy:.56,glitch:0,
    widthVariation:.08,deformation:.04,twist:.03,selfRotation:.04,
    waveSpeed:CONFIG.CALM_WAVE_SPEED,waveComplexity:0,waveAmplitude:CONFIG.CALM_WAVE_AMPLITUDE,
    digitScale:1,digitDensity:1,gradientSpeed:.018,rewriteSpeed:.2,
    corePulse:.015,coreScale:1,glow:.08,
  },
};
