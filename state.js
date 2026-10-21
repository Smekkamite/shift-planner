(function(root){
 'use strict';
 const planner=typeof module!=='undefined'?require('./planner.js'):root.Planner;
 function encode(input,result){return JSON.stringify({version:1,input,result},null,2);}
 function decode(text){
  const saved=JSON.parse(text.replace(/^\uFEFF/,''));
  if(!saved||typeof saved!=='object'||Array.isArray(saved))throw Error('Invalid backup. Choose a file created with Save backup.');
  if(saved.version!==undefined&&saved.version!==1)throw Error('Unsupported backup version.');
  // Also accept source-data files exported by the first demo version.
  const input=saved.version===1?saved.input:saved;
  planner.validate(input);
  let result=null;
  if(saved.version===1&&saved.result){
   const checked=planner.plan(input),given=saved.result;
   if(!['draft','approved'].includes(given.status)||JSON.stringify(given.shifts)!==JSON.stringify(checked.shifts)||JSON.stringify(given.patterns)!==JSON.stringify(checked.patterns))throw Error('The saved schedule does not match its input. Restore a valid backup.');
   result=given.status==='approved'?planner.approve(checked):checked;
  }
  return {input,result};
 }
 const api={encode,decode};if(typeof module!=='undefined')module.exports=api;else root.PlannerState=api;
})(globalThis);
