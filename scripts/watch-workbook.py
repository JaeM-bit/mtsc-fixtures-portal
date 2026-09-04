#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import xml.etree.ElementTree as ET

PROJECT_DIR = Path(__file__).resolve().parents[1]
TARGET_FILE = PROJECT_DIR / "data" / "fixtures.json"
SEASON_START = "2026-04-01"
SEASON_END = "2026-08-31"
SEASON_LABEL = "Summer 2026"
PUBLISH_START: Optional[str] = None
PUBLISH_END: Optional[str] = None
PUBLISHED_MONTHS: Optional[set[str]] = None
PUBLISHED_STATUSES: Optional[set[str]] = None
EXTRACT_MONTHLY_TOTALS = True


def configure_season(workbook_path: Path) -> None:
    global TARGET_FILE, SEASON_START, SEASON_END, SEASON_LABEL
    global PUBLISH_START, PUBLISH_END, PUBLISHED_MONTHS, PUBLISHED_STATUSES
    global EXTRACT_MONTHLY_TOTALS
    normalized_name = re.sub(r"[^a-z0-9]+", " ", workbook_path.stem.lower()).strip()
    if normalized_name.startswith("summer 2026 master fixture list"):
        TARGET_FILE = PROJECT_DIR / "data" / "fixtures.json"
        SEASON_START = "2026-04-01"
        SEASON_END = "2026-08-31"
        SEASON_LABEL = "Summer 2026"
        PUBLISH_START = None
        PUBLISH_END = None
        PUBLISHED_MONTHS = None
        PUBLISHED_STATUSES = None
        EXTRACT_MONTHLY_TOTALS = True
        return
    if normalized_name.startswith("winter 2026 27 master fixture list"):
        TARGET_FILE = PROJECT_DIR / "data" / "winter-fixtures.json"
        SEASON_START = "2026-09-01"
        SEASON_END = "2027-03-31"
        SEASON_LABEL = "Winter 2026/27"
        PUBLISH_START = None
        PUBLISH_END = None
        PUBLISHED_MONTHS = None
        PUBLISHED_STATUSES = {"booked", "played"}
        EXTRACT_MONTHLY_TOTALS = False
        return
    raise ValueError(
        "Workbook name must begin with 'Summer 2026 Master Fixture List' "
        "or 'Winter 2026-27 Master Fixture List'."
    )


def target_relative_path() -> str:
    return TARGET_FILE.relative_to(PROJECT_DIR).as_posix()


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def cell_ref_to_col(ref: str) -> str:
    match = re.match(r"([A-Z]+)", ref or "")
    return match.group(1) if match else ""


def read_zip_text(zf: zipfile.ZipFile, name: str) -> str:
    with zf.open(name) as handle:
        return handle.read().decode("utf-8")


def parse_xml(zf: zipfile.ZipFile, name: str) -> ET.Element:
    return ET.fromstring(read_zip_text(zf, name))


def text_from_element(element: ET.Element) -> str:
    return "".join(element.itertext()).strip()


def extract_cell_text(cell: ET.Element, shared_strings: List[str]) -> str:
    cell_type = cell.attrib.get("t", "")
    value = None

    for child in cell:
      if local_name(child.tag) == "v":
        value = (child.text or "").strip()
        break

    if cell_type == "s" and value is not None:
        try:
            return shared_strings[int(value)]
        except (ValueError, IndexError):
            return ""

    if cell_type == "inlineStr":
        texts = [text_from_element(child) for child in cell if local_name(child.tag) == "is"]
        return " ".join(part for part in texts if part).strip()

    if value is not None:
        return value

    if cell_type in {"str", "d"}:
        return text_from_element(cell)

    return text_from_element(cell)


def parse_shared_strings(zf: zipfile.ZipFile) -> List[str]:
    try:
        root = parse_xml(zf, "xl/sharedStrings.xml")
    except KeyError:
        return []

    shared_strings: List[str] = []
    for si in root.iter():
        if local_name(si.tag) != "si":
            continue
        text = "".join(
            (node.text or "")
            for node in si.iter()
            if local_name(node.tag) == "t"
        ).strip()
        shared_strings.append(text)
    return shared_strings


def parse_workbook_sheets(zf: zipfile.ZipFile) -> Dict[str, str]:
    workbook = parse_xml(zf, "xl/workbook.xml")
    rels = parse_xml(zf, "xl/_rels/workbook.xml.rels")

    rel_map: Dict[str, str] = {}
    for rel in rels.iter():
        if local_name(rel.tag) != "Relationship":
            continue
        rid = rel.attrib.get("Id")
        target = rel.attrib.get("Target")
        if not rid or not target:
            continue
        if not target.startswith("xl/"):
            target = f"xl/{target.lstrip('/')}"
        rel_map[rid] = target

    sheets: Dict[str, str] = {}
    rel_ns = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    for sheet in workbook.iter():
        if local_name(sheet.tag) != "sheet":
            continue
        name = sheet.attrib.get("name", "")
        rid = sheet.attrib.get(rel_ns) or sheet.attrib.get("r:id")
        if name and rid and rid in rel_map:
            sheets[name] = rel_map[rid]
    return sheets


