(function(root){
 'use strict';
 const P=typeof module!=='undefined'?require('./planner.js'):root.Planner;
 const bits=mask=>Array.from({length:7},(_,i)=>!!(mask&(1<<i)));
 function effectiveRule(data,person,start){return P.rulesOf({rules:person.weeklyRules?.[start]??person.rules??P.rulesOf(data)});}
 function weeklyMasks(rule){return P.allowedMasks(rule);}
 function wraps(rule,work){return rule.restMode==='consecutive'&&!work[0]&&!work.at(-1)&&work.some(Boolean);}
 function ruleFits(rule,visible){return weeklyMasks(rule).some(mask=>visible.every((work,i)=>work===!!(mask&(1<<i))));}
 function review(data,savedShifts,{searchLimited=false,manual=false}={}){
  const days=P.validate(data);
  if(!Array.isArray(savedShifts)||savedShifts.length!==data.shifts.length)throw Error('Saved shifts do not match the input.');
  const seen=new Set();
  const shifts=data.shifts.map(source=>{
   const shift=savedShifts.find(s=>s?.id===source.id);
   if(!shift||seen.has(shift.id)||shift.date!==source.date||shift.start!==source.start||shift.end!==source.end||typeof shift.vacant!=='boolean'||shift.vacant!==(shift.personId===null)||(!shift.vacant&&!data.people.some(p=>p.id===shift.personId)))throw Error('Saved shifts do not match the input.');
   seen.add(shift.id);
   if(Object.hasOwn(data.fixedAssignments??{},shift.id)&&data.fixedAssignments[shift.id]!==shift.personId)throw Error('A locked assignment was changed.');
   return {...source,personId:shift.personId,vacant:shift.vacant};
  });
  const issues=[],patterns=[];
  for(const person of data.people){
   const assigned=shifts.filter(s=>s.personId===person.id).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
   let last=person.previousShiftEnd?Date.parse(person.previousShiftEnd):-Infinity;
   const dates=new Set();
   for(const s of assigned){
    if(dates.has(s.date))throw Error(person.name+' already has a shift on '+s.date+'.');
    if(!person.availability[s.date])throw Error(person.name+' is unavailable on '+s.date+'.');
    const start=Date.parse(s.date+'T'+s.start+':00Z');let end=Date.parse(s.date+'T'+s.end+':00Z');if(s.end<s.start)end+=86400000;
    if(start<last)throw Error('Overlapping shifts for '+person.name+'.');last=end;dates.add(s.date);
   }
   const weeks=[];let previousRest=false,previousMode=null,previousWrapped=false;
   for(let offset=0;offset<days.length;offset+=7){
    const visible=days.slice(offset,offset+7),rule=effectiveRule(data,person,visible[0]),work=visible.map(d=>dates.has(d));
    let valid=ruleFits(rule,work);
    if(offset>0&&previousRest&&!work[0]&&(rule.restMode==='separated'||previousMode==='separated'))valid=false;
    if(offset>0&&((previousWrapped&&work[0])||(wraps(rule,work)&&!previousRest)))valid=false;
    const mask=work.reduce((mask,v,i)=>v?mask|(1<<i):mask,0);
    if(!valid)issues.push({id:person.id,weekStart:visible[0],reason:'Week '+visible[0]+': assignments do not meet this person’s '+(rule.restMode==='unrestricted'?'unrestricted':`${rule.restDays}-rest-day / ${rule.restMode}`)+' rule. Adjust shifts or change the individual rule.'});
    weeks.push({start:visible[0],workMask:mask,valid});previousRest=!work.at(-1);previousMode=rule.restMode;previousWrapped=wraps(rule,work);
   }
   const same=weeks.every(w=>w.workMask===weeks[0].workMask);
   patterns.push({personId:person.id,phase:null,workMask:same?weeks[0].workMask:null,weeks});
  }
  return {status:'draft',days,shifts,patterns,unassignedPeople:issues,uncovered:shifts.filter(s=>s.vacant).map(s=>s.id),searchLimited,manual};
 }
 function plan(data){
  if(data.schedulingMode!=='weekly')return P.plan(data);
  const days=P.validate(data),shifts=[],previousEnd=new Map(),previousRest=new Map(),previousMode=new Map(),previousWrapped=new Map(),previousMask=new Map();let limited=false;
  for(let offset=0;offset<days.length;offset+=7){
   const week=days.slice(offset,offset+7),weekShifts=data.shifts.filter(s=>week.includes(s.date));
   const people=data.people.map(p=>{
    const rule=effectiveRule(data,p,week[0]),copy={id:p.id,name:p.name,availability:{...p.availability},rules:rule};
    copy._allowedMasks=weeklyMasks(rule).filter(mask=>week.every((date,i)=>!(mask&(1<<i))||weekShifts.some(s=>s.date===date))); 
    if(previousRest.get(p.id)&&(rule.restMode==='separated'||previousMode.get(p.id)==='separated'))copy._allowedMasks=copy._allowedMasks.filter(mask=>mask&1);
    if(offset>0)copy._allowedMasks=copy._allowedMasks.filter(mask=>(!previousWrapped.get(p.id)||!(mask&1))&&(!wraps(rule,bits(mask))||previousRest.get(p.id)));
    if(previousMask.has(p.id))copy._preferredMask=previousMask.get(p.id);
    const prior=previousEnd.get(p.id)??p.previousShiftEnd;if(prior)copy.previousShiftEnd=prior;
    return copy;
   });
   let proposed;
   if(weekShifts.length){
    const fixed=Object.fromEntries(Object.entries(data.fixedAssignments??{}).filter(([id])=>weekShifts.some(s=>s.id===id)));
    const sub={people,shifts:weekShifts,rules:P.rulesOf(data),fixedAssignments:fixed};
    // Preserve the parent week's origin if its first days have no positions.
    const first=weekShifts.map(s=>s.date).sort()[0];const delta=week.indexOf(first);
    if(delta)people.forEach(p=>{p._allowedMasks=p._allowedMasks.map(mask=>bits(mask).reduce((m,v,i)=>v?m|(1<<((i-delta+7)%7)):m,0));});
    proposed=P.plan(sub);limited ||= proposed.searchLimited;
    if(Object.entries(fixed).some(([id,p])=>proposed.shifts.find(s=>s.id===id)?.personId!==p)){
     proposed.shifts=weekShifts.map(s=>({...s,personId:fixed[s.id]??null,vacant:fixed[s.id]==null}));
    }
    shifts.push(...proposed.shifts);
   }
   for(const p of people){
    const assigned=shifts.filter(s=>s.personId===p.id).sort((a,b)=>b.date.localeCompare(a.date));
    const last=assigned[0];if(last){let end=Date.parse(last.date+'T'+last.end+':00Z');if(last.end<last.start)end+=86400000;previousEnd.set(p.id,new Date(end).toISOString());}
    previousRest.set(p.id,!assigned.some(s=>s.date===week.at(-1)));previousMode.set(p.id,p.rules.restMode);const work=week.map(d=>assigned.some(s=>s.date===d));previousWrapped.set(p.id,wraps(p.rules,work));previousMask.set(p.id,work.reduce((m,v,i)=>v?m|(1<<i):m,0));
   }
  }
  // Keep original input ordering for backups and exports.
  const ordered=data.shifts.map(s=>shifts.find(x=>x.id===s.id)??{...s,personId:null,vacant:true});
  return review(data,ordered,{searchLimited:limited});
 }
 function assign(data,result,shiftId,personId){
  if(!result)throw Error('Generate a draft before assigning shifts.');
  const next=structuredClone(data);next.schedulingMode='weekly';next.fixedAssignments={...(next.fixedAssignments??{})};
  // Keep existing assignments stable while the manager edits the plan.
  result.shifts.filter(s=>!s.vacant).forEach(s=>next.fixedAssignments[s.id]=s.personId);
  const shifts=result.shifts.map(s=>s.id===shiftId?{...s,personId,vacant:personId===null}:{...s});
  if(!shifts.some(s=>s.id===shiftId))throw Error('Unknown shift.');
  next.fixedAssignments[shiftId]=personId;
  return {input:next,result:review(next,shifts,{manual:true})};
 }
 const api={plan,review,assign,effectiveRule,weeklyMasks};if(typeof module!=='undefined')module.exports=api;else root.Scheduler=api;
})(globalThis);
