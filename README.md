# Shift Planner

A small local staff scheduler with individual and week-specific rules, unrestricted workday targets, editable assignments, daily availability, approval and portable backups. No installation, account or external service is required.

## Quick start

Download the repository ZIP, extract it and open **index.html** in your browser. Direct opening was manually confirmed in Brave for the previous version; the updated version uses the same local-script approach. Automated browser checks use localhost.

1. Set team defaults with **Days off per week** and **Rest arrangement**, then click **Apply rules**. These are defaults, not mandatory rules for everyone.
2. Edit names, add/remove people and tick daily availability. Checked means available, not necessarily scheduled.
3. Expand **Manage shifts** to change dates, times and staffing demand, or use **New plan** to create a fresh period.
4. Open **Individual & weekly rules** to set each person’s default or an exception for the selected week. **No workday target** removes the workday-count requirement.
5. Click **Generate draft**. Open **Edit assignments & uncovered positions** to change assignments directly. Check messages, then **Approve plan** when complete.
6. Use **Export CSV** for a spreadsheet or **Save backup** to preserve editable data and approval. **Restore backup** reopens a saved copy.

The default example has seven fictional international team members, 28 days, five positions per day, and five workdays plus two rest days per person. It covers **140/140 positions**, with **20 workdays / 160 hours** per person. The original four-work / three-rest arrangement remains available by choosing three days off and consecutive rest.

## Weekly rules

For a targeted rule, choose 0–7 rest days; workdays are `7 - restDays`. Choose No workday target to remove that count requirement.

| Rest arrangement | Meaning |
| --- | --- |
| Flexible | Rest days may be together or split; no grouping constraint. |
| Consecutive | All rest days form one continuous block, including across week boundaries. |
| Separated | No two rest days touch, including across week boundaries. At most three rest days fit in a seven-day weekly template. |
| No workday target | Any workday count is allowed. Availability, manual locks, one-shift-per-day and overlap checks still apply. |

New plans use **independent weeks**. A person’s rules can differ from the team default, and one week can differ from that person’s usual rule. Rules are resolved in this order: selected-week override, person default, team default.

In **Individual & weekly rules**, choose **All weeks** to set a person’s default and clear their dated exceptions, or **Selected week only** for a dated override. **Inherit** removes the rule at that scope; a week then falls back to the person default, and a person falls back to the team default. **Custom** sets rest count/grouping. **No workday target** permits any workday count.

Each week is a seven-day block starting from the first date of the planning horizon. Weeks are scheduled in sequence, using availability and actual capacity. Their arrangements may change. Grouping is checked across internal week boundaries; days outside the horizon and unscheduled gaps are not inferred. This is not a global multiweek optimizer. An impossible target can leave a person unassigned in that week, without discarding their other weeks. Partial weeks are checked against the visible part of a valid template. Uncovered positions or rule conflicts block approval.

Older repeating-plan backups remain supported. Use **Apply rules** or save an individual rule to switch one to independent weeks.

Changing rules clears the draft/approval but preserves manual locks. Team changes preserve individual overrides. The summary identifies the planning mode; older repeating patterns remain labelled when applicable.

## New periods and continuity

**New plan** chooses a start date, 1–5 weeks, usual start/end times and daily positions. It retains your team and replaces current shifts. Save a backup first if you need an archive.

Individual defaults carry over into new periods. Dated weekly overrides and manual locks belong to the current period and do not carry over. Save a backup to archive them. In independent-week mode, the old **Keep existing weekly patterns** control is disabled: weeks are free to change. The last approved overnight boundary is retained to avoid overlapping shifts. Rest grouping across separate periods or unscheduled gaps is not inferred.

## Manual editing and locks

Open **Edit assignments & uncovered positions**, then select a person or **Vacant** for a shift. A manual edit switches to independent-week mode, keeps existing assignments stable and locks them against regeneration. A vacant position can also be locked. Individual **Unlock** buttons and **Release all manual locks** let the generator recalculate.

To swap two people who already work that day, first make one shift vacant, then reassign. An edit that violates a workday target is retained as a draft and flagged; change the individual/week rule or use **No workday target** before approval. Unavailable people, duplicate same-day shifts and overlapping shifts are rejected. Marking someone unavailable releases any affected manual lock, so the planner can regenerate safely.

## Saving and backups

Changes and approval are automatically saved on this device when browser storage is available. Check the save indicator. Private browsing, browser restrictions, clearing storage or moving the app folder can affect persistence, particularly under file://. **Save backup** is the portable option.

A backup contains source data, active rules, retained patterns and the current draft/approval. Older input files and fixed 4+3 backups are supported: their recorded assignments are validated and migrated, rather than being silently rescheduled. Invalid or inconsistent backups are rejected without replacing the current data.

**Clear saved data** removes the browser save and displays the example; the next change resumes saving. **Reset example** replaces the current data with the default example.

## Input and output

Normal editing uses forms and checkboxes; manual JSON editing is unnecessary. Developers can inspect `sample-data.json`.

- People: unique ID, name, daily boolean availability and optional retained pattern metadata.
- Shifts: unique ID, date, start/end times, vacancy and assigned person ID in generated output.
- Rules: `restDays` and `restMode` (`flexible`, `consecutive` or `separated`).

Each shift represents one staffing position. Input positions are vacant. A new generation starts from those positions, not from previous assignments. An end time earlier than the start means the shift ends the next day. Overnight shifts belong to their start date.

CSV includes person IDs, names, dates, hours and draft/approved status. It can be opened in Excel or Google Sheets; there is no live Google Sheets connection.

## Validation

With Node.js 18+:

```sh
node --test
```

50 tests cover individual rules, weekly exceptions, unrestricted targets, manual editing and locks, backup restoration, configurable rest counts and grouping, legacy 4+3 behavior, availability, coverage, overnight overlaps, new periods, continuity, malformed inputs, backup migration and approval. Independent exhaustive comparisons cover 60 capacity/availability scenarios and 30 overnight scenarios. GitHub Actions runs the suite on each push and pull request. See [VALIDATION.md](VALIDATION.md) for verification details.

## Limits

Small-team portfolio demonstration: maximum 10 people, 35 days and 350 positions. Search is bounded to 250,000 visited nodes per week and explicitly reports when optimal coverage is not guaranteed. Staff are assumed equally qualified. Shift hours are reported, not balanced or optimized. Times use wall-clock arithmetic without daylight-saving conversion.

No minimum-rest or employment-law checks, payroll processing, automatic holiday/sickness exceptions, notifications or authenticated audit log. Assignment editing uses dropdowns, not drag-and-drop. There is still a maximum of one shift per person per calendar day. Approval is a local saved status.

## Background

Rebuilt demonstration inspired by a scheduling workflow Alex Campigotto originally created while managing a bar team in Brussels. This is a new implementation with generalized scheduling rules, not the original production workflow. Names, IDs, availability and shifts are synthetic.

## Files

- `index.html`: English interface.
- `planner.js`: template search, rule validation and legacy repeating-plan support.
- `scheduler.js`: independent weeks, per-person/per-week rules and manual assignment validation.
- `app.js`: forms, roster, local saving, backup and CSV output.
- `state.js`: backup validation and migration.
- `sample-data.json`: fictional 5-work / 2-rest example.
- `test.js`, `scheduler.test.js`: automated regression, rule, weekly and manual-assignment tests.

No external runtime dependencies or API calls.