def parse_sheet_rows(
    zf: zipfile.ZipFile, sheet_path: str, shared_strings: List[str]
) -> Dict[int, Dict[str, str]]:
    root = parse_xml(zf, sheet_path)
    rows: Dict[int, Dict[str, str]] = {}

    for row in root.iter():
        if local_name(row.tag) != "row":
            continue
        row_num = int(row.attrib.get("r", "0") or 0)
        row_cells: Dict[str, str] = {}

        for cell in row:
            if local_name(cell.tag) != "c":
                continue
            ref = cell.attrib.get("r", "")
            col = cell_ref_to_col(ref)
            if not col:
                continue
            row_cells[col] = extract_cell_text(cell, shared_strings)

        rows[row_num] = row_cells

    return rows


def parse_number(value: str) -> Optional[float]:
    text = (value or "").strip()
    if not text:
        return None
    try:
        return float(text.replace(",", ""))
    except ValueError:
        return None


def excel_serial_to_date(serial: float) -> str:
    base = datetime(1899, 12, 30)
    whole_days = int(serial)
    date_value = base + timedelta(days=whole_days)
    return date_value.strftime("%Y-%m-%d")


def excel_serial_to_time(serial: float) -> str:
    fraction = serial % 1
    total_minutes = round(fraction * 24 * 60)
    hours, minutes = divmod(total_minutes, 60)
    if hours == 0 and minutes == 0:
        return ""
    return f"{hours:02d}:{minutes:02d}"


