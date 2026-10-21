(function(root){
 'use strict';
 const planner=typeof module!=='undefined'?require('./planner.js'):root.Planner;
 function encode(input,result){return JSON.stringify({version:1,input,result},null,2);}
 function restoreResult(input,given){
  const days=planner.validate(input),rules=planner.rulesOf(input),allowed=planner.allowedMasks(rules);
  const fail=()=>{throw Error('The saved schedule does not match its input. Restore a valid backup.');};
  if(!given||!['draft','approved'].includes(given.status)||!Array.isArray(given.shifts)||given.shifts.length!==input.shifts.length||!Array.isArray(given.patterns)||given.patterns.length!==input.people.length)fail();
  const seen=new Set();
  const shifts=input.shifts.map(original=>{
   const saved=given.shifts.find(s=>s?.id===original.id);
   if(!saved||seen.has(saved.id)||saved.date!==original.date||saved.start!==original.start||saved.end!==original.end||typeof saved.vacant!=='boolean'||saved.vacant!==(saved.personId===null)||(!saved.vacant&&!input.people.some(p=>p.id===saved.personId)))fail();
   seen.add(saved.id);return {...original,personId:saved.personId,vacant:saved.vacant};
  });
  const patterns=input.people.map(person=>{
   const pattern=given.patterns.find(p=>p?.personId===person.id);if(!pattern)fail();
   let mask=pattern.workMask;
   // Migrate the original fixed 4+3 backups without changing their assignments.
   if(mask===undefined){mask=pattern.phase===null?null:Array.from({length:7},(_,i)=>((i-pattern.phase+7)%7<4)?1<<i:0).reduce((a,b)=>a|b,0);}
   if(mask!==null&&(!Number.isInteger(mask)||!allowed.includes(mask)))fail();
   const assigned=shifts.filter(s=>s.personId===person.id).sort((a,b)=>a.date.localeCompare(b.date));
   let previousEnd=person.previousShiftEnd?Date.parse(person.previousShiftEnd):-Infinity;
   for(const shift of assigned){const start=Date.parse(shift.date+'T'+shift.start+':00Z');let end=Date.parse(shift.date+'T'+shift.end+':00Z');if(shift.end<shift.start)end+=86400000;if(start<previousEnd||!person.availability[shift.date])fail();previousEnd=end;}
   for(let i=0;i<days.length;i++){
    const expected=mask!==null&&!!(mask&(1<<(i%7))),count=assigned.filter(s=>s.date===days[i]).length;
    if(count!==(expected?1:0))fail();
    if(mask!==null&&person.cycleAnchor){const delta=Math.round((Date.parse(days[i])-Date.parse(person.cycleAnchor))/86400000),index=((delta%7)+7)%7,retained=person.cycleMask===undefined?index<4:!!(person.cycleMask&(1<<index));if(retained!==expected)fail();}
   }
   // Phase is legacy metadata; recompute it from the verified weekly mask.
   const phase=mask===null?null:Array.from({length:7},(_,i)=>i).find(phase=>Array.from({length:7},(_,i)=>!!(mask&(1<<i))===(((i-phase+7)%7)<7-rules.restDays)).every(Boolean))??null;
   return {personId:person.id,phase,workMask:mask};
  });
  const unassignedPeople=patterns.filter(p=>p.workMask===null).map(p=>({id:p.personId,reason:typeof given.unassignedPeople?.find(x=>x.id===p.personId)?.reason==='string'?given.unassignedPeople.find(x=>x.id===p.personId).reason:'No compatible weekly pattern in the saved draft.'}));
  const checked={status:'draft',days,shifts,patterns,unassignedPeople,uncovered:shifts.filter(s=>s.vacant).map(s=>s.id),searchLimited:given.searchLimited===true};
  return given.status==='approved'?planner.approve(checked):checked;
 }
 function decode(text){
  const saved=JSON.parse(text.replace(/^\uFEFF/,''));
  if(!saved||typeof saved!=='object'||Array.isArray(saved))throw Error('Invalid backup. Choose a file created with Save backup.');
  if(saved.version!==undefined&&saved.version!==1)throw Error('Unsupported backup version.');
  const input=saved.version===1?saved.input:saved;
  planner.validate(input);
  return {input,result:saved.version===1&&saved.result?restoreResult(input,saved.result):null};
 }
 const api={encode,decode};if(typeof module!=='undefined')module.exports=api;else root.PlannerState=api;
})(globalThis);
