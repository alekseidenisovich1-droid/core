const states=['CALM','WORK','ERROR','CRITICAL','CRITICAL_2','CUBE','TERRAIN'];
const matrix=[];
for(const from of states){
  for(const to of states){
    matrix.push({from,to,status:from===to?'STABLE NO-OP':'PENDING RUNTIME CHECK'});
  }
}

console.table(matrix);
console.log('\nRuntime protocol: for each non-identity pair test 1x, 0.25x, return, and rapid retarget.');
console.log('Inspect window.__coreVisualDebug.getTransitionDebug(); invariantViolations must remain empty.');
console.log('Mandatory stress sequence: WORK -> TERRAIN -> ERROR -> CUBE.');
