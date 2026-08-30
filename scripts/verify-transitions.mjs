import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
  const primitives=await vite.ssrLoadModule('/src/transition-primitives.ts');
  const {TransitionController}=await vite.ssrLoadModule('/src/transition-controller.ts');
  const {resolveVisualOwnership}=await vite.ssrLoadModule('/src/visual-ownership.ts');

  const timing={total:5.2,gather:1.2,hold:.5,seedMorph:1.1,seedOnly:.25};
  let previous=primitives.resolveCubeTimeline(0,timing);
  for(let index=1;index<=100;index++){
    const current=primitives.resolveCubeTimeline(index/100,timing);
    assert.ok(current.compression>=previous.compression,'Cube compression must be monotonic');
    assert.ok(current.seedMorph>=previous.seedMorph,'Cube seed morph must be monotonic');
    assert.ok(current.expansion>=previous.expansion,'Cube expansion must be monotonic');
    previous=current;
  }
  assert.equal(primitives.advanceNormalized(.9,1,1,1),1);
  assert.equal(primitives.advanceNormalized(.1,1,1,-1),0);

  let previousConsumption=0;
  let previousFill=1;
  for(let index=0;index<=100;index++){
    const progress=index/100;
    const consumption=primitives.terrainSourceConsumption(progress);
    const fill=primitives.terrainMiniChaosRemaining(progress);
    assert.ok(consumption>=previousConsumption,'Terrain source consumption must be monotonic');
    assert.ok(fill<=previousFill,'Compact Chaos must shrink monotonically during Terrain formation');
    previousConsumption=consumption;previousFill=fill;
  }

  const controller=new TransitionController('work');
  controller.request('terrain');
  controller.describe('absorb-core-to-compact','convergeSource',.4,'core','compact','reversible');
  assert.equal(controller.activeTransition?.requestedState,'terrain');
  controller.publishHandoff({kind:'cube-seed-consumed'});
  assert.equal(controller.consumeHandoff()?.kind,'cube-seed-consumed');
  assert.equal(controller.consumeHandoff(),null);

  const debug={
    ribbons:true,ribbonShadows:true,ribbonGhosts:true,faultParticles:true,kernel:true,
    chaos:true,chaosDigits:true,seedCube:true,cubeCells:true,cubeGlyphs:true,cubeLight:true,terrain:true,
  };
  const base={
    state:'calm',cubePhase:'inactive',terrainPhase:'inactive',terrainEntrySource:null,
    terrainSourceConsumption:0,terrainPresence:0,terrainConvergence:0,
    chaosPresence:1,cubePresence:0,debug,
  };
  const calm=resolveVisualOwnership(base);
  assert.equal(calm.ribbons.lifecycle,'active');assert.equal(calm.chaos.lifecycle,'active');
  assert.equal(calm.cubeCells.lifecycle,'inactive');assert.equal(calm.terrain.lifecycle,'inactive');
  const cube=resolveVisualOwnership({...base,state:'cube',cubePhase:'idle',cubePresence:1});
  assert.equal(cube.cubeCells.lifecycle,'active');assert.equal(cube.ribbons.lifecycle,'inactive');
  const terrain=resolveVisualOwnership({
    ...base,state:'terrain',terrainPhase:'idle',terrainPresence:1,terrainConvergence:1,
  });
  assert.equal(terrain.terrain.lifecycle,'active');
  for(const key of ['ribbons','kernel','chaos','seedCube','cubeCells']){
    assert.equal(terrain[key].lifecycle,'inactive',`Terrain must not retain ${key}`);
  }
  const collapse=resolveVisualOwnership({
    ...base,state:'terrain',terrainPhase:'collapsePoints',terrainPresence:.8,
    terrainConvergence:1,chaosPresence:.4,
  });
  assert.equal(collapse.terrain.lifecycle,'transitional');
  assert.equal(collapse.chaos.lifecycle,'transitional');
  assert.equal(collapse.kernel.lifecycle,'inactive');

  console.log('Architecture transition invariants: PASS');
}finally{
  await vite.close();
}
