# Validation report

## Current result

50 automated tests pass (`node --test`). Both regression and independent-week suites run in GitHub Actions. No JavaScript errors were recorded during the new workflow browser checks.

## New scheduling capabilities tested

- Different people have different weekly work/rest counts.
- A dated week override takes precedence over a person default, which takes precedence over team defaults.
- Availability can force a different arrangement in the following week.
- No workday target allows arbitrary workday counts, including zero.
- The default independent-week example covers 140/140 positions.
- Consecutive rest may cross a week boundary; separated rest checks adjacent weeks.
- Weeks with missing leading/trailing positions retain their rule origin.
- A whole week without demand is reported safely.
- New periods preserve personal defaults and the previous overnight boundary, but not old dated overrides or manual locks.
- Manual vacancies/assignments are locked and survive regeneration and backups.
- Manual edits that conflict with rest targets are retained as flagged drafts and cannot be approved.
- Unavailable people, duplicate same-day assignments and overnight overlaps are rejected.
- Tampering with a locked assignment in a backup is rejected.

## Regression coverage

Legacy 4+3 scheduling, all supported rest counts/grouping modes, full balanced examples, independent exhaustive comparisons on 60 capacity/availability and 30 overnight scenarios, leap days/year boundaries, malformed data, duplicate IDs, capacity shortages, excessive staffing, backup migration and approval validation remain covered.

## Browser checks for this update

- Reset to the independent-week example.
- Give Amelia three rest days normally and four rest days in the second week: the roster reports 15 workdays and correctly exposes five uncovered positions.
- Give Mateo No workday target: generation covers all 140 positions while preserving Amelia’s different rules.
- Manually set a position vacant: coverage drops to 139/140 and approval is disabled.
- Reload: the vacancy and manual lock are preserved.
- Restore the original assignee and regenerate: all 140 positions remain covered and locks are respected.

Earlier browser passes also cover names, adding/removing people and shifts, invalid-backup rejection, full backup restoration, CSV output, local saving and new periods. The prior local-file version was manually confirmed in Brave by the user; automated browser tests run over localhost because file:// is blocked by the browser automation policy.

## Limits

Maximum 10 people, 35 days and 350 positions; search is bounded per week and weeks are processed in sequence, so global optimality is not guaranteed. One shift per person per day, no overlaps or unavailable assignments. Partial weeks are checked only for visible days. Rest grouping outside the horizon and across separate periods/gaps is not inferred; overnight overlap metadata is preserved across new periods. No minimum-rest/employment-law checks. Browser storage behavior is browser-dependent; backups are portable. Other browser engines and storage-denial behavior were not exercised in real-browser tests.