def parse_date_cell(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return ""

    number = parse_number(text)
    if number is not None:
        return excel_serial_to_date(number)

    if re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        return text

    match = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$", text)
    if match:
        day, month, year = match.groups()
        if len(year) == 2:
            year = f"20{year}"
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    try:
        parsed = datetime.fromisoformat(text)
        return parsed.strftime("%Y-%m-%d")
    except ValueError:
        return text


def parse_time_cell(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return ""

    if re.match(r"^\d{1,2}:\d{2}$", text):
        hour, minute = text.split(":")
        return f"{int(hour):02d}:{minute}"

    compact = re.match(r"^(\d{1,2})(\d{2})$", text)
    if compact:
        return f"{int(compact.group(1)):02d}:{compact.group(2)}"

    number = parse_number(text)
    if number is not None:
        return excel_serial_to_time(number)

    return text


def is_in_season(date_value: str) -> bool:
    return SEASON_START <= date_value <= SEASON_END


def is_publishable_date(date_value: str) -> bool:
    if not date_value:
        return PUBLISH_START is None and PUBLISH_END is None
    if not is_in_season(date_value):
        return False
    if PUBLISH_START is not None and date_value < PUBLISH_START:
        return False
    if PUBLISH_END is not None and date_value > PUBLISH_END:
        return False
    return True


def sheet_row_values(rows: Dict[int, Dict[str, str]], row_num: int) -> Dict[str, str]:
    return rows.get(row_num, {})


def read_monthly_totals(by_date_rows: Dict[int, Dict[str, str]]) -> Tuple[List[Dict[str, object]], List[float]]:
    planned: List[Dict[str, object]] = []
    played_rows: List[float] = []
    last_row = 113 if SEASON_LABEL == "Winter 2026/27" else 112
    row_numbers = (
        range(94, 131)
        if PUBLISHED_MONTHS is not None
        else range(108, last_row + 1)
    )

    for row_num in row_numbers:
        row = sheet_row_values(by_date_rows, row_num)
        month = (row.get("B") or "").strip()
        if PUBLISHED_MONTHS is not None and month.lower() not in PUBLISHED_MONTHS:
            continue
        if PUBLISHED_MONTHS is not None and not (row.get("H") or "").strip():
            continue
        original_value = parse_number(row.get("C", ""))
        planned_value = parse_number(row.get("H", ""))
        played_value = parse_number(row.get("E", ""))

        if month or row.get("C") or row.get("H") or row.get("E"):
            planned.append(
                {
                    "month": month or "Unspecified",
                    "originalPlanned": int(original_value) if original_value is not None else "",
                    "count": int(planned_value) if planned_value is not None else 0,
                    "played": int(played_value) if played_value is not None else "",
                }
            )
            played_rows.append(int(played_value) if played_value is not None else 0)

    return planned, played_rows


def read_report_summary(league_rows: Dict[int, Dict[str, str]]) -> Dict[str, object]:
    total_matches_played = (sheet_row_values(league_rows, 21).get("T") or "").strip()
    total_wins = (sheet_row_values(league_rows, 21).get("U") or "").strip()
    ranked: List[Tuple[str, float, Optional[float]]] = []
    team_progress: List[Dict[str, object]] = []

    for row_num in range(7, 21):
        row = sheet_row_values(league_rows, row_num)
        team = (row.get("K") or "").strip()
        played_value = parse_number(row.get("T", ""))
        remaining_value = parse_number(row.get("S", ""))
        avg_value = parse_number(row.get("Z", ""))
        percent_value = parse_number(row.get("AC", ""))
        if team and (played_value is not None or remaining_value is not None):
            team_progress.append(
                {
                    "team": team,
                    "played": int(played_value) if played_value is not None else 0,
                    "remaining": int(remaining_value) if remaining_value is not None else 0,
                }
            )
        if team and avg_value is not None:
            ranked.append((team, avg_value, percent_value))

    ranked.sort(key=lambda item: (-item[1], item[0].lower()))
    top_scores = []
    for _, avg, _ in ranked:
        displayed_avg = round(avg, 1)
        if displayed_avg not in top_scores:
            top_scores.append(displayed_avg)
        if len(top_scores) == 4:
            break
    top_rankings = [item for item in ranked if round(item[1], 1) in top_scores]
    highest_avg_points = top_rankings[0][1] if top_rankings else ""
    highest_avg_teams = [team for team, avg, _ in top_rankings if avg == highest_avg_points] if top_rankings else []

    return {
        "totalMatchesPlayed": total_matches_played,
        "totalWins": total_wins,
        "teamProgress": team_progress,
        "highestAvgPointsPerMatch": highest_avg_points,
        "highestAvgTeams": highest_avg_teams,
        "highestAvgRankings": [
            {
                "team": team,
                "avgValue": avg,
                "percentValue": percent,
            }
            for team, avg, percent in top_rankings
        ],
    }


def read_portal_features(portal_rows: Dict[int, Dict[str, str]]) -> str:
    return (sheet_row_values(portal_rows, 1).get("A") or "").strip()


def read_fixtures_by_team_month(by_date_rows: Dict[int, Dict[str, str]]) -> Dict[str, object]:
    if SEASON_LABEL != "Summer 2026":
        return {}

    columns = ["Y", "Z", "AA", "AB", "AC", "AD", "AF"]
    title = (sheet_row_values(by_date_rows, 117).get("Y") or "Months by Teams").strip()
    headers = [
        (sheet_row_values(by_date_rows, 118).get(column) or "").strip()
        for column in columns
    ]
    rows: List[List[str]] = []
    for row_num in range(119, 135):
        values = [
            (sheet_row_values(by_date_rows, row_num).get(column) or "").strip()
            for column in columns
        ]
        if any(values):
            rows.append(values)

    return {"title": title, "headers": headers, "rows": rows}


def read_matches(by_date_rows: Dict[int, Dict[str, str]]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []

    for row_num in sorted(by_date_rows):
        if row_num < 2 or row_num > 93:
            continue
        row = by_date_rows[row_num]
        date_value = parse_date_cell(row.get("C", ""))
        day_value = (row.get("D") or "").strip()
        time_value = parse_time_cell(row.get("F", ""))
        home_team = (row.get("G") or "").strip()
        away_team = (row.get("H") or "").strip()
        home_away = (row.get("I") or "").strip()
        status_value = (row.get("L") or "").strip()
        status = status_value or "Published"

        has_match_data = any([date_value, day_value, time_value, home_team, away_team, home_away, status_value])
        if not has_match_data:
            continue
        if not is_publishable_date(date_value):
            continue
        if PUBLISHED_STATUSES is not None and status_value.lower() not in PUBLISHED_STATUSES:
            continue

        rows.append(
            {
                "date": date_value,
                "day": day_value,
                "time": time_value,
                "team": home_team,
                "opponent": away_team,
                "venue": home_away,
                "status": status,
            }
        )

    return rows


def build_payload(workbook_path: Path) -> Dict[str, object]:
    with zipfile.ZipFile(workbook_path) as zf:
        shared_strings = parse_shared_strings(zf)
        sheets = parse_workbook_sheets(zf)

        by_date_sheet = next(
            (path for name, path in sheets.items() if name.strip().lower() == "by date"),
            None,
        )
        league_sheet = next(
            (path for name, path in sheets.items() if name.strip().lower() == "league results"),
            None,
        )
        portal_features_sheet = next(
            (path for name, path in sheets.items() if name.strip().lower() == "portal features"),
            None,
        )

        if not by_date_sheet:
            raise RuntimeError('No "By Date" sheet found in the workbook.')
        if not league_sheet:
            raise RuntimeError('No "League Results" sheet found in the workbook.')

        by_date_rows = parse_sheet_rows(zf, by_date_sheet, shared_strings)
        league_rows = parse_sheet_rows(zf, league_sheet, shared_strings)
        portal_rows = parse_sheet_rows(zf, portal_features_sheet, shared_strings) if portal_features_sheet else {}
        if EXTRACT_MONTHLY_TOTALS:
            monthly_planned, monthly_played = read_monthly_totals(by_date_rows)
        else:
            monthly_planned, monthly_played = [], []
        report_summary = read_report_summary(league_rows)
        report_summary["totalFixturesPlayed"] = (
            sheet_row_values(by_date_rows, 108).get("N") or ""
        ).strip()

        return {
            "uploadedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
            "rows": read_matches(by_date_rows),
            "monthlyPlanned": monthly_planned,
            "monthlyPlayed": monthly_played,
            "reportSummary": report_summary,
            "portalFeatures": read_portal_features(portal_rows) if portal_rows else "",
            "fixturesByTeamMonth": read_fixtures_by_team_month(by_date_rows),
        }


def write_payload(payload: Dict[str, object]) -> bool:
    TARGET_FILE.parent.mkdir(parents=True, exist_ok=True)
    existing = TARGET_FILE.read_text(encoding="utf-8") if TARGET_FILE.exists() else None

    # The generated timestamp must not turn an Excel autosave into a new commit.
    # Compare the actual workbook data first and only update uploadedAt when that
    # data has changed.
    if existing is not None:
        try:
            existing_payload = json.loads(existing)
            existing_data = dict(existing_payload)
            new_data = dict(payload)
            existing_data.pop("uploadedAt", None)
            new_data.pop("uploadedAt", None)
            if existing_data == new_data:
                return False
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    new_text = json.dumps(payload, indent=2) + "\n"
    if existing == new_text:
        return False
    TARGET_FILE.write_text(new_text, encoding="utf-8")
    print(
        f"Updated {target_relative_path()} ({len(payload['rows'])} rows, {len(payload['monthlyPlanned'])} monthly rows)."
    )
    return True


def run_git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=PROJECT_DIR,
        text=True,
        capture_output=True,
        check=False,
    )


def commit_and_push(message: str) -> None:
    target_path = target_relative_path()
    add_result = run_git("add", target_path)
    if add_result.returncode != 0:
        raise RuntimeError(add_result.stderr.strip() or add_result.stdout.strip() or "git add failed")

    status_result = run_git("status", "--porcelain", "--", target_path)
    if status_result.returncode != 0:
        raise RuntimeError(status_result.stderr.strip() or status_result.stdout.strip() or "git status failed")

    if not status_result.stdout.strip():
        print(f"No {target_path} changes to commit.")
        return

    commit_result = run_git("commit", "-m", message)
    if commit_result.returncode != 0:
        raise RuntimeError(commit_result.stderr.strip() or commit_result.stdout.strip() or "git commit failed")

    push_result = run_git("push", "origin", "main")
    if push_result.returncode != 0:
        raise RuntimeError(push_result.stderr.strip() or push_result.stdout.strip() or "git push failed")

    print(f"Committed and pushed {target_path} to origin/main.")


def generate_once(workbook_path: Path) -> None:
    if not workbook_path.exists():
        raise FileNotFoundError(f"Workbook not found: {workbook_path}")
    payload = build_payload(workbook_path)
    changed = write_payload(payload)
    if changed:
        commit_and_push(f"Update {SEASON_LABEL} fixtures from workbook")


def watch(workbook_path: Path) -> None:
    last_mtime: Optional[float] = None

    print(f"Watching workbook: {workbook_path}")
    print(f"Output: {TARGET_FILE}")
    try:
        generate_once(workbook_path)
    except Exception as error:
        print(f"Failed to update fixtures.json: {error}")

    while True:
        try:
            mtime = workbook_path.stat().st_mtime
        except FileNotFoundError:
            if last_mtime is not None:
                print(f"Workbook missing: {workbook_path}")
                last_mtime = None
            time.sleep(2)
            continue

        if last_mtime is None:
            last_mtime = mtime
        elif mtime > last_mtime:
            last_mtime = mtime
            try:
                generate_once(workbook_path)
            except Exception as error:
                print(f"Failed to update fixtures.json: {error}")

        time.sleep(2)


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: watch-workbook.py /path/to/workbook.xlsm", file=sys.stderr)
        return 1

    workbook_path = Path(sys.argv[1]).expanduser().resolve()
    try:
        configure_season(workbook_path)
        watch(workbook_path)
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
