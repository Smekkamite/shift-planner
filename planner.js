(function(root){
'use strict';
const add=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const offset=(date,anchor)=>Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(anchor+'T00:00:00Z'))/86400000);
const modulo=n=>((n%7)+7)%7;
const bitCount=mask=>Array.from({length:7},(_,i)=>(mask>>i)&1).reduce((a,b)=>a+b,0);
function rulesOf(data){
 const rules=data.rules??{restDays:3,restMode:'consecutive'};
 if(rules.restMode==='unrestricted')return {restDays:null,restMode:'unrestricted'};
 if(!Number.isInteger(rules.restDays)||rules.restDays<0||rules.restDays>7||!['consecutive','separated','flexible'].includes(rules.restMode))throw Error('Choose 0–7 rest days and a valid rest arrangement.');
 if(rules.restMode==='separated'&&rules.restDays>3)throw Error('Separated rest days allow at most 3 days off in a repeating 7-day week. Choose Flexible or Consecutive for more rest days.');
 return {restDays:rules.restDays,restMode:rules.restMode};
}
function allowedMasks(rules){
 if(rules.restMode==='unrestricted')return Array.from({length:128},(_,mask)=>mask).sort((a,b)=>bitCount(b)-bitCount(a));
 const workDays=7-rules.restDays, masks=[];
 // Prefer simple rotating blocks when grouping is allowed; flexible mode still considers all masks.
 for(let phase=0;phase<7;phase++){let mask=0;for(let i=0;i<7;i++)if(modulo(i-phase)<workDays)mask|=1<<i;if(!masks.includes(mask))masks.push(mask);}
 if(rules.restMode!=='consecutive')for(let mask=0;mask<128;mask++)if(bitCount(mask)===workDays&&!masks.includes(mask))masks.push(mask);
 return masks.filter(mask=>rules.restMode!=='separated'||Array.from({length:7},(_,i)=>((mask>>i)&1)||((mask>>((i+1)%7))&1)).every(Boolean));
}
function validate(data){
 if(!data||!Array.isArray(data.people)||!Array.isArray(data.shifts))throw Error('Input must contain people and shifts arrays.');
 rulesOf(data);
 if(data.shifts.length>350)throw Error('Maximum 350 shift positions per plan.');
 const ids=new Set(),sid=new Set();
 for(const p of data.people){if(!p||typeof p.id!=='string'||!p.id.trim()||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||!p.availability||typeof p.availability!=='object')throw Error('Invalid person or duplicate person ID.');ids.add(p.id);}
 for(const s of data.shifts){if(!s||typeof s.id!=='string'||typeof s.date!=='string'||typeof s.start!=='string'||typeof s.end!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!Number.isFinite(Date.parse(s.date))||add(s.date,0)!==s.date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)||s.start===s.end||!s.id||sid.has(s.id))throw Error('Invalid shift or duplicate shift ID.');if(s.personId!=null||s.vacant!==true)throw Error('Only vacant shifts can be imported. This demo generates a new plan.');sid.add(s.id);}
 if(!data.shifts.length)throw Error('Add at least one shift.');
 const dates=data.shifts.map(s=>s.date).sort(),start=dates[0],end=dates.at(-1),days=[];
 for(let d=start;d<=end;d=add(d,1)){days.push(d);if(days.length>35)throw Error('Maximum 35 days per plan.');}
 if(data.people.length>10)throw Error('Maximum 10 people in this demo.');
 for(const p of data.people){if(p.rules)rulesOf({rules:p.rules});if(p.weeklyRules){if(typeof p.weeklyRules!=='object'||Array.isArray(p.weeklyRules))throw Error('Invalid weekly rules for '+p.id);for(const [date,rule] of Object.entries(p.weeklyRules)){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||add(date,0)!==date)throw Error('Invalid rule week for '+p.id);rulesOf({rules:rule});}}if(p.cycleMask!==undefined&&(!Number.isInteger(p.cycleMask)||p.cycleMask<0||p.cycleMask>127||!p.cycleAnchor))throw Error('Invalid retained pattern for '+p.id);if(p.cycleAnchor!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(p.cycleAnchor)||!Number.isFinite(Date.parse(p.cycleAnchor))||add(p.cycleAnchor,0)!==p.cycleAnchor))throw Error('Invalid cycle anchor for '+p.id);if(p.previousShiftEnd!==undefined&&!Number.isFinite(Date.parse(p.previousShiftEnd)))throw Error('Invalid previous shift end for '+p.id);}
 for(const p of data.people)for(const d of days)if(typeof p.availability[d]!=='boolean')throw Error('Missing availability (true/false): '+p.id+' '+d);
 if(data.fixedAssignments!==undefined){if(!data.fixedAssignments||typeof data.fixedAssignments!=='object'||Array.isArray(data.fixedAssignments))throw Error('Invalid manual assignments.');const booked=new Set();for(const [id,personId] of Object.entries(data.fixedAssignments)){const shift=data.shifts.find(s=>s.id===id);if(!shift||(personId!==null&&!ids.has(personId)))throw Error('Invalid manual assignment: '+id);if(personId!==null){const key=personId+'|'+shift.date;if(booked.has(key))throw Error('A person cannot have two shifts on the same day.');booked.add(key);if(!data.people.find(p=>p.id===personId).availability[shift.date])throw Error('The selected person is unavailable on '+shift.date);}}}
 return days;
}
function plan(data){
 const days=validate(data),capacity=days.map(d=>data.shifts.filter(s=>s.date===d&&data.fixedAssignments?.[s.id]!==null).length);
 const candidates=data.people.map(p=>{const rules=rulesOf({rules:p.rules??rulesOf(data)}),workDays=7-rules.restDays;const masks=p._allowedMasks??allowedMasks(rules);return masks.map(mask=>{
  const phase=Array.from({length:7},(_,phase)=>phase).find(phase=>Array.from({length:7},(_,i)=>!!(mask&(1<<i))===(modulo(i-phase)<workDays)).every(Boolean))??null;
  return {mask,phase,work:days.map((d,i)=>mask&(1<<(i%7))?i:-1).filter(i=>i>=0)};
 }).filter(c=>(!p.cycleAnchor||days.slice(0,7).every((d,i)=>{
  const previousIndex=modulo(offset(d,p.cycleAnchor));
  const previousWork=p.cycleMask===undefined?previousIndex<4:!!(p.cycleMask&(1<<previousIndex));
  return !!(c.mask&(1<<i))===previousWork;
 }))&&Object.entries(data.fixedAssignments??{}).filter(([,id])=>id===p.id).every(([id])=>c.work.includes(days.indexOf(data.shifts.find(s=>s.id===id).date)))&&c.work.every(i=>p.availability[days[i]]&&capacity[i]>0));});
 const order=data.people.map((_,i)=>i).sort((a,b)=>candidates[a].length-candidates[b].length),used=capacity.map(()=>0),choice=data.people.map(()=>null);
 let best=candidates.map(list=>list.find(c=>c.work.length===0)??null),bestAssignments=[],score=0,nodes=0,limited=false;
 const upper=order.map(i=>Math.max(0,...candidates[i].map(c=>c.work.length)));
 // Match chosen workdays to actual shifts, including overnight overlap checks.
 function matchShifts(){
  const slots=data.shifts.map((s,i)=>({...s,index:i,day:days.indexOf(s.date)})).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
  const lastEnd=data.people.map(p=>p.previousShiftEnd?(Date.parse(p.previousShiftEnd)-Date.parse(days[0]+'T00:00:00Z'))/60000:-Infinity),assignments=[],usedToday=new Set();
  function visit(pos){
   if(++nodes>250000){limited=true;return false;}
   if(pos>0&&(pos===slots.length||slots[pos].day!==slots[pos-1].day)){
    const previousDay=slots[pos-1].day;
    if(choice.some((c,i)=>c?.work.includes(previousDay)&&!usedToday.has(previousDay+':'+i)))return false;
   }
   if(pos===slots.length)return true;
   const s=slots[pos],minute=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
   const start=s.day*1440+minute(s.start),end=s.day*1440+minute(s.end)+(s.end<s.start?1440:0);
   const workers=choice.map((c,i)=>c?.work.includes(s.day)?i:-1).filter(i=>i>=0);
   let remaining=workers.filter(i=>!usedToday.has(s.day+':'+i));
   const fixed=data.fixedAssignments?.[s.id];
   if(fixed===null){const later=slots.slice(pos+1).filter(x=>x.day===s.day&&data.fixedAssignments?.[x.id]!==null).length;return later>=remaining.length?visit(pos+1):false;}
   if(fixed!==undefined){remaining=remaining.filter(i=>data.people[i].id===fixed);if(!remaining.length)return false;}
   if(!remaining.length)return visit(pos+1);
   for(const i of remaining)if(lastEnd[i]<=start){
    const previous=lastEnd[i];lastEnd[i]=end;usedToday.add(s.day+':'+i);assignments.push([s.index,i]);
    if(visit(pos+1))return true;
    assignments.pop();usedToday.delete(s.day+':'+i);lastEnd[i]=previous;
   }
   const later=slots.slice(pos+1).filter(x=>x.day===s.day).length;
   if(fixed===undefined&&later>=remaining.length)return visit(pos+1);
   return false;
  }
  return visit(0)?assignments:null;
 }
 function search(k,total){
  if(score>=capacity.reduce((sum,n)=>sum+n,0))return;
  if(++nodes>250000){limited=true;return;}
  if(total+upper.slice(k).reduce((a,b)=>a+b,0)<=score)return;
  if(k===order.length){const assigned=matchShifts();if(assigned){score=total;best=choice.slice();bestAssignments=assigned;}return;}
  const i=order[k];
  for(const c of [...candidates[i]].sort((a,b)=>(b.mask===data.people[i]._preferredMask?1000:0)-(a.mask===data.people[i]._preferredMask?1000:0)+a.work.reduce((sum,d)=>sum+used[d],0)-b.work.reduce((sum,d)=>sum+used[d],0)))if(c.work.every(d=>used[d]<capacity[d])){choice[i]=c;c.work.forEach(d=>used[d]++);search(k+1,total+c.work.length);c.work.forEach(d=>used[d]--);}
  choice[i]=candidates[i].find(c=>c.work.length===0)??null;search(k+1,total);
 }
 search(0,0);
 const shifts=data.shifts.map(s=>({...s,personId:null,vacant:true}));
 bestAssignments.forEach(([slot,i])=>{shifts[slot].personId=data.people[i].id;shifts[slot].vacant=false;});
 return {status:'draft',days,shifts,patterns:data.people.map((p,i)=>({personId:p.id,phase:best[i]?.phase??null,workMask:best[i]?.mask??null})),unassignedPeople:data.people.map((p,i)=>({p,i})).filter(({i})=>!best[i]).map(({p,i})=>({id:p.id,reason:candidates[i].length?'No compatible position in this draft. Check shift capacity and overnight overlaps.':p.cycleAnchor?'The retained cycle conflicts with availability or shift dates. Adjust availability, or create a new plan with Keep existing weekly patterns unchecked.':'No complete weekly pattern fits this person’s availability and the available shift dates.'})),uncovered:shifts.filter(s=>s.vacant).map(s=>s.id),searchLimited:limited};
}
function approve(result){if(!result||result.status!=='draft')throw Error('Generate a draft first.');if(result.uncovered.length||result.unassignedPeople.length)throw Error('Incomplete plan: resolve uncovered shifts and unassigned people before approval.');return {...result,status:'approved'};}
function newPeriod(input,approved,settings){
 validate(input);
 const {start,weeks,shiftStart,shiftEnd,positions,keepCycles}=settings;
 const rules=rulesOf({rules:settings.rules??rulesOf(input)});
 if(keepCycles&&JSON.stringify(rules)!==JSON.stringify(rulesOf(input)))throw Error('Rest rules changed. Uncheck Keep existing patterns to create a new pattern.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(Date.parse(start))||add(start,0)!==start)throw Error('Choose a valid start date.');
 if(!Number.isInteger(weeks)||weeks<1||weeks>5||!Number.isInteger(positions)||positions<1||positions>10)throw Error('Choose 1–5 weeks and 1–10 daily positions.');
 if(keepCycles&&approved?.status==='approved'&&start<=approved.days.at(-1))throw Error('To continue approved cycles, start after the previous plan ends.');
 const people=input.people.map(p=>{
  const copy={id:p.id,name:p.name,availability:{}};
  if(p.rules)copy.rules={...p.rules};
  if(keepCycles){
   if(p.cycleAnchor)copy.cycleAnchor=p.cycleAnchor;
   if(p.cycleMask!==undefined)copy.cycleMask=p.cycleMask;
   const pattern=approved?.status==='approved'?approved.patterns.find(c=>c.personId===p.id):null;
   if(pattern?.workMask!=null){copy.cycleAnchor=approved.days[0];copy.cycleMask=pattern.workMask;}else if(pattern?.phase!=null)copy.cycleAnchor=add(approved.days[0],pattern.phase);
   if(p.previousShiftEnd&&Date.parse(p.previousShiftEnd)>Date.parse(start+'T00:00:00Z'))copy.previousShiftEnd=p.previousShiftEnd;
   const previous=approved?.status==='approved'?approved.shifts.filter(s=>s.personId===p.id).sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
   if(previous){let end=Date.parse(previous.date+'T'+previous.end+':00Z');if(previous.end<previous.start)end+=86400000;if(end>Date.parse(start+'T00:00:00Z'))copy.previousShiftEnd=new Date(end).toISOString();}
  }
  // Keep the last approved overnight boundary even when weekly patterns are independent.
  if(input.schedulingMode==='weekly'){
   const previous=approved?.status==='approved'?approved.shifts.filter(s=>s.personId===p.id).sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
   const prior=p.previousShiftEnd?Date.parse(p.previousShiftEnd):-Infinity;
   let end=prior;if(previous){end=Date.parse(previous.date+'T'+previous.end+':00Z');if(previous.end<previous.start)end+=86400000;}
   if(end>Date.parse(start+'T00:00:00Z'))copy.previousShiftEnd=new Date(end).toISOString();
  }
  return copy;
 });
 const shifts=[];
 for(let i=0;i<weeks*7;i++){const date=add(start,i);people.forEach((p,j)=>p.availability[date]=input.people[j].availability[date]??true);for(let j=0;j<positions;j++)shifts.push({id:`S${i+1}-${j+1}`,date,start:shiftStart,end:shiftEnd,vacant:true,personId:null});}
 const next={people,shifts,rules};if(input.schedulingMode)next.schedulingMode=input.schedulingMode;validate(next);return next;
}
function sample(rules={restDays:2,restMode:'flexible'}){rules=rulesOf({rules});const people=['Amelia Brooks','Mateo García','Amina Hassan','Kenji Tanaka','Chloé Dubois','Liam O’Connor','Priya Sharma'].map((name,i)=>({id:'P'+(i+1),name,availability:{}})),shifts=[];for(let i=0;i<28;i++){const date=add('2026-11-02',i);people.forEach(p=>p.availability[date]=true);for(let j=0;j<7-rules.restDays;j++)shifts.push({id:`S${i+1}-${j+1}`,date,start:j<2?'16:00':'18:00',end:j<2?'00:00':'02:00',vacant:true,personId:null});}return {people,shifts,rules};}
const api={plan,approve,sample,add,validate,newPeriod,rulesOf,allowedMasks};if(typeof module!=='undefined')module.exports=api;else root.Planner=api;
})(globalThis);

