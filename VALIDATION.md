# Validation report

## Result

35 automated tests passed, 0 failed. Real-browser workflow checks passed over localhost. No JavaScript console errors were recorded during the final workflow.

## Automated coverage

Run `node --test test.js`. The suite includes:

- Continuous 4 workdays / 3 rest days, week and period boundaries, explicit availability and one shift per person per day.
- Legacy 4+3 fixture: 112 covered positions, 16 workdays / 128 hours per person. New default 5+2 example: 140 positions, 20 workdays / 160 hours per person.
- Empty and unavailable teams, insufficient capacity, excess staff and rejected incomplete approvals.
- Overnight overlaps within a period and across an approved period boundary.
- Duplicate IDs, missing availability, invalid dates and times, leap years and year changes.
- Maximum supported roster: 10 people, 35 days and 350 shift positions.
- Input immutability, repeatable generation and repeated-approval rejection.
- New-period settings, retained or reset cycles, new people and conflicting availability.
- Backup round trips with drafts, approvals, cycle anchors and special-character names.
- BOM-prefixed files; invalid, null, array, unknown-version and inconsistent backups.
- Independent exhaustive comparisons: 60 availability/capacity scenarios plus 30 overnight-assignment scenarios.

Syntax and static checks verify JavaScript parsing, unique HTML IDs, existing local script assets, matching UI references, English document language and absence of a JSON input editor.

## Browser workflows verified

- Generate and approve the example; reload restores APPROVED and 112/112 coverage.
- Change availability in week four; reload preserves the change and clears the previous approval.
- Save the complete backup; restore it through the file picker and recover its approval and cycle anchors.
- Attempt to restore a null backup; a clear error appears and existing data stays intact.
- Edit a shift in week four; the editor remains on that week and retains the changed time.
- Add international and special-character names, rename a person, reload and remove the renamed person.
- Reach 10 people; an eleventh is rejected without changing the roster.
- Create a one-week plan starting midweek with new hours; all 28 positions are covered.
- Attempt an overlapping period while retaining approved cycles; reject it with an explanation beside the form.
- Disable cycle retention; allow a fresh plan.
- Add/remove shift positions and flag excess demand; disable incomplete approval (also verified in the preceding browser pass).
- Clear local saved data; return to the example.
- Export CSV with approved status and formula-like user text; independently parse 28 rows and verify spreadsheet formula escaping.

## Fixes from this review

- Editing shifts preserves the selected week and editor scroll position.
- Person renaming saves immediately and updates the Remove label.
- Retained cycles are labelled next to person IDs.
- Backup and new-plan feedback appears beside those controls.
- Invalid backups have clearer errors; BOM files are supported.
- Oversized shift data is rejected before searching.
- The complete-cycle limitation is explained in the interface.

## Verification limits

Automated browser tests used the local HTTP server. The browser automation policy blocks file:// navigation. The user separately confirmed that opening index.html directly by double-click works in Brave, including generation, approval and restoration after reload. Scripts are ordinary local scripts with no imports, build step or external resources. Local storage behavior under file://, private browsing and browser restrictions remains browser-dependent; Save backup is the portable option. Storage-denial behavior and other browser engines were not exercised in real-browser tests.

The app is a small-team portfolio demo: no minimum-rest or employment-law checks, direct Google Sheets connection, authenticated audit log or automatic holiday/sickness exceptions. A strict cycle may leave an entire person unassigned when one required day is incompatible. Search is bounded and reports when optimality is not guaranteed.

## Configurable-rules update

- Removed 4+3 from the app title, repository name and active scheduling requirements.
- Tested every rest count 0–7 for supported modes, plus full seven-person coverage for all modes with 0–6 rest days.
- Verified forced split availability: accepted in Flexible and Separated modes, rejected in Consecutive mode.
- Verified a split pattern survives approval, backup restoration and a midweek new period.
- Previous fixed-pattern backups migrate without changing their assignments.
- Browser: default 5+2 generates 140/140 positions; approval survives reload. Separated mode also covers 140/140 positions with nonadjacent rest days. Impossible separated-rest counts show an explanatory error.

The rules remain weekly: each person's selected seven-day pattern repeats across the planning horizon. Configurability does not imply arbitrary-length cycles or independent patterns each week.

Browser: selecting 3 consecutive rest days, creating a two-week plan with 4 positions/day, generating 56/56 positions and approving survives reload with the selected rules.
