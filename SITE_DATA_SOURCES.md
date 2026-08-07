# Site Data Sources

This file lists the workbook sheets, cells, generated files, and site areas that feed the MTSC Fixtures Portal.

## Current Source Workbook

The workbook watcher is currently configured to read:

`/Users/johnmacpherson/Library/CloudStorage/OneDrive-Personal/Pers/Tennis/Fixtures/Summer 2026/march 28 - calendar fix 2026 - Summer Master Fixture List v1.59.xlsm`

That path is stored in `.codex/workbook-watch-path` and is used by `Watch Workbook.command`.

## Main Generated Files

| File | Purpose | Created/updated by |
| --- | --- | --- |
| `data/fixtures.json` | Fixture rows, monthly totals, report summary, and portal feature text shown on the site. | `scripts/watch-workbook.py`, or by importing a downloaded `fixtures.json` with `Update Fixtures.command`. |

## Workbook Sheets Used

The site import expects these workbook tabs:

| Sheet name | Required | Used for |
| --- | --- | --- |
| `By Date` | Yes | Main fixture list and monthly match totals. |
| `League Results` | Yes | Played/win totals and top average net points rankings. |
| `Portal Features` | No | Text shown in the `Recent Features in the Past Week` box. |

Sheet matching is case-insensitive after trimming spaces, so `by date` and `By Date` both work.

## `By Date` Sheet

### Fixture Rows

Rows `2:93` feed the main `All Matches` table and the fixture filters.

Only rows with at least one match field are imported. Rows outside the season date range `2026-04-01` to `2026-08-31` are skipped when a date is present.

| Excel cells | JSON field | Site use |
| --- | --- | --- |
| `C2:C93` | `rows[].date` | Date column, date sorting, next-days filters, home/away next 14 days, next 7 days report. |
| `D2:D93` | `rows[].day` | Day column and next 7 days report. |
| `F2:F93` | `rows[].time` | Time column and next 7 days report. |
| `G2:G93` | `rows[].team` | Home Team column, Milford team filter, home match counts. |
| `H2:H93` | `rows[].opponent` | Away Team column, Milford team filter, away match counts. |
| `I2:I93` | `rows[].venue` | Home/Away filter. Expected values are usually `H` or `A`. |
| `L2:L93` | `rows[].status` | Status badge. Blank cells become `Published`. |

### Monthly Totals

Rows `108:112` feed the `Matches by Month` report.

| Excel cells | JSON field | Site label |
| --- | --- | --- |
| `B108:B112` | `monthlyPlanned[].month` | Month name. |
| `C108:C112` | `monthlyPlanned[].originalPlanned` | Originally Planned. |
| `H108:H112` | `monthlyPlanned[].count` | Currently Planned. |
| `E108:E112` | `monthlyPlanned[].played` and `monthlyPlayed[]` | Played. |

## `League Results` Sheet

### Summary Totals

| Excel cell | JSON field | Site box |
| --- | --- | --- |
| `T21` | `reportSummary.totalMatchesPlayed` | Total Matches Played. |
| `U21` | `reportSummary.totalWins` | Total Wins. |

### Team Match Progress Chart

Rows `7:20` feed the automatic horizontal chart showing matches played versus remaining by team.

| Excel cells | JSON field | Chart use |
|---|---|---|
| `K7:K20` | `reportSummary.teamProgress[].team` | Team label. |
| `T7:T20` | `reportSummary.teamProgress[].played` | Played section of each bar. |
| `S7:S20` | `reportSummary.teamProgress[].remaining` | Remaining section of each bar. |

### Top Average Net Points Rankings

Rows `7:20` feed the `Teams with top 4 scores of highest avg net points/match (All Matches)` box.

The importer reads all rows in this range, sorts by average net points descending, then displays teams in the top 4 distinct scores. Tied teams are included, so the box can show more than 4 teams.

| Excel cells | JSON field | Site column |
| --- | --- | --- |
| `K7:K20` | `reportSummary.highestAvgRankings[].team` | Team. |
| `Z7:Z20` | `reportSummary.highestAvgRankings[].avgValue` | Net Avg Points. |
| `AC7:AC20` | `reportSummary.highestAvgRankings[].percentValue` | % Played. |

## `Portal Features` Sheet

| Excel cell | JSON field | Site box |
| --- | --- | --- |
| `A1` | `portalFeatures` | `Recent Features in the Past Week`. |

Multi-line text is supported and displays as line breaks on the site.

## Site Display Mapping

| Site area | Data source |
| --- | --- |
| `Last Refresh on ...` status | `data/fixtures.json` field `uploadedAt`. |
| `Recent Features in the Past Week` | `Portal Features!A1` through `portalFeatures`. |
| `TOTAL MATCHES` | Count of imported `rows[]`. |
| `Total Matches Played` | `League Results!T21`. |
| `Total Wins` | `League Results!U21`. |
| `Teams with top 4 scores...` | `League Results!K7:K20`, `Z7:Z20`, `AC7:AC20`. |
| `Milford Teams` | Unique imported teams/opponents whose name starts with `Milford`. |
| `Home Matches Next 14 Days` | Imported rows dated today through the next 13 days where `team` starts with `Milford`. |
| `Away Matches Next 14 Days` | Imported rows dated today through the next 13 days where `opponent` starts with `Milford`. |
| `All Matches` table | Imported fixture rows from `By Date!C2:L93`. |
| `Filter by Column` | Search text built from date, day, time, home team, away team, venue, and status. |
| `Milford Team` filter | Imported teams/opponents whose name starts with `Milford`. |
| `Home/Away` filter | `By Date!I2:I93`, usually `H` or `A`. |
| `Matches in next days` filter | Imported fixture dates. |
| `Matches by Month` report | `By Date!B108:H112`. |
| `All match fixtures for the next 7 days` report | Imported fixture rows dated today through the next 7 days. |

## Import Rules To Remember

- The workbook must contain `By Date` and `League Results`.
- `Portal Features` is optional; if missing or blank, the site leaves the feature text blank.
- Dates may be Excel serial dates, ISO dates, or `dd/mm/yyyy` style dates.
- Times may be Excel time values, `HH:MM`, or compact values like `1830`.
- Empty status cells are converted to `Published`.
- The season window is hard-coded as `2026-04-01` through `2026-08-31`.
- Changes from the workbook reach the public site after `data/fixtures.json` is committed and pushed to GitHub.
