const {test}=require('node:test');const assert=require('node:assert/strict');const P=require('./planner.js');
const State=require('./state.js');
function verify(data,r){const days=P.validate(data);for(const p of data.people){const assigned=r.shifts.filter(s=>s.personId===p.id).sort((a,b)=>a.date.localeCompare(b.date)),pattern=r.patterns.find(c=>c.personId===p.id);assert.equal(new Set(assigned.map(s=>s.date)).size,assigned.length);let previousEnd=-Infinity;for(const s of assigned){assert.equal(p.availability[s.date],true);const start=Date.parse(s.date+'T'+s.start+':00Z');let end=Date.parse(s.date+'T'+s.end+':00Z');if(end<start)end+=86400000;assert.ok(start>=previousEnd,'Overlapping shifts');previousEnd=end;}if(pattern.phase!==null)for(let i=0;i<days.length;i++)assert.equal(assigned.some(s=>s.date===days[i]),(i-pattern.phase+7)%7<4); }assert.equal(new Set(r.shifts.map(s=>s.id)).size,data.shifts.length);}
test('28 days: complete coverage, 16 workdays and continuous 4+3 for everyone',()=>{const d=P.sample(),r=P.plan(d);verify(d,r);assert.equal(r.uncovered.length,0);assert.equal(r.unassignedPeople.length,0);for(const p of d.people)assert.equal(r.shifts.filter(s=>s.personId===p.id).length,16);assert.equal(P.approve(r).status,'approved');assert.equal(r.status,'draft');});
test('availability forces a specific cycle across week boundaries',()=>{const d=P.sample();d.people=d.people.slice(0,1);d.shifts=d.shifts.filter(s=>s.id.endsWith('-1'));d.people[0].availability=Object.fromEntries(Object.keys(d.people[0].availability).map((date,i)=>[date,(i-5+7)%7<4]));const r=P.plan(d);verify(d,r);assert.equal(r.patterns[0].phase,5);assert.equal(r.shifts.filter(s=>!s.vacant).length,16);});
test('unavailable employee is never scheduled; incomplete approval rejected',()=>{const d=P.sample();for(const key in d.people[0].availability)d.people[0].availability[key]=false;const r=P.plan(d);verify(d,r);assert.ok(r.uncovered.length>0);assert.ok(r.unassignedPeople.some(p=>p.id==='P1'));assert.throws(()=>P.approve(r),/Incomplete/);});
test('capacity shortage produces uncovered shifts without breaking cycles',()=>{const d=P.sample();d.people=d.people.slice(0,3);const r=P.plan(d);verify(d,r);assert.equal(r.uncovered.length,64);});
test('oversupply leaves people unassigned, never double books shifts',()=>{const d=P.sample();d.shifts=d.shifts.filter(s=>s.id.endsWith('-1'));const r=P.plan(d);verify(d,r);assert.ok(r.unassignedPeople.length>0);});
test('missing availability and duplicate IDs are rejected',()=>{let d=P.sample();delete d.people[0].availability['2026-11-02'];assert.throws(()=>P.plan(d),/Missing/);d=P.sample();d.people[1].id=d.people[0].id;assert.throws(()=>P.plan(d),/duplicate/);d=P.sample();d.shifts[1].id=d.shifts[0].id;assert.throws(()=>P.plan(d),/duplicate/);});
test('invalid dates, hours and preassigned shifts are rejected',()=>{for(const change of [{date:'2026-02-30'},{start:'25:00'},{end:'16:00'},{vacant:false,personId:'P1'}]){const d=P.sample();Object.assign(d.shifts[0],change);assert.throws(()=>P.plan(d));}});
test('overnight shifts retain their original start date and times',()=>{const d=P.sample(),r=P.plan(d);assert.ok(r.shifts.some(s=>s.start==='18:00'&&s.end==='02:00'));assert.deepEqual(r.shifts.map(({id,date,start,end})=>({id,date,start,end})),d.shifts.map(({id,date,start,end})=>({id,date,start,end})));});
test('zero capacity on a workday blocks incompatible cycle',()=>{const d=P.sample();d.people=d.people.slice(0,1);d.shifts=d.shifts.filter(s=>s.date!=='2026-11-05');for(const date in d.people[0].availability){const i=Object.keys(d.people[0].availability).indexOf(date);d.people[0].availability[date]=i%7<4;}const r=P.plan(d);assert.equal(r.patterns[0].phase,null);});
test('overlapping overnight shifts cannot be assigned to one person',()=>{const d=P.sample();d.people=d.people.slice(0,1);d.shifts=d.shifts.filter(s=>s.id.endsWith('-1'));for(const s of d.shifts){s.start='23:00';s.end='22:00';}d.shifts[1].start='01:00';const r=P.plan(d);verify(d,r);const first=r.shifts.find(s=>s.date==='2026-11-02'&&!s.vacant),second=r.shifts.find(s=>s.date==='2026-11-03'&&!s.vacant);assert.ok(!(first&&second));});
test('inputs are not mutated, results are repeatable and approval cannot be repeated',()=>{const d=P.sample(),before=JSON.stringify(d);const a=P.plan(d),b=P.plan(d);assert.equal(JSON.stringify(d),before);assert.deepEqual(a,b);assert.throws(()=>P.approve(P.approve(a)),/draft/);});
test('malformed records fail with clear validation errors',()=>{for(const value of [null,{}, {people:[null],shifts:[]}, {people:[],shifts:[null]}])assert.throws(()=>P.plan(value),/Input|Invalid|shift/);});
test('coverage matches independent brute-force oracle on 60 small random datasets',()=>{
 let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let trial=0;trial<60;trial++){
  const dates=Array.from({length:7},(_,i)=>P.add('2026-11-02',i));
  const people=Array.from({length:3},(_,i)=>({id:'R'+i,name:'Example '+i,availability:Object.fromEntries(dates.map(d=>[d,random()>.12]))}));
  const capacities=dates.map(()=>Math.floor(random()*3)+1);
  const shifts=dates.flatMap((date,i)=>Array.from({length:capacities[i]},(_,j)=>({id:i+'-'+j,date,start:'16:00',end:'00:00',personId:null,vacant:true})));
  const d={people,shifts};let maximum=0;
  for(let a=-1;a<7;a++)for(let b=-1;b<7;b++)for(let c=-1;c<7;c++){
   const phases=[a,b,c],used=dates.map(()=>0);let valid=true,total=0;
   phases.forEach((phase,p)=>{if(phase<0)return;dates.forEach((date,i)=>{if((i-phase+7)%7<4){used[i]++;total++;if(!people[p].availability[date])valid=false;}});});
   if(valid&&used.every((n,i)=>n<=capacities[i]))maximum=Math.max(maximum,total);
  }
  const result=P.plan(d);verify(d,result);assert.equal(result.searchLimited,false);assert.equal(shifts.length-result.uncovered.length,maximum);
 }
});
const settings=(extra={})=>({start:'2026-11-30',weeks:4,shiftStart:'18:00',shiftEnd:'02:00',positions:4,keepCycles:true,...extra});
test('new plan creates selected dates, hours and capacity without mutating the old plan',()=>{const d=P.sample(),before=JSON.stringify(d),next=P.newPeriod(d,null,settings());assert.equal(next.shifts.length,112);assert.equal(next.shifts[0].date,'2026-11-30');assert.equal(next.shifts.at(-1).date,'2026-12-27');assert.ok(next.shifts.every(s=>s.start==='18:00'&&s.end==='02:00'));assert.equal(JSON.stringify(d),before);verify(next,P.plan(next));});
test('approved cycles remain continuous over arbitrary period boundaries',()=>{const d=P.sample(),approved=P.approve(P.plan(d)),next=P.newPeriod(d,approved,settings({start:'2026-12-02'})),r=P.plan(next);assert.equal(r.uncovered.length,0);for(const p of next.people){const old=approved.patterns.find(x=>x.personId===p.id);for(let i=0;i<r.days.length;i++){const delta=Math.round((Date.parse(r.days[i])-Date.parse(approved.days[0]))/86400000);assert.equal(r.shifts.some(s=>s.personId===p.id&&s.date===r.days[i]),(delta-old.phase+7)%7<4);}}verify(next,r);});
test('unavailability conflicts with retained cycle instead of silently moving rest days',()=>{const d=P.sample(),a=P.approve(P.plan(d)),next=P.newPeriod(d,a,settings());const r=P.plan(next),work=r.shifts.find(s=>s.personId==='P1');next.people[0].availability[work.date]=false;const conflict=P.plan(next);assert.equal(conflict.patterns[0].phase,null);assert.ok(conflict.unassignedPeople.some(p=>p.id==='P1'));});
test('cycle retention can be disabled and new staff receive a fresh cycle',()=>{const d=P.sample(),a=P.approve(P.plan(d)),next=P.newPeriod(d,a,settings({keepCycles:false}));assert.ok(next.people.every(p=>!p.cycleAnchor));const p={id:'P8',name:'Fatima Al-Mansouri',availability:{...d.people[0].availability}};d.people.push(p);const continued=P.newPeriod(d,a,settings());assert.equal(continued.people.at(-1).cycleAnchor,undefined);});
test('new plan validates dates, lengths and hours; retained periods cannot overlap',()=>{const d=P.sample(),a=P.approve(P.plan(d));for(const extra of [{start:'2026-02-30'},{weeks:0},{weeks:6},{positions:0},{shiftEnd:'18:00'},{start:'2026-11-20'}])assert.throws(()=>P.newPeriod(d,a,settings(extra)));});
test('backups round-trip draft, approval, availability and cycle anchors',()=>{const d=P.sample(),draft=P.plan(d);assert.deepEqual(State.decode(State.encode(d,draft)),{input:d,result:draft});const approved=P.approve(draft);for(const p of d.people)p.cycleAnchor=P.add(approved.days[0],approved.patterns.find(x=>x.personId===p.id).phase);const restored=State.decode(State.encode(d,approved));assert.equal(restored.result.status,'approved');assert.deepEqual(restored.input,d);assert.deepEqual(restored.result,approved);assert.equal(State.decode(State.encode(d,null)).result,null);});
test('legacy source files restore; malformed or inconsistent backups are rejected',()=>{const d=P.sample();assert.deepEqual(State.decode(JSON.stringify(d)),{input:d,result:null});assert.throws(()=>State.decode('{'));const saved=JSON.parse(State.encode(d,P.plan(d)));saved.result.shifts[0].personId='FAKE';assert.throws(()=>State.decode(JSON.stringify(saved)),/does not match/);});
test('an overnight shift in the previous approved period cannot overlap the next plan',()=>{const d=P.sample(),a=P.approve(P.plan(d)),next=P.newPeriod(d,a,settings({shiftStart:'01:00',shiftEnd:'09:00',weeks:1})),r=P.plan(next);const boundary=Date.parse('2026-11-30T01:00:00Z');const blocked=next.people.filter(p=>p.previousShiftEnd&&Date.parse(p.previousShiftEnd)>boundary);assert.ok(blocked.length>0);for(const p of blocked)assert.ok(!r.shifts.some(s=>s.date==='2026-11-30'&&s.personId===p.id));verify(next,r);});
test('empty team and wholly unavailable team produce a safe incomplete draft',()=>{for(const empty of [true,false]){const d=P.sample();if(empty)d.people=[];else d.people.forEach(p=>Object.keys(p.availability).forEach(date=>p.availability[date]=false));const r=P.plan(d);assert.equal(r.uncovered.length,112);assert.throws(()=>P.approve(r),/Incomplete/);assert.deepEqual(State.decode(State.encode(d,r)).result,r);}});
test('leap days, month and year boundaries keep exact calendar lengths',()=>{for(const start of ['2028-02-20','2026-12-20']){const d=P.newPeriod(P.sample(),null,settings({start,weeks:5}));assert.equal(P.validate(d).length,35);assert.equal(d.shifts.at(-1).date,P.add(start,34));verify(d,P.plan(d));}});
test('invalid anchors, previous times and oversized data are rejected',()=>{for(const extra of [{cycleAnchor:'2026-02-30'},{cycleAnchor:'oops'},{previousShiftEnd:'oops'}]){const d=P.sample();Object.assign(d.people[0],extra);assert.throws(()=>P.plan(d),/Invalid/);}const d=P.sample();while(d.shifts.length<351)d.shifts.push({...d.shifts[0],id:'extra'+d.shifts.length});assert.throws(()=>P.plan(d),/350/);});
test('backup decoder handles BOM and rejects null, arrays and unknown versions clearly',()=>{const d=P.sample();assert.deepEqual(State.decode('\uFEFF'+State.encode(d,null)),{input:d,result:null});for(const text of ['null','[]','1','{"version":2}'])assert.throws(()=>State.decode(text),/backup/);});
test('international and special-character names survive approval and backups',()=>{const d=P.sample();d.people[0].name='Zoë Müller 李 <example> "name"';const r=P.approve(P.plan(d));assert.equal(State.decode(State.encode(d,r)).input.people[0].name,d.people[0].name);});
test('maximum supported roster and horizon return a valid result',()=>{const d=P.sample();for(let i=8;i<=10;i++)d.people.push({id:'P'+i,name:'Person '+i,availability:{...d.people[0].availability}});const next=P.newPeriod(d,null,settings({weeks:5,positions:10})),r=P.plan(next);verify(next,r);assert.equal(next.shifts.length,350);assert.equal(r.shifts.filter(s=>!s.vacant).length,200);assert.equal(r.searchLimited,false);});
test('overnight coverage matches an independent assignment oracle on 30 random datasets',()=>{
 let seed=87;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let trial=0;trial<30;trial++){
  const dates=Array.from({length:7},(_,i)=>P.add('2026-11-02',i));
  const people=Array.from({length:2},(_,i)=>({id:'T'+i,name:'Person '+i,availability:Object.fromEntries(dates.map(d=>[d,random()>.08]))}));
  const shifts=dates.flatMap((date,i)=>Array.from({length:1+Math.floor(random()*2)},(_,j)=>{const late=random()>.5;return {id:i+'-'+j,date,start:late?'22:00':'01:00',end:late?'04:00':'09:00',personId:null,vacant:true};}));
  let best=0;
  for(let a=-1;a<7;a++)for(let b=-1;b<7;b++){
   const phases=[a,b],last=[-Infinity,-Infinity];let total=0;
   function visit(day){
    if(day===7)return true;
    const workers=phases.map((phase,p)=>phase>=0&&(day-phase+7)%7<4?p:-1).filter(p=>p>=0);
    if(workers.some(p=>!people[p].availability[dates[day]]))return false;
    const slots=shifts.filter(s=>s.date===dates[day]),used=new Set();
    function assign(k){if(k===workers.length)return visit(day+1);const p=workers[k];for(let j=0;j<slots.length;j++){if(used.has(j))continue;const s=slots[j],start=day*1440+(s.start==='22:00'?1320:60),end=day*1440+(s.end==='04:00'?1680:540);if(last[p]>start)continue;const old=last[p];last[p]=end;used.add(j);if(assign(k+1))return true;last[p]=old;used.delete(j);}return false;}
    return assign(0);
   }
   phases.forEach(phase=>{if(phase>=0)total+=4;});if(total>best&&visit(0))best=total;
  }
  const d={people,shifts},r=P.plan(d);verify(d,r);assert.equal(r.searchLimited,false);assert.equal(shifts.length-r.uncovered.length,best);
 }
});
