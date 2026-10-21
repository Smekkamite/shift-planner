# Shift Planner

A small local staff scheduler with configurable weekly work/rest rules, daily availability, manager approval and portable backups. No installation, account or external service is required.

## Quick start

Download the repository ZIP, extract it and open **index.html** in your browser. Direct opening was manually confirmed in Brave for the previous version; the updated version uses the same local-script approach. Automated browser checks use localhost.

1. In **Weekly rules & availability**, choose **Days off per week** and **Rest arrangement**, then click **Apply rules**.
2. Edit names, add/remove people and tick daily availability. Checked means available, not necessarily scheduled.
3. Expand **Manage shifts** to change dates, times and staffing demand, or use **New plan** to create a fresh period.
4. Click **Generate draft**, inspect the weekly roster and uncovered positions, then **Approve plan** when complete.
5. Use **Export CSV** for a spreadsheet or **Save backup** to preserve editable data and approval. **Restore backup** reopens a saved copy.

The default example has seven fictional international team members, 28 days, five positions per day, and five workdays plus two rest days per person. It covers **140/140 positions**, with **20 workdays / 160 hours** per person. The original four-work / three-rest arrangement remains available by choosing three days off and consecutive rest.

## Weekly rules

Choose 0–7 rest days. Workdays are calculated as `7 - restDays`.

| Rest arrangement | Meaning |
| --- | --- |
| Flexible | Rest days may be together or split; no grouping constraint. |
| Consecutive | All rest days form one continuous block, including across week boundaries. |
| Separated | No two rest days touch, including across week boundaries. At most three rest days fit in a repeating seven-day week. |

Rules apply to the whole team. The planner selects one repeating seven-day pattern per person; it does not independently redesign every week. Availability and capacity must support the whole selected pattern. A single incompatible day can leave a person unassigned for the period. Incomplete drafts cannot be approved.

Changing rules releases retained patterns and clears the old draft/approval. The interface shows the active rule summary and marks retained patterns next to person IDs.

## New periods and continuity

**New plan** chooses a start date, 1–5 weeks, usual start/end times and daily positions. It retains your team and replaces current shifts. Save a backup first if you need an archive.

Approval saves each person's seven-day work/rest mask and reference date. **Keep existing weekly patterns** preserves that pattern in the next period, even when it begins midweek. Uncheck it to recalculate patterns. Rules must remain compatible when retaining a pattern. New dates default to available; overlapping dates preserve recorded availability.

A gap between periods preserves the theoretical weekly pattern but is not itself scheduled or checked. Overnight assignments at the previous approved boundary are checked for overlap.

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
node --test test.js
```

The suite covers configurable rest counts and grouping, legacy 4+3 behavior, availability, coverage, overnight overlaps, new periods, continuity, malformed inputs, backup migration and approval. Independent exhaustive comparisons cover 60 capacity/availability scenarios and 30 overnight scenarios. GitHub Actions runs the suite on each push and pull request. See [VALIDATION.md](VALIDATION.md) for verification details.

## Limits

Small-team portfolio demonstration: maximum 10 people, 35 days and 350 positions. Search is bounded to 250,000 visited nodes and explicitly reports when optimal coverage is not guaranteed. Staff are assumed equally qualified. Shift hours are reported, not balanced or optimized. Times use wall-clock arithmetic without daylight-saving conversion.

No minimum-rest or employment-law checks, payroll processing, automatic holiday/sickness exceptions, notifications, authenticated audit log or manual drag-and-drop assignment. Approval is a local saved status.

## Background

Rebuilt demonstration inspired by a scheduling workflow Alex Campigotto originally created while managing a bar team in Brussels. This is a new implementation with generalized scheduling rules, not the original production workflow. Names, IDs, availability and shifts are synthetic.

## Files

- `index.html`: English interface.
- `planner.js`: scheduling engine and rule validation.
- `app.js`: forms, roster, local saving, backup and CSV output.
- `state.js`: backup validation and migration.
- `sample-data.json`: fictional 5-work / 2-rest example.
- `test.js`: automated regression and rule tests.

No external runtime dependencies or API calls.
