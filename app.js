'use strict';
const el = id => document.getElementById(id);
let result = null;
let input = null;
const STORAGE_KEY = 'shift-planner-v1';
let suppressSave = false;
function saveState() {
  if (suppressSave) return;
  try { localStorage.setItem(STORAGE_KEY, PlannerState.encode(input, result)); el('saveStatus').textContent = 'Saved on this device'; }
  catch { el('saveStatus').textContent = 'Automatic saving unavailable. Use Save backup to keep your work.'; }
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name = id => input.people.find(p => p.id === id)?.name || 'VACANT';
function download(filename, body, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([body], {type}));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function invalidate() {
  result = null;
  el('status').textContent = 'Generate a new draft to see the schedule.';
  ['result','roster','stats','totals','message','actionMessage','rulesNotice','personRulesNotice','week'].forEach(id => el(id).textContent = '');
  ['approve','csv'].forEach(id => el(id).disabled = true);
  saveState();
}
function populateWeeks(target, days) {
  el(target).textContent = '';
  for (let i = 0; i < Math.ceil(days.length / 7); i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${days[i*7]} to ${days[Math.min(i*7+6, days.length-1)]}`;
    el(target).append(option);
  }
}
function table(headers, rows) {
  return '<table><thead><tr>' + headers.map(h => '<th scope="col">' + escape(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(v => '<td>' + escape(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
}
function renderAvailability() {
  const days = Planner.validate(input);
  const week = Number(el('availabilityWeek').value || 0);
  const visible = days.slice(week*7, week*7+7);
  el('availability').innerHTML = '<table><thead><tr><th scope="col">Person / ID</th>' + visible.map(d => '<th scope="col">' + escape(d) + '</th>').join('') + '</tr></thead><tbody>' + input.people.map((p, i) => '<tr><td><input type="text" maxlength="80" data-person="' + i + '" aria-label="Name for ' + escape(p.id) + '" value="' + escape(p.name) + '"><small>' + escape(p.id) + (p.cycleAnchor && input.schedulingMode !== 'weekly' ? ' · pattern retained' : '') + '</small><button type="button" class="secondary" data-remove-person="' + i + '" aria-label="Remove ' + escape(p.name) + '">Remove</button></td>' + visible.map(d => '<td><input type="checkbox" data-person="' + i + '" data-date="' + d + '" aria-label="' + escape(p.id + ' available on ' + d) + '" ' + (p.availability[d] ? 'checked' : '') + '></td>').join('') + '</tr>').join('') + '</tbody></table>';
}
function renderPersonRules() {
  const days = Planner.validate(input), start = days[Number(el('personRuleWeek').value || 0)*7];
  const scoped = el('personRuleScope').value === 'week';
  el('personRules').innerHTML = '<table><thead><tr><th>Person</th><th>Rule</th><th>Days off</th><th>Arrangement</th><th>Action</th></tr></thead><tbody>' + input.people.map((p,i) => {
    const own = scoped ? p.weeklyRules?.[start] : p.rules;
    const effective = own || (scoped ? p.rules : null) || Planner.rulesOf(input);
    const kind = !own ? 'inherit' : own.restMode === 'unrestricted' ? 'free' : 'custom';
    return '<tr data-person-rule="'+i+'"><td>'+escape(p.name)+'<small>'+escape(p.id)+(p.weeklyRules ? ' · '+Object.keys(p.weeklyRules).length+' week exceptions' : '')+'</small></td><td><select data-rule-field="kind" aria-label="Rule type for '+escape(p.id)+'">'+[['inherit','Inherit'],['custom','Custom'],['free','No workday target']].map(([value,label])=>'<option value="'+value+'" '+(kind===value?'selected':'')+'>'+label+'</option>').join('')+'</select></td><td><input type="number" min="0" max="7" value="'+(effective.restDays??0)+'" data-rule-field="days" aria-label="Days off for '+escape(p.id)+'" '+(kind!=='custom'?'disabled':'')+' style="width:55px"></td><td><select data-rule-field="mode" aria-label="Rest arrangement for '+escape(p.id)+'" '+(kind!=='custom'?'disabled':'')+'>'+['flexible','consecutive','separated'].map(mode=>'<option value="'+mode+'" '+(effective.restMode===mode?'selected':'')+'>'+mode+'</option>').join('')+'</select></td><td><button type="button" class="secondary" data-save-rule="'+i+'">Save rule for '+escape(p.id)+'</button></td></tr>';
  }).join('')+'</tbody></table>';
}
function renderAssignmentEditor(dates) {
  el('result').innerHTML = '<table><thead><tr><th>Date</th><th>Start</th><th>End</th><th>Assigned person</th><th>Lock</th></tr></thead><tbody>'+result.shifts.filter(s=>dates.has(s.date)).map(s=>'<tr><td>'+escape(s.date)+'</td><td>'+escape(s.start)+'</td><td>'+escape(s.end)+'</td><td><select data-assignment="'+escape(s.id)+'" aria-label="Assign '+escape(s.id)+'"><option value="" '+(s.personId===null?'selected':'')+'>Vacant</option>'+input.people.map(p=>'<option value="'+escape(p.id)+'" '+(s.personId===p.id?'selected':'')+' '+(!p.availability[s.date]?'disabled':'')+'>'+escape(p.name)+(!p.availability[s.date]?' (unavailable)':'')+'</option>').join('')+'</select></td><td>'+(Object.hasOwn(input.fixedAssignments??{},s.id)?'<button type="button" class="secondary" data-unlock="'+escape(s.id)+'">Unlock '+escape(s.id)+'</button>':'Automatic')+'</td></tr>').join('')+'</tbody></table>';
}
function reset() {
  input = Planner.sample(); input.schedulingMode = 'weekly'; invalidate();
  refreshEditors();
}
function refreshEditors() {
  const scrolls = ['availability','shiftEditor'].map(id => ({id,top:el(id).scrollTop,left:el(id).scrollLeft}));
  const days = Planner.validate(input);
  const rules = Planner.rulesOf(input); el('restDays').value = rules.restDays ?? 0; el('restDays').disabled = rules.restMode === 'unrestricted'; el('restMode').value = rules.restMode;
  el('rulesSummary').textContent = (rules.restMode === 'unrestricted' ? 'No weekly workday target' : `${7-rules.restDays} workdays and ${rules.restDays} rest days by default · ${rules.restMode} rest`) + (input.schedulingMode === 'weekly' ? ' · independent weeks; individual overrides available.' : ' · legacy repeating plan; Apply rules to enable independent weeks.');
  el('keepCycles').disabled = input.schedulingMode === 'weekly'; if (el('keepCycles').disabled) el('keepCycles').checked = false;
  ['availabilityWeek','shiftWeek','personRuleWeek'].forEach(target => {const previous = Number(el(target).value || 0); populateWeeks(target, days); el(target).value = Math.min(previous, Math.ceil(days.length / 7) - 1);});
  renderAvailability(); renderShiftEditor(); renderPersonRules();
  scrolls.forEach(({id,top,left}) => {el(id).scrollTop = top; el(id).scrollLeft = left;});
  if (!days.includes(el('newDate').value)) el('newDate').value = days[0];
  el('planStart').value = Planner.add(days.at(-1), 1);
}
function updateModel(candidate) {
  // New calendar days default to available; users can uncheck them before generating.
  const dates = candidate.shifts.map(s => s.date).sort();
  if (!dates.length) throw Error('Keep at least one shift in the plan.');
  for (let d = dates[0], count = 0; d <= dates.at(-1); d = Planner.add(d, 1)) {
    if (++count > 35) throw Error('Maximum 35 days per plan.');
    for (const person of candidate.people) if (typeof person.availability[d] !== 'boolean') person.availability[d] = true;
  }
  Planner.validate(candidate);
  input = candidate; invalidate(); refreshEditors();
}
function editModel(change) {
  try { const candidate = structuredClone(input); change(candidate); updateModel(candidate); return true; }
  catch (error) { el('message').textContent = error.message; refreshEditors(); return false; }
}
function renderShiftEditor() {
  const days = Planner.validate(input), week = Number(el('shiftWeek').value || 0);
  const visible = new Set(days.slice(week*7, week*7+7));
  el('shiftEditor').innerHTML = '<table><thead><tr><th>ID</th><th>Date</th><th>Start</th><th>End</th><th>Action</th></tr></thead><tbody>' + input.shifts.map((s, i) => visible.has(s.date) ? '<tr><td>' + escape(s.id) + '</td>' + ['date','start','end'].map(field => '<td><input type="' + (field === 'date' ? 'date' : 'time') + '" data-shift="' + i + '" data-field="' + field + '" aria-label="' + escape(s.id + ' ' + field) + '" value="' + escape(s[field]) + '"></td>').join('') + '<td><button type="button" class="secondary" data-remove-shift="' + i + '" aria-label="Remove shift ' + escape(s.id) + '">Remove</button></td></tr>' : '').join('') + '</tbody></table>';
}
function render() {
  const week = Number(el('week').value || 0);
  const days = result.days.slice(week*7, week*7+7);
  const dates = new Set(days);
  el('status').textContent = result.status === 'approved' ? 'APPROVED · complete plan' : 'DRAFT · review before approval';
  el('stats').textContent = `${result.shifts.length-result.uncovered.length}/${result.shifts.length} shifts covered · ${result.uncovered.length} uncovered`;
  el('roster').innerHTML = table(['Person', ...days], input.people.map(p => [p.name, ...days.map(date => {
    const shift = result.shifts.find(s => s.date === date && s.personId === p.id);
    const pattern = result.patterns.find(c => c.personId === p.id);
    return shift ? shift.start + '–' + shift.end : result.unassignedPeople.some(issue => issue.id === p.id && (!issue.weekStart || issue.weekStart === result.days[Math.floor(result.days.indexOf(date)/7)*7])) ? 'Check rules' : 'REST';
  })]));
  renderAssignmentEditor(dates);
  el('totals').innerHTML = table(['Person','Workdays','Hours','Cycle'], input.people.map(p => {
    const shifts = result.shifts.filter(s => s.personId === p.id);
    const hours = shifts.reduce((sum, s) => {
      const minutes = t => Number(t.slice(0,2))*60 + Number(t.slice(3));
      return sum + ((minutes(s.end)-minutes(s.start)+1440)%1440)/60;
    }, 0);
    return [p.name,shifts.length,Math.round(hours*100)/100,input.schedulingMode === 'weekly' ? 'Individual / weekly' : (p.rules?.restMode === 'unrestricted' ? 'No target' : `${7-Planner.rulesOf({rules:p.rules??Planner.rulesOf(input)}).restDays} work / ${Planner.rulesOf({rules:p.rules??Planner.rulesOf(input)}).restDays} rest`)];
  }));
  el('message').textContent = [
    ...result.unassignedPeople.map(p => name(p.id) + ': ' + p.reason),
    ...(result.uncovered.length ? ['Uncovered shifts: this proposal cannot cover every position while respecting the scheduling rules.'] : []),
    ...(result.searchLimited ? ['Search limit reached: the draft respects the rules, but a better solution may exist.'] : [])
  ].join('\n');
  el('approve').disabled = result.status === 'approved' || !!result.uncovered.length || !!result.unassignedPeople.length;
  el('csv').disabled = false;
  saveState();
}
el('generate').onclick = () => {
  invalidate();
  try { result = Scheduler.plan(input); populateWeeks('week', result.days); render(); }
  catch (error) { el('message').textContent = error instanceof SyntaxError ? 'Invalid data. Restore a backup or reset the example.' : error.message; }
};
el('availability').onchange = event => {
  const control = event.target;
  if (!control.matches('input')) return;
  const person = input.people[Number(control.dataset.person)];
  let released = false;
  if (control.type === 'checkbox') {person.availability[control.dataset.date] = control.checked; if (!control.checked) for (const [id,personId] of Object.entries(input.fixedAssignments??{})) if (personId === person.id && input.shifts.find(s=>s.id===id)?.date === control.dataset.date) {delete input.fixedAssignments[id];released = true;}}
  else {
    if (!control.value.trim()) {control.value = person.name; return;}
    person.name = control.value.trim();
    control.closest('tr').querySelector('button').setAttribute('aria-label', 'Remove ' + person.name);
  }
  invalidate();
  if (released) el('message').textContent = 'Marked unavailable. Manual assignments for this person on that day were unlocked; regenerate the draft.';
};
el('availability').oninput = event => {if (event.target.type === 'text' && event.target.value.trim()) el('availability').onchange(event);};
el('availabilityWeek').onchange = renderAvailability;
el('approve').onclick = () => { try {result = Planner.approve(result); for (const person of input.people) {const pattern = result.patterns.find(p => p.personId === person.id); if (input.schedulingMode !== 'weekly' && pattern.workMask !== null) {person.cycleAnchor = result.days[0]; person.cycleMask = pattern.workMask;}} renderAvailability(); render();} catch (error) {el('message').textContent = error.message;} };
el('week').onchange = () => {if (result) render();};
el('restMode').onchange = () => {el('restDays').disabled = el('restMode').value === 'unrestricted';};
el('rulesForm').onsubmit = event => {
  event.preventDefault();
  const success = editModel(data => {
    const next = Planner.rulesOf({rules:{restDays:Number(el('restDays').value),restMode:el('restMode').value}});
    data.schedulingMode = 'weekly';
    if (JSON.stringify(next) !== JSON.stringify(Planner.rulesOf(data))) {
      data.rules = next;
      data.people.forEach(person => {delete person.cycleAnchor; delete person.cycleMask;});
    }
  });
  el('rulesNotice').textContent = success ? 'Defaults applied. Generate a new draft. Individual overrides are preserved; weeks are independent.' : el('message').textContent;
};
el('reset').onclick = reset;

el('inputDownload').onclick = () => download('shift-planner-backup.json', PlannerState.encode(input, result));
// Prefix potentially executable spreadsheet cells when exporting user-supplied text.
const csvCell = value => '"' + (/^[=+@\-\t\r\n]/.test(String(value)) ? "'" : '') + String(value).replace(/"/g, '""') + '"';
el('csv').onclick = () => {
  const rows = [['id','date','start','end','personId','name','vacant','status'], ...result.shifts.map(s => [s.id,s.date,s.start,s.end,s.personId || '',input.people.find(p => p.id === s.personId)?.name || '',s.vacant,result.status])];
  download('schedule.csv', '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
};
el('availability').onclick = event => {
  const button = event.target.closest('[data-remove-person]');
  if (button) editModel(data => { const [removed] = data.people.splice(Number(button.dataset.removePerson), 1); for (const [id,personId] of Object.entries(data.fixedAssignments??{})) if (personId === removed.id) delete data.fixedAssignments[id]; });
};
el('addPerson').onsubmit = event => {
  event.preventDefault();
  const fullName = el('newName').value.trim();
  if (!fullName) return;
  editModel(data => {
    let n = 1; while (data.people.some(p => p.id === 'P' + n)) n++;
    data.people.push({id: 'P' + n, name: fullName, availability: {}});
  });
  el('newName').value = '';
};
el('addShift').onsubmit = event => {
  event.preventDefault();
  editModel(data => {
    const count = Number(el('newCount').value);
    if (!Number.isInteger(count) || count < 1 || count > 10) throw Error('Choose 1 to 10 positions.');
    for (let i = 0; i < count; i++) {
      let n = 1; while (data.shifts.some(s => s.id === 'NEW-' + n)) n++;
      data.shifts.push({id: 'NEW-' + n, date: el('newDate').value, start: el('newStart').value, end: el('newEnd').value, vacant: true, personId: null});
    }
  });
};
el('shiftEditor').onchange = event => {
  const control = event.target;
  if (control.matches('input')) editModel(data => {data.shifts[Number(control.dataset.shift)][control.dataset.field] = control.value;});
};
el('shiftEditor').onclick = event => {
  const button = event.target.closest('[data-remove-shift]');
  if (button) editModel(data => {const [removed] = data.shifts.splice(Number(button.dataset.removeShift), 1); if(data.fixedAssignments) delete data.fixedAssignments[removed.id];});
};
el('shiftWeek').onchange = renderShiftEditor;
el('inputFile').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    restoreState(PlannerState.decode(await file.text()));
    el('message').textContent = 'Backup restored.'; el('actionMessage').textContent = 'Backup restored, including its saved draft or approval.';
  } catch (error) { el('actionMessage').textContent = error instanceof SyntaxError ? 'Invalid backup. Choose a file created with Save backup.' : error.message; }
  event.target.value = '';
};
function restoreState(saved) {
  input = saved.input; invalidate(); refreshEditors();
  result = saved.result;
  if (result) {populateWeeks('week', result.days); render();}
  saveState();
}
el('newPlan').onsubmit = event => {
  event.preventDefault();
  try {
    const next = Planner.newPeriod(input, result, {
      start: el('planStart').value, weeks: Number(el('planWeeks').value),
      shiftStart: el('planShiftStart').value, shiftEnd: el('planShiftEnd').value,
      positions: Number(el('planPositions').value), keepCycles: el('keepCycles').checked
    });
    updateModel(next);
    const days = Planner.validate(input); el('actionMessage').textContent = `Plan created: ${days[0]} to ${days.at(-1)}, ${input.shifts.length} positions. Review availability below, then generate a draft.`;
  } catch (error) { el('actionMessage').textContent = error.message; }
};
el('clearSaved').onclick = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    suppressSave = true; reset(); suppressSave = false;
    el('saveStatus').textContent = 'Saved data cleared. The example is shown; your next change will be saved.';
  } catch { suppressSave = false; el('saveStatus').textContent = 'Browser storage is unavailable.'; }
};
el('personRuleScope').onchange = renderPersonRules;
el('personRuleWeek').onchange = renderPersonRules;
el('personRules').onchange = event => {
  if (!event.target.matches('[data-rule-field="kind"]')) return;
  const row = event.target.closest('tr');
  row.querySelectorAll('[data-rule-field="days"],[data-rule-field="mode"]').forEach(control => control.disabled = event.target.value !== 'custom');
};
el('personRules').onclick = event => {
  const button = event.target.closest('[data-save-rule]');
  if (!button) return;
  const index = Number(button.dataset.saveRule), row = button.closest('tr');
  const kind = row.querySelector('[data-rule-field="kind"]').value;
  const rule = kind === 'inherit' ? null : kind === 'free' ? {restDays:null,restMode:'unrestricted'} : {restDays:Number(row.querySelector('[data-rule-field="days"]').value || NaN),restMode:row.querySelector('[data-rule-field="mode"]').value};
  const start = Planner.validate(input)[Number(el('personRuleWeek').value || 0)*7];
  const success = editModel(data => {
    if (rule) Planner.rulesOf({rules:rule});
    data.schedulingMode = 'weekly';
    const person = data.people[index]; delete person.cycleAnchor; delete person.cycleMask;
    if (el('personRuleScope').value === 'week') {
      person.weeklyRules ??= {};
      if (rule) person.weeklyRules[start] = rule; else delete person.weeklyRules[start];
    } else {
      delete person.weeklyRules;
      if (rule) person.rules = rule; else delete person.rules;
    }
  });
  el('personRulesNotice').textContent = success ? 'Rule saved. Generate a new draft; existing manual locks will be respected.' : el('message').textContent;
};
el('result').onchange = event => {
  const control = event.target;
  if (!control.matches('[data-assignment]')) return;
  try {
    const changed = Scheduler.assign(input,result,control.dataset.assignment,control.value || null);
    input = changed.input; result = changed.result; refreshEditors(); render();
  } catch (error) {
    render(); el('message').textContent = error.message;
  }
};
el('result').onclick = event => {
  const button = event.target.closest('[data-unlock]');
  if (!button) return;
  delete input.fixedAssignments[button.dataset.unlock];
  if (input.schedulingMode === 'weekly') result = Scheduler.review(input,result.shifts,{manual:true});
  render();
};
el('releaseLocks').onclick = () => {
  delete input.fixedAssignments;
  if (!result) {invalidate(); el('message').textContent = 'Manual locks released. Generate a new draft.'; return;}
  if (input.schedulingMode === 'weekly') result = Scheduler.review(input,result.shifts,{manual:true});
  render(); el('message').textContent = 'Manual locks released. Generate a new draft to recalculate assignments.';
};
function boot() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text) {restoreState(PlannerState.decode(text)); return;}
  } catch {
    reset(); el('saveStatus').textContent = 'Saved data could not be loaded. The example is shown. Use Restore backup if needed.'; return;
  }
  reset();
}
boot();
