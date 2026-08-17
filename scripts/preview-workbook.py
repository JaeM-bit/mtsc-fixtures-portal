#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import shutil
import socket
import tempfile
import threading
import webbrowser
import zipfile
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
IMPORTER_PATH = PROJECT_DIR / "scripts" / "watch-workbook.py"
DEFAULT_WORKBOOK = (
    PROJECT_DIR
    / "outputs"
    / "01a004ef-b04b-7e21-b8a0-6ceca4eac598"
    / "Reusable_Tennis_Club_Portal_Template.xlsx"
)


def load_importer():
    spec = importlib.util.spec_from_file_location("portal_workbook_importer", IMPORTER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load workbook importer: {IMPORTER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def available_port(preferred: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
        try:
            candidate.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            candidate.bind(("127.0.0.1", 0))
            return int(candidate.getsockname()[1])


def build_input_template_payload(workbook_path: Path, importer) -> dict[str, object] | None:
    with zipfile.ZipFile(workbook_path) as archive:
        shared_strings = importer.parse_shared_strings(archive)
        sheets = importer.parse_workbook_sheets(archive)
        normalized = {name.strip().lower(): sheet_path for name, sheet_path in sheets.items()}
        required = {"club setup", "fixtures input", "results input", "portal updates"}
        if not required.issubset(normalized):
            return None

        club_rows = importer.parse_sheet_rows(archive, normalized["club setup"], shared_strings)
        fixture_rows = importer.parse_sheet_rows(archive, normalized["fixtures input"], shared_strings)
        result_rows = importer.parse_sheet_rows(archive, normalized["results input"], shared_strings)
        update_rows = importer.parse_sheet_rows(archive, normalized["portal updates"], shared_strings)

    fixtures: list[dict[str, str]] = []
    for row_number in range(5, 97):
        source = fixture_rows.get(row_number, {})
        date_value = importer.parse_date_cell(source.get("A", ""))
        time_value = importer.parse_time_cell(source.get("C", ""))
        home_team = (source.get("D") or "").strip()
        away_team = (source.get("E") or "").strip()
        venue = (source.get("F") or "").strip()
        entered_status = (source.get("G") or "").strip()
        if not any((date_value, time_value, home_team, away_team, venue, entered_status)):
            continue
        if date_value and not importer.is_in_season(date_value):
            continue
        try:
            day_value = datetime.fromisoformat(date_value).strftime("%a") if date_value else ""
        except ValueError:
            day_value = ""
        fixtures.append(
            {
                "date": date_value,
                "day": day_value,
                "time": time_value,
                "team": home_team,
                "opponent": away_team,
                "venue": venue,
                "status": entered_status or "Published",
            }
        )

    results: list[dict[str, object]] = []
    for row_number in range(5, 205):
        source = result_rows.get(row_number, {})
        team = (source.get("B") or "").strip()
        if not team:
            continue
        results.append(
            {
                "date": importer.parse_date_cell(source.get("A", "")),
                "team": team,
                "played": (source.get("E") or "").strip().lower() == "yes",
                "won": (source.get("F") or "").strip().lower() == "yes",
                "net": importer.parse_number(source.get("G", "")),
            }
        )

    teams: list[tuple[str, int]] = []
    for row_number in range(11, 25):
        source = club_rows.get(row_number, {})
        team = (source.get("A") or "").strip()
        planned = importer.parse_number(source.get("B", ""))
        active = (source.get("C") or "Yes").strip().lower() != "no"
        if team and active:
            teams.append((team, int(planned or 0)))

    team_progress = []
    rankings = []
    for team, planned in teams:
        played_rows = [item for item in results if item["team"] == team and item["played"]]
        played = len(played_rows)
        remaining = max(0, planned - played)
        team_progress.append({"team": team, "played": played, "remaining": remaining})
        net_values = [float(item["net"]) for item in played_rows if item["net"] is not None]
        if net_values:
            rankings.append((team, sum(net_values) / len(net_values), played / planned if planned else 0))

    rankings.sort(key=lambda item: (-item[1], item[0].lower()))
    top_scores: list[float] = []
    for _, average, _ in rankings:
        displayed = round(average, 1)
        if displayed not in top_scores:
            top_scores.append(displayed)
        if len(top_scores) == 4:
            break
    top_rankings = [item for item in rankings if round(item[1], 1) in top_scores]

    month_names = ["April", "May", "June", "July", "August"]
    monthly_planned = []
    monthly_played = []
    for month_number, month_name in enumerate(month_names, start=4):
        fixture_month = [item for item in fixtures if item["date"].startswith(f"2026-{month_number:02d}-")]
        played_count = sum(
            1
            for item in results
            if item["played"] and str(item["date"]).startswith(f"2026-{month_number:02d}-")
        )
        monthly_planned.append(
            {
                "month": month_name,
                "originalPlanned": len(fixture_month),
                "count": sum(1 for item in fixture_month if item["status"].lower() != "cancelled"),
                "played": played_count,
            }
        )
        monthly_played.append(played_count)

    played_results = [item for item in results if item["played"]]
    return {
        "uploadedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "rows": fixtures,
        "monthlyPlanned": monthly_planned,
        "monthlyPlayed": monthly_played,
        "reportSummary": {
            "totalMatchesPlayed": len(played_results),
            "totalWins": sum(1 for item in played_results if item["won"]),
            "teamProgress": team_progress,
            "highestAvgPointsPerMatch": top_rankings[0][1] if top_rankings else "",
            "highestAvgTeams": [item[0] for item in top_rankings if item[1] == top_rankings[0][1]] if top_rankings else [],
            "highestAvgRankings": [
                {"team": team, "avgValue": average, "percentValue": percent}
                for team, average, percent in top_rankings
            ],
        },
        "portalFeatures": (update_rows.get(5, {}).get("A") or "").strip(),
    }


def prepare_preview(workbook_path: Path, preview_dir: Path) -> dict[str, object]:
    importer = load_importer()
    payload = build_input_template_payload(workbook_path, importer)
    if payload is None:
        payload = importer.build_payload(workbook_path)

    for filename in ("index.html", "app.js", "styles.css", ".nojekyll"):
        source = PROJECT_DIR / filename
        if source.exists():
            shutil.copy2(source, preview_dir / filename)

    assets_source = PROJECT_DIR / "assets"
    if assets_source.exists():
        shutil.copytree(assets_source, preview_dir / "assets")

    data_dir = preview_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "fixtures.json").write_text(
        json.dumps(payload, indent=2) + "\n", encoding="utf-8"
    )
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Preview a portal workbook locally without changing repository data."
    )
    parser.add_argument("workbook", nargs="?", type=Path, default=DEFAULT_WORKBOOK)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    workbook_path = args.workbook.expanduser().resolve()
    if not workbook_path.exists():
        raise FileNotFoundError(f"Workbook not found: {workbook_path}")
    if workbook_path.suffix.lower() not in {".xlsx", ".xlsm"}:
        raise ValueError("Choose an .xlsx or .xlsm workbook.")

    with tempfile.TemporaryDirectory(prefix="tennis-portal-preview-") as temp_path:
        preview_dir = Path(temp_path)
        payload = prepare_preview(workbook_path, preview_dir)
        port = available_port(args.port)
        url = f"http://127.0.0.1:{port}/"

        handler = lambda *handler_args, **handler_kwargs: SimpleHTTPRequestHandler(
            *handler_args, directory=str(preview_dir), **handler_kwargs
        )
        server = ThreadingHTTPServer(("127.0.0.1", port), handler)

        print()
        print("Local tennis portal preview is ready")
        print(f"Workbook: {workbook_path}")
        print(f"Fixtures loaded: {len(payload.get('rows', []))}")
        print(f"Preview: {url}")
        print("Repository data was not changed and nothing will be published.")
        print("Press Control+C here to stop the preview.")
        print()

        if not args.no_browser:
            threading.Timer(0.5, lambda: webbrowser.open(url)).start()

        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nPreview stopped.")
        finally:
            server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
