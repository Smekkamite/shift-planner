# Shift Planner — 4 workdays / 3 rest days

A small, dependency-free scheduling demo for an operations and administrative support portfolio. Matches people to vacant shifts using daily availability, a continuous four-days-on / three-days-off cycle, and manager approval.

## Quick start

Download the repository ZIP, extract it and open **index.html** in a browser. Click **Generate draft**, review the roster and click **Approve plan**. No installation is needed. Direct opening has been manually confirmed in Brave.

## Background

This is a rebuilt demonstration inspired by a scheduling workflow Alex Campigotto originally created while managing a bar team in Brussels. This implementation is new; it is not the original production workflow. All names, IDs, dates and shifts are synthetic.

## Run

Open `index.html` in a modern browser. No installation, account or server is required. Data stays in the browser. Changes and approvals are automatically saved in local browser storage when available. Check the save status. Browser privacy settings, private browsing, clearing storage or moving the app folder can affect persistence, especially when opening via file://. Use Save backup for a portable copy.

1. Use the example or edit names directly in the people table. IDs are generated automatically when adding people.
2. Tick or untick daily availability; switch weeks with **Availability week**.
3. Use **Add person** and the **Remove** buttons to manage the team.
4. Expand **Manage shifts** to add positions, edit dates and times, or remove shifts. Multiple positions on the same date are separate shifts.
5. Click **Generate draft**. Review the weekly person-by-day roster, rest days, shift details and full-period totals.
6. Click **Approve plan** once the plan is complete. Any data change clears the previous draft and approval.
7. Use **Export CSV** for spreadsheet output. Incomplete plans can be exported as drafts but cannot be approved.
8. Use **Save backup** to save the editable data, cycle anchors and current draft or approval together. **Restore backup** reopens that file; no manual JSON editing is needed. Older input-only files are also accepted.
9. Expand **New plan**, choose the start date, 1–5 weeks, usual shift hours and the number of people needed each day. Creating it replaces current shifts and keeps the current team. Save a backup first to archive the old period. Additional shift times can be edited under Manage shifts.
10. Keep **Keep existing 4+3 cycles** checked to retain approved cycles. Uncheck it to allow new patterns. **Clear saved data** removes the local save and displays the example; the next edit or generation resumes autosaving.

The English interface includes fictional international team members: Amelia Brooks, Mateo García, Amina Hassan, Kenji Tanaka, Chloé Dubois, Liam O’Connor and Priya Sharma.

The example should cover all 112 shifts, assigning 16 working days and 128 hours to each person. Evening shifts run 16:00–00:00 and 18:00–02:00.

## Data format (developer reference only)

```json
{
  "people": [{
    "id": "P1",
    "name": "Amelia Brooks",
    "availability": {"2026-11-02": true}
  }],
  "shifts": [{
    "id": "S1",
    "date": "2026-11-02",
    "start": "18:00",
    "end": "02:00",
    "vacant": true,
    "personId": null
  }]
}
```

This illustrates the schema, not a full weekly dataset. Use the bundled `sample-data.json` for a complete example. Every person must have an explicit boolean availability for every calendar day between the first and last shift. Unavailable is different from resting: the scheduler determines rest days.

Each shift is one position. For four people on the same hours, create four shifts with unique IDs. Input shifts must be vacant. Regeneration creates a new proposal from the input, rather than preserving previous assignments.

## Scheduling rules

- One shift per person per calendar day.
- A person receives a repeating 7-day pattern: 4 consecutive workdays followed by 3 consecutive rest days. There are 7 possible offsets; the scheduler chooses one per person.
- The pattern continues across week boundaries. The visible horizon may start or end partway through a block; days outside it are not scheduled or checked. Approving a plan stores a cycle anchor for each person. New plans retain these anchors by default, including when the next period starts midweek. Unavailability that conflicts with a retained cycle is reported rather than silently shifting rest days. An overlapping new period is rejected when continuing an approved plan. A gap between periods preserves the theoretical pattern but is not scheduled or checked.
- Each active day in a person's pattern must have availability and a vacant position. Partial work blocks are not used to hide a conflict. A single incompatible day can therefore leave a person unassigned for the entire period; the UI explains this limitation.
- The search maximizes covered positions within those rules. People without a feasible pattern are reported rather than forced into an invalid assignment.
- Backtracking across patterns and actual shift assignments is bounded to 250,000 visited nodes, 10 people, 35 days and 350 shift positions. When the search limit is hit, the app reports that optimal coverage is not guaranteed. This is a small-team demo, not a large-scale optimizer.
- Actual shift assignments are checked for temporal overlaps, including overnight shifts. This does not enforce a minimum rest interval.
- Overnight shifts belong to their start date. Hours are calculated modulo 24; shifts must be shorter than 24 hours. Times are wall-clock values, without timezone or daylight-saving calculations.

The phase is relative to the first date in `days`: a person works when `(dayIndex - phase + 7) % 7 < 4`.

## Scope

Manager approval is a local saved status, not an authenticated audit trail. Editing input invalidates the current proposal. Exports retain draft/approved status. There is no direct Google Sheets connection, payroll processing, automatic notification, drag-and-drop reassignment, minimum rest-time enforcement, skill matching or legal compliance engine. Shift lengths and total hours are displayed, not optimized. All staff are assumed equally qualified for all example shifts.

## Tests

With Node.js 18+:

```sh
node --test test.js
```

28 automated tests cover full sample coverage, continuous cycles, constrained availability, staffing shortages, oversupply, duplicate IDs, missing availability, malformed shifts, overnight overlaps, input immutability and approval restrictions. An independent exhaustive oracle checks optimal coverage on 60 small deterministic random datasets and 30 further datasets with overnight assignment constraints. Tests also cover period creation, continuity, previous overnight shifts, backup restoration and malformed backups. See `VALIDATION.md` for browser checks.

## Files

- `index.html`: English-language local interface with forms, availability checkboxes and a weekly roster.
- `planner.js`: pure scheduling engine, usable in Node.js or the browser.
- `app.js`: form-based editing, automatic local saving, backup/restore, new plans, review, approval and CSV export.
- `state.js`: versioned backup encoding and validation on restoration.
- `sample-data.json`: synthetic input data.
- `test.js`: automated tests using the Node.js standard library.

No external dependencies or external API calls.
