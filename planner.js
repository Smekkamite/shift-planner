(function(root){
'use strict';
const add=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const offset=(date,anchor)=>Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(anchor+'T00:00:00Z'))/86400000);
const modulo=n=>((n%7)+7)%7;
function validate(data){
 if(!data||!Array.isArray(data.people)||!Array.isArray(data.shifts))throw Error('Input must contain people and shifts arrays.');
 if(data.shifts.length>350)throw Error('Maximum 350 shift positions per plan.');
 const ids=new Set(),sid=new Set();
 for(const p of data.people){if(!p||typeof p.id!=='string'||!p.id.trim()||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||!p.availability||typeof p.availability!=='object')throw Error('Invalid person or duplicate person ID.');ids.add(p.id);}
 for(const s of data.shifts){if(!s||typeof s.id!=='string'||typeof s.date!=='string'||typeof s.start!=='string'||typeof s.end!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!Number.isFinite(Date.parse(s.date))||add(s.date,0)!==s.date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)||s.start===s.end||!s.id||sid.has(s.id))throw Error('Invalid shift or duplicate shift ID.');if(s.personId!=null||s.vacant!==true)throw Error('Only vacant shifts can be imported. This demo generates a new plan.');sid.add(s.id);}
 if(!data.shifts.length)throw Error('Add at least one shift.');
 const dates=data.shifts.map(s=>s.date).sort(),start=dates[0],end=dates.at(-1),days=[];
 for(let d=start;d<=end;d=add(d,1)){days.push(d);if(days.length>35)throw Error('Maximum 35 days per plan.');}
 if(data.people.length>10)throw Error('Maximum 10 people in this demo.');
 for(const p of data.people){if(p.cycleAnchor!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(p.cycleAnchor)||!Number.isFinite(Date.parse(p.cycleAnchor))||add(p.cycleAnchor,0)!==p.cycleAnchor))throw Error('Invalid cycle anchor for '+p.id);if(p.previousShiftEnd!==undefined&&!Number.isFinite(Date.parse(p.previousShiftEnd)))throw Error('Invalid previous shift end for '+p.id);}
 for(const p of data.people)for(const d of days)if(typeof p.availability[d]!=='boolean')throw Error('Missing availability (true/false): '+p.id+' '+d);
 return days;
}
function plan(data){
 const days=validate(data),capacity=days.map(d=>data.shifts.filter(s=>s.date===d).length);
 const candidates=data.people.map(p=>Array.from({length:7},(_,phase)=>({phase,work:days.map((d,i)=>(i-phase+7)%7<4?i:-1).filter(i=>i>=0)})).filter(c=>(p.cycleAnchor===undefined||c.phase===modulo(-offset(days[0],p.cycleAnchor)))&&c.work.every(i=>p.availability[days[i]]&&capacity[i]>0)));
 const order=data.people.map((_,i)=>i).sort((a,b)=>candidates[a].length-candidates[b].length),used=capacity.map(()=>0),choice=data.people.map(()=>null);
 let best=choice.slice(),bestAssignments=[],score=0,nodes=0,limited=false;
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
   const remaining=workers.filter(i=>!usedToday.has(s.day+':'+i));
   if(!remaining.length)return visit(pos+1);
   for(const i of remaining)if(lastEnd[i]<=start){
    const previous=lastEnd[i];lastEnd[i]=end;usedToday.add(s.day+':'+i);assignments.push([s.index,i]);
    if(visit(pos+1))return true;
    assignments.pop();usedToday.delete(s.day+':'+i);lastEnd[i]=previous;
   }
   const later=slots.slice(pos+1).filter(x=>x.day===s.day).length;
   if(later>=remaining.length)return visit(pos+1);
   return false;
  }
  return visit(0)?assignments:null;
 }
 function search(k,total){
  if(++nodes>250000){limited=true;return;}
  if(total+upper.slice(k).reduce((a,b)=>a+b,0)<=score)return;
  if(k===order.length){const assigned=matchShifts();if(assigned){score=total;best=choice.slice();bestAssignments=assigned;}return;}
  const i=order[k];
  for(const c of candidates[i])if(c.work.every(d=>used[d]<capacity[d])){choice[i]=c;c.work.forEach(d=>used[d]++);search(k+1,total+c.work.length);c.work.forEach(d=>used[d]--);}
  choice[i]=null;search(k+1,total);
 }
 search(0,0);
 const shifts=data.shifts.map(s=>({...s,personId:null,vacant:true}));
 bestAssignments.forEach(([slot,i])=>{shifts[slot].personId=data.people[i].id;shifts[slot].vacant=false;});
 return {status:'draft',days,shifts,patterns:data.people.map((p,i)=>({personId:p.id,phase:best[i]?.phase??null})),unassignedPeople:data.people.map((p,i)=>({p,i})).filter(({i})=>!best[i]).map(({p,i})=>({id:p.id,reason:candidates[i].length?'No compatible position in this draft. Check shift capacity and overnight overlaps.':p.cycleAnchor?'The retained cycle conflicts with availability or shift dates. Adjust availability, or create a new plan with Keep existing cycles unchecked.':'No complete 4+3 cycle fits this person’s availability and the available shift dates.'})),uncovered:shifts.filter(s=>s.vacant).map(s=>s.id),searchLimited:limited};
}
function approve(result){if(!result||result.status!=='draft')throw Error('Generate a draft first.');if(result.uncovered.length||result.unassignedPeople.length)throw Error('Incomplete plan: resolve uncovered shifts and unassigned people before approval.');return {...result,status:'approved'};}
function newPeriod(input,approved,settings){
 validate(input);
 const {start,weeks,shiftStart,shiftEnd,positions,keepCycles}=settings;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(Date.parse(start))||add(start,0)!==start)throw Error('Choose a valid start date.');
 if(!Number.isInteger(weeks)||weeks<1||weeks>5||!Number.isInteger(positions)||positions<1||positions>10)throw Error('Choose 1–5 weeks and 1–10 daily positions.');
 if(keepCycles&&approved?.status==='approved'&&start<=approved.days.at(-1))throw Error('To continue approved cycles, start after the previous plan ends.');
 const people=input.people.map(p=>{
  const copy={id:p.id,name:p.name,availability:{}};
  if(keepCycles){
   if(p.cycleAnchor)copy.cycleAnchor=p.cycleAnchor;
   const pattern=approved?.status==='approved'?approved.patterns.find(c=>c.personId===p.id):null;
   if(pattern?.phase!=null)copy.cycleAnchor=add(approved.days[0],pattern.phase);
   if(p.previousShiftEnd&&Date.parse(p.previousShiftEnd)>Date.parse(start+'T00:00:00Z'))copy.previousShiftEnd=p.previousShiftEnd;
   const previous=approved?.status==='approved'?approved.shifts.filter(s=>s.personId===p.id).sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
   if(previous){let end=Date.parse(previous.date+'T'+previous.end+':00Z');if(previous.end<previous.start)end+=86400000;if(end>Date.parse(start+'T00:00:00Z'))copy.previousShiftEnd=new Date(end).toISOString();}
  }
  return copy;
 });
 const shifts=[];
 for(let i=0;i<weeks*7;i++){const date=add(start,i);people.forEach((p,j)=>p.availability[date]=input.people[j].availability[date]??true);for(let j=0;j<positions;j++)shifts.push({id:`S${i+1}-${j+1}`,date,start:shiftStart,end:shiftEnd,vacant:true,personId:null});}
 const next={people,shifts};validate(next);return next;
}
function sample(){const people=['Amelia Brooks','Mateo García','Amina Hassan','Kenji Tanaka','Chloé Dubois','Liam O’Connor','Priya Sharma'].map((name,i)=>({id:'P'+(i+1),name,availability:{}})),shifts=[];for(let i=0;i<28;i++){const date=add('2026-11-02',i);people.forEach(p=>p.availability[date]=true);for(let j=0;j<4;j++)shifts.push({id:`S${i+1}-${j+1}`,date,start:j<2?'16:00':'18:00',end:j<2?'00:00':'02:00',vacant:true,personId:null});}return {people,shifts};}
const api={plan,approve,sample,add,validate,newPeriod};if(typeof module!=='undefined')module.exports=api;else root.Planner=api;
})(globalThis);

