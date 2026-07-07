const state = {
  current: [],
  revised: [],
  rows: [],
  monthlyPlanned: [],
  monthlyPlayed: [],
  analytics: {
    viewsToday: "",
    uniqueVisitorsToday: "",
    totalViewsThisWeek: "",
    uniqueVisitorsThisWeek: "",
    updatedAt: "",
  },
  portalFeatures: "",
  reportSummary: {
    totalMatchesPlayed: "",
    totalWins: "",
    highestAvgPointsPerMatch: "",
    highestAvgTeams: [],
    highestAvgRankings: [],
  },
  homeAwayFilter: "all",
  statusFilter: "all",
};

const seasonStart = "2026-04-01";
const seasonEnd = "2026-08-31";
const storageKey = "mtsc-fixtures-published-data";
const publishedJsonUrl = "data/fixtures.json";
const analyticsJsonUrl = "data/analytics.json";

const sampleRows = [
  {
    date: "2026-06-14",
    time: "10:00",
    team: "Mens 1",
    opponent: "Oakfield A",
    venue: "Home",
    division: "Summer League 1",
    status: "Published",
  },
  {
    date: "2026-06-16",
    time: "18:30",
    team: "Ladies 2",
    opponent: "Hill Park B",
    venue: "Away",
    division: "Summer League 3",
    status: "Published",
  },
  {
    date: "2026-06-19",
    time: "18:45",
    team: "Mixed 1",
    opponent: "Westside",
    venue: "Home",
    division: "Mixed League",
    status: "Rain risk",
  },
  {
    date: "2026-06-23",
    time: "19:00",
    team: "Mens 3",
    opponent: "Northgate C",
    venue: "Away",
    division: "Summer League 5",
    status: "Published",
  },
  {
    date: "2026-07-02",
    time: "18:30",
    team: "Ladies 1",
    opponent: "Elm Grove A",
    venue: "Home",
    division: "Summer League 1",
    status: "Published",
  },
  {
    date: "2026-07-06",
    time: "18:45",
    team: "Mixed 2",
    opponent: "Bramley",
    venue: "Away",
    division: "Mixed League",
    status: "Published",
  },
];

const sampleRevisedRows = sampleRows.map((row) =>
  row.team === "Mixed 1"
    ? { ...row, date: "2026-06-26", status: "Moved after rain" }
    : row
);

sampleRevisedRows.push({
  date: "2026-07-10",
  time: "18:30",
  team: "Mens 2",
  opponent: "Oakfield B",
  venue: "Home",
  division: "Summer League 3",
  status: "Added fixture",
});

const sampleMonthlyPlanned = [
  { month: "June", count: 18 },
  { month: "July", count: 22 },
  { month: "August", count: 16 },
  { month: "September", count: 20 },
  { month: "October", count: 14 },
];

const els = {
  currentFile: document.querySelector("#currentFile"),
  fileStatus: document.querySelector("#fileStatus"),
  parseStatus: document.querySelector("#parseStatus"),
  downloadJson: document.querySelector("#downloadJson"),
  totalMatches: document.querySelector("#totalMatches"),
  teamCount: document.querySelector("#teamCount"),
  homeNextCount: document.querySelector("#homeNextCount"),
  awayNextCount: document.querySelector("#awayNextCount"),
  homeNextRange: document.querySelector("#homeNextRange"),
  awayNextRange: document.querySelector("#awayNextRange"),
  summaryMatchesPlayed: document.querySelector("#summaryMatchesPlayed"),
  summaryWins: document.querySelector("#summaryWins"),
  summaryHighestAvg: document.querySelector("#summaryHighestAvg"),
  portalFeatures: document.querySelector("#portalFeatures"),
  openHelp: document.querySelector("#openHelp"),
  closeHelp: document.querySelector("#closeHelp"),
  helpModal: document.querySelector("#helpModal"),
  didjaKnow: document.querySelector("#didjaKnow"),
  viewsToday: document.querySelector("#viewsToday"),
  uniqueVisitorsToday: document.querySelector("#uniqueVisitorsToday"),
  weeklyViewsAverage: document.querySelector("#weeklyViewsAverage"),
  uniqueVisitorsThisWeek: document.querySelector("#uniqueVisitorsThisWeek"),
  searchInput: document.querySelector("#searchInput"),
  teamFilter: document.querySelector("#teamFilter"),
  nextDaysInput: document.querySelector("#nextDaysInput"),
  homeAwayButtons: document.querySelectorAll("[data-home-away]"),
  statusFilterButtons: document.querySelectorAll("[data-status-filter]"),
  exportCsv: document.querySelector("#exportCsv"),
  fixturesBody: document.querySelector("#fixturesBody"),
  visibleCount: document.querySelector("#visibleCount"),
  reportBody: document.querySelector("#reportBody"),
};

function normaliseKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function localDateToIso(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function utcDateToIso(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function excelDateToIso(value, formattedText = "") {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return localDateToIso(value);
  }

  if (typeof value === "number") {
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    return utcDateToIso(new Date(utcValue * 1000));
  }

  const formattedDate = parseFormattedDate(formattedText);
  if (formattedDate) return formattedDate;

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return localDateToIso(parsed);
  }

  return String(value || "").trim();
}

function parseFormattedDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return "";

  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function excelTimeToText(value, formattedText = "") {
  const formatted = normaliseTimeText(formattedText, value);
  if (formatted) return formatted;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const hours = value.getHours();
    const minutes = value.getMinutes();
    if (!hours && !minutes) return "";
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  if (typeof value === "number") {
    if (value === 0) return "";
    const timePortion = value % 1;
    const totalMinutes = Math.round(timePortion * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return normaliseTimeText(value);
}

function normaliseTimeText(value, rawValue = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if ((text === "0" || text === "0000" || text === "00:00") && (rawValue === 0 || rawValue === "")) {
    return "";
  }

  const compact = text.match(/^(\d{1,2})(\d{2})$/);
  if (compact) {
    return `${compact[1].padStart(2, "0")}:${compact[2]}`;
  }

  const colonTime = text.match(/^(\d{1,2}):(\d{2})/);
  if (colonTime) {
    return `${colonTime[1].padStart(2, "0")}:${colonTime[2]}`;
  }

  return text;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatUploadDateTime(date) {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatKpiWindow(start, end) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(start)} to ${formatter.format(end)}`;
}

function displayUploadStatus(uploadedAt) {
  if (!uploadedAt) return;
  els.fileStatus.textContent = `Last Refresh on ${formatUploadDateTime(new Date(uploadedAt))}`;
  els.parseStatus.textContent = "";
}

function displayPortalFeatures(features) {
  if (!els.portalFeatures) return;
  els.portalFeatures.textContent = features || "No new features noted yet.";
}

function buildPublishedPayload(
  rows,
  monthlyPlanned,
  monthlyPlayed = state.monthlyPlayed,
  reportSummary = state.reportSummary,
  portalFeatures = state.portalFeatures,
  uploadedAt = new Date().toISOString()
) {
  return {
    uploadedAt,
    rows,
    monthlyPlanned,
    monthlyPlayed,
    reportSummary,
    portalFeatures,
  };
}

function getCell(sheet, rowIndex, columnIndex) {
  return sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] || {};
}

function cellText(cell) {
  return String(cell.w || cell.v || "").trim();
}

function mapByDateColumns(sheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:H1");
  const rows = [];
  const lastMatchRowIndex = Math.min(range.e.r, 92);

  for (let rowIndex = range.s.r; rowIndex <= lastMatchRowIndex; rowIndex += 1) {
    const dateCell = getCell(sheet, rowIndex, 2);
    const dayCell = getCell(sheet, rowIndex, 3);
    const timeCell = getCell(sheet, rowIndex, 5);
    const homeCell = getCell(sheet, rowIndex, 6);
    const awayCell = getCell(sheet, rowIndex, 7);
    const homeAwayCell = getCell(sheet, rowIndex, 8);
    const statusCell = getCell(sheet, rowIndex, 11);
    const statusText = cellText(statusCell);

    const row = {
      id: "",
      date: excelDateToIso(dateCell.v, dateCell.w),
      day: cellText(dayCell),
      time: excelTimeToText(timeCell.v, timeCell.w),
      team: cellText(homeCell),
      opponent: cellText(awayCell),
      venue: cellText(homeAwayCell),
      division: "",
      status: statusText || "Published",
      changeStatus: "unchanged",
    };

    const dateKey = normaliseKey(row.date);
    const isHeader = dateKey === "date" || dateKey === "match date";
    const hasMatchData = row.date || row.day || row.time || row.team || row.opponent || statusText;
    const dateAllowed = !row.date || isInSeason(row.date);
    if (
      !isHeader &&
      dateAllowed &&
      hasMatchData
    ) {
      rows.push(row);
    }
  }

  return assignStableIds(rows);
}

function isInSeason(dateValue) {
  return dateValue >= seasonStart && dateValue <= seasonEnd;
}

function monthLabelFromCell(cell) {
  if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
    return cell.v.toLocaleDateString("en-GB", { month: "long" });
  }

  const dateText = parseFormattedDate(cell.w || cell.v);
  if (dateText) {
    const date = new Date(`${dateText}T12:00:00`);
    return date.toLocaleDateString("en-GB", { month: "long" });
  }

  return cellText(cell);
}

function readMonthlyPlanned(sheet) {
  const rows = [];

  for (let rowIndex = 107; rowIndex <= 111; rowIndex += 1) {
    const month = monthLabelFromCell(getCell(sheet, rowIndex, 1));
    const originalText = cellText(getCell(sheet, rowIndex, 2));
    const countText = cellText(getCell(sheet, rowIndex, 7));
    const playedText = cellText(getCell(sheet, rowIndex, 4));
    const original = Number(String(originalText).replace(/,/g, ""));
    const count = Number(String(countText).replace(/,/g, ""));
    const played = Number(String(playedText).replace(/,/g, ""));

    if (month || originalText || countText || playedText) {
      rows.push({
        month: month || "Unspecified",
        originalPlanned: Number.isFinite(original) ? original : "",
        count: Number.isFinite(count) ? count : 0,
        played: Number.isFinite(played) ? played : "",
      });
    }
  }

  return rows;
}

function readMonthlyPlayed(sheet) {
  const rows = [];

  for (let rowIndex = 107; rowIndex <= 111; rowIndex += 1) {
    const playedText = cellText(getCell(sheet, rowIndex, 4));
    const played = Number(String(playedText).replace(/,/g, ""));

    if (playedText) {
      rows.push(Number.isFinite(played) ? played : 0);
    }
  }

  return rows;
}

function readReportSummary(sheet) {
  const totalMatchesPlayed = cellText(getCell(sheet, 20, 19));
  const totalWins = cellText(getCell(sheet, 20, 20));
  const ranked = [];

  for (let rowIndex = 6; rowIndex <= 19; rowIndex += 1) {
    const team = cellText(getCell(sheet, rowIndex, 10));
    const avgText = cellText(getCell(sheet, rowIndex, 25));
    const percentText = cellText(getCell(sheet, rowIndex, 28));
    const avgValue = Number(String(avgText).replace(/,/g, ""));
    const percentValue = Number(String(percentText).replace(/,/g, ""));
    if (!team || !Number.isFinite(avgValue)) continue;
    ranked.push({ team, avgValue, percentValue: Number.isFinite(percentValue) ? percentValue : "" });
  }

  ranked.sort((a, b) => b.avgValue - a.avgValue || a.team.localeCompare(b.team));
  const highestAvgRankings = rankingsForTopScores(ranked, 4);
  const highestAvgPointsPerMatch = highestAvgRankings[0]?.avgValue ?? "";
  const highestAvgTeams = highestAvgRankings
    .filter((item) => item.avgValue === highestAvgPointsPerMatch)
    .map((item) => item.team);

  return {
    totalMatchesPlayed,
    totalWins,
    highestAvgPointsPerMatch,
    highestAvgTeams,
    highestAvgRankings,
  };
}

function rankingsForTopScores(rankings, scoreLimit) {
  const topScores = [];
  rankings.forEach((item) => {
    if (!topScores.includes(item.avgValue)) {
      topScores.push(item.avgValue);
    }
  });
  const allowedScores = new Set(topScores.slice(0, scoreLimit));
  return rankings.filter((item) => allowedScores.has(item.avgValue));
}

function assignStableIds(rows) {
  const counts = new Map();
  return rows.map((row, index) => {
    const base = makeMatchBase(row) || `row-${index}`;
    const occurrence = (counts.get(base) || 0) + 1;
    counts.set(base, occurrence);
    return { ...row, id: `${base}#${occurrence}` };
  });
}

function makeMatchBase(row) {
  return [row.team, row.opponent]
    .map(normaliseKey)
    .filter(Boolean)
    .join("|");
}

function findSheetName(workbook, predicate) {
  return workbook.SheetNames.find((name) => predicate(normaliseKey(name)));
}

function sheetToRows(workbook) {
  const byDateSheetName = findSheetName(workbook, (name) => name === "by date");
  const leagueResultsSheetName = findSheetName(workbook, (name) => name === "league results");
  const portalFeaturesSheetName = findSheetName(workbook, (name) => name === "portal features");

  if (!byDateSheetName) {
    throw new Error('No "by date" tab found in this workbook.');
  }
  if (!leagueResultsSheetName) {
    throw new Error('No "League Results" tab found in this workbook.');
  }

  const sheet = workbook.Sheets[byDateSheetName];
  const leagueResultsSheet = workbook.Sheets[leagueResultsSheetName];
  const portalFeaturesSheet = portalFeaturesSheetName ? workbook.Sheets[portalFeaturesSheetName] : null;
  return {
    rows: mapByDateColumns(sheet),
    monthlyPlanned: readMonthlyPlanned(sheet),
    monthlyPlayed: readMonthlyPlayed(sheet),
    reportSummary: readReportSummary(leagueResultsSheet),
    portalFeatures: portalFeaturesSheet ? cellText(getCell(portalFeaturesSheet, 0, 0)) : "",
  };
}

async function readWorkbook(file) {
  if (!window.XLSX) {
    throw new Error("The Excel parser has not loaded. Check your internet connection.");
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return sheetToRows(workbook);
}

function compareRows(currentRows, revisedRows) {
  if (!currentRows.length || !revisedRows.length) {
    return currentRows.map((row) => ({ ...row, changeStatus: "unchanged" }));
  }

  const revisedById = new Map(revisedRows.map((row) => [row.id, row]));
  const currentById = new Map(currentRows.map((row) => [row.id, row]));
  const compared = currentRows.map((row) => {
    const revised = revisedById.get(row.id);
    if (!revised) return { ...row, changeStatus: "removed" };
    const changedFields = ["date", "day", "time", "status"].filter(
      (field) => String(row[field]) !== String(revised[field])
    );
    return {
      ...revised,
      changeStatus: changedFields.length ? "changed" : "unchanged",
      previous: changedFields.length ? row : null,
      changedFields,
    };
  });

  revisedRows.forEach((row) => {
    if (!currentById.has(row.id)) {
      compared.push({ ...row, changeStatus: "new" });
    }
  });

  return compared.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function applyFilters() {
  const term = normaliseKey(els.searchInput.value);
  const team = els.teamFilter.value;
  const homeAway = state.homeAwayFilter;
  const statusFilter = state.statusFilter;
  const nextDays = Number(els.nextDaysInput.value);
  const useNextDays = els.nextDaysInput.value !== "" && Number.isFinite(nextDays);
  const today = startOfDay(new Date());
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + Math.max(0, nextDays - 1));
  endDate.setHours(23, 59, 59, 999);

  return state.rows.filter((row) => {
    const haystack = rowSearchText(row);
    const rowDate = new Date(`${row.date}T12:00:00`);
    const matchesNextDays =
      !useNextDays ||
      (!Number.isNaN(rowDate.getTime()) && rowDate >= today && rowDate <= endDate);

    return (
      (!term || haystack.includes(term)) &&
      (!team || row.team === team || row.opponent === team) &&
      (homeAway === "all" || normaliseKey(row.venue) === normaliseKey(homeAway)) &&
      (statusFilter === "all" || normaliseKey(labelStatus(row)) === statusFilter) &&
      matchesNextDays
    );
  });
}

function updateSelect(select, values, label) {
  const currentValue = select.value;
  select.innerHTML = `<option value="">${label}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = values.includes(currentValue) ? currentValue : "";
}

function updateFilters() {
  const milfordTeams = [
    ...new Set(
      state.rows
        .flatMap((row) => [row.team, row.opponent])
        .filter((team) => normaliseKey(team).startsWith("milford"))
    ),
  ].sort((a, b) => a.localeCompare(b));
  updateSelect(els.teamFilter, milfordTeams, "All Milford teams");
  updateHomeAwayButtons();
  updateStatusFilterButtons();
}

function updateHomeAwayButtons() {
  els.homeAwayButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.homeAway === state.homeAwayFilter);
    button.setAttribute("aria-pressed", button.dataset.homeAway === state.homeAwayFilter ? "true" : "false");
  });
}

function updateStatusFilterButtons() {
  els.statusFilterButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.statusFilter === state.statusFilter);
    button.setAttribute("aria-pressed", button.dataset.statusFilter === state.statusFilter ? "true" : "false");
  });
}

function renderFixtures() {
  const rows = applyFilters();
  els.visibleCount.textContent = `${rows.length} shown`;

  if (!rows.length) {
    els.fixturesBody.innerHTML =
      '<tr><td colspan="6" class="empty-state">No matches match the current filters.</td></tr>';
    return;
  }

  els.fixturesBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${formatDate(row.date)}</td>
          <td>${escapeHtml(row.day || "-")}</td>
          <td>${row.time || "-"}</td>
          <td>${escapeHtml(row.team || "-")}</td>
          <td>${escapeHtml(row.opponent || "-")}</td>
          <td><span class="badge ${statusBadgeClass(row)}">${labelStatus(row)}</span></td>
        </tr>
      `
    )
    .join("");
}

function rowSearchText(row) {
  return normaliseKey(
    [
      formatDate(row.date),
      row.date,
      row.day,
      row.time,
      row.team,
      row.opponent,
      row.venue,
      labelStatus(row),
    ].join(" ")
  );
}

function labelStatus(row) {
  return row.status || "Published";
}

function statusBadgeClass(row) {
  const status = normaliseKey(labelStatus(row));
  return status === "played" ? "played" : "";
}

function renderKpis() {
  const milfordTeams = new Set(
    state.rows
      .flatMap((row) => [row.team, row.opponent])
      .filter((team) => normaliseKey(team).startsWith("milford"))
  );
  const today = startOfDay(new Date());
  const future = new Date(today);
  future.setDate(today.getDate() + 13);
  future.setHours(23, 59, 59, 999);
  const upcoming = state.rows.filter((row) => {
    const date = new Date(`${row.date}T12:00:00`);
    return !Number.isNaN(date.getTime()) && date >= today && date <= future;
  });
  const homeMatches = upcoming.filter((row) => normaliseKey(row.team).startsWith("milford"));
  const awayMatches = upcoming.filter((row) => normaliseKey(row.opponent).startsWith("milford"));

  els.totalMatches.textContent = state.rows.length;
  els.teamCount.textContent = milfordTeams.size;
  els.homeNextCount.textContent = homeMatches.length;
  els.awayNextCount.textContent = awayMatches.length;
  const windowText = formatKpiWindow(today, future);
  if (els.homeNextRange) els.homeNextRange.textContent = windowText;
  if (els.awayNextRange) els.awayNextRange.textContent = windowText;
  if (els.summaryMatchesPlayed) {
    els.summaryMatchesPlayed.textContent = state.reportSummary.totalMatchesPlayed || "-";
  }
  if (els.summaryWins) {
    els.summaryWins.textContent = state.reportSummary.totalWins || "-";
  }
  if (els.summaryHighestAvg) {
    const rankings = Array.isArray(state.reportSummary.highestAvgRankings)
      ? rankingsForTopScores(state.reportSummary.highestAvgRankings, 4)
      : [];
    els.summaryHighestAvg.innerHTML = rankings.length
      ? `
          <div class="summary-ranking-head">
            <span>Team</span>
            <span>Net Avg<br />Points</span>
            <span>% Played</span>
          </div>
          ${rankings
            .map(
              (item) => `
                <div class="summary-ranking-row">
                  <span class="summary-ranking-team">${escapeHtml(item.team || "-")}</span>
                  <span class="summary-ranking-points">${escapeHtml(formatAveragePoints(item.avgValue))}</span>
                  <span class="summary-ranking-percent">${escapeHtml(formatRankingPercent(item.percentValue))}</span>
                </div>
              `
            )
            .join("")}
        `
      : '<div class="summary-ranking-empty">-</div>';
  }
  renderAnalytics();
}

function renderReport() {
  if (!state.rows.length) {
    els.reportBody.innerHTML =
      '<p class="empty-copy">Load fixtures to see monthly planned matches and matches for the next 7 days.</p>';
    return;
  }

  els.reportBody.innerHTML = `
    ${renderMonthlyPlanned()}
    ${renderNextSevenDays()}
  `;
}

function renderMonthlyPlanned() {
  if (!state.monthlyPlanned.length) {
    return `
      <div class="summary-item monthly-summary">
        <div class="monthly-summary-head">
          <strong>Matches by Month</strong>
          <span>Originally Planned</span>
          <span>Currently Planned</span>
          <span>Played</span>
        </div>
        <p>No monthly totals found in by date cells C108:C112, E108:E112 and H108:H112.</p>
      </div>
    `;
  }

  const playedRows = Array.isArray(state.monthlyPlayed) ? state.monthlyPlayed : [];
  const items = state.monthlyPlanned
    .map((row, index) => {
      const playedRow = playedRows[index];
      const original = formatCompactNumber(row.originalPlanned);
      const planned = formatCompactNumber(row.count);
      const played = formatCompactNumber(
        Number.isFinite(row.played)
          ? row.played
          : Number.isFinite(playedRow)
            ? playedRow
            : Number.isFinite(playedRow?.played)
              ? playedRow.played
              : ""
      );
      return `
        <div class="monthly-row">
          <div class="monthly-month">${escapeHtml(row.month)}</div>
          <div class="monthly-original-count">${escapeHtml(original)}</div>
          <div class="monthly-planned-count">${escapeHtml(planned)}</div>
          <div class="monthly-played monthly-played-count">${escapeHtml(played)}</div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="summary-item monthly-summary">
      <div class="monthly-summary-head">
        <strong>Matches by Month</strong>
        <span>Originally Planned</span>
        <span>Currently Planned</span>
        <span>Played</span>
      </div>
      <div class="monthly-planned" aria-label="Matches by month">${items}</div>
    </div>
  `;
}

function renderNextSevenDays() {
  const today = startOfDay(new Date());
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 7);

  const upcoming = state.rows
    .filter((row) => {
      const date = new Date(`${row.date}T12:00:00`);
      return !Number.isNaN(date.getTime()) && date >= today && date <= endDate;
    })
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  if (!upcoming.length) {
    return `
      <div class="summary-item">
        <strong>All match fixtures for the next 7 days</strong>
        <p>No fixtures scheduled in the next 7 days.</p>
      </div>
    `;
  }

  const fixtures = upcoming
    .map(
      (row) => `
        <li>
          <strong>${formatDate(row.date)} ${escapeHtml(row.time || "")}</strong>
          <span>${escapeHtml(row.team || "-")} vs ${escapeHtml(row.opponent || "-")}</span>
          <em>${escapeHtml(row.day || "Day not specified")}</em>
        </li>
      `
    )
    .join("");

  return `
    <div class="summary-item">
      <strong>All match fixtures for the next 7 days</strong>
      <ul class="next-fixtures">${fixtures}</ul>
    </div>
  `;
}

function countBy(keyOrFn) {
  const getKey = typeof keyOrFn === "function" ? keyOrFn : (row) => row[keyOrFn];
  return state.rows.reduce((map, row) => {
    const key = getKey(row) || "Unspecified";
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

function weekLabel(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `Week of ${formatDate(weekStart.toISOString().slice(0, 10))}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function renderAll() {
  updateFilters();
  renderKpis();
  renderFixtures();
  renderReport();
}

function setRows(
  currentRows,
  revisedRows = state.revised,
  monthlyPlanned = state.monthlyPlanned,
  monthlyPlayed = state.monthlyPlayed,
  reportSummary = state.reportSummary,
  portalFeatures = state.portalFeatures
) {
  state.current = ensureIds(currentRows);
  state.revised = ensureIds(revisedRows);
  state.monthlyPlanned = monthlyPlanned;
  state.monthlyPlayed = monthlyPlayed;
  state.reportSummary = reportSummary || state.reportSummary;
  state.portalFeatures = portalFeatures || state.portalFeatures;
  state.rows = compareRows(state.current, state.revised);
  renderAll();
}

function savePublishedData(
  rows,
  monthlyPlanned,
  monthlyPlayed = state.monthlyPlayed,
  reportSummary = state.reportSummary,
  portalFeatures = state.portalFeatures
) {
  const payload = buildPublishedPayload(
    rows,
    monthlyPlanned,
    monthlyPlayed,
    reportSummary,
    portalFeatures
  );
  localStorage.setItem(storageKey, JSON.stringify(payload));
  return payload;
}

async function loadSharedPublishedData() {
  try {
    const response = await fetch(`${publishedJsonUrl}?v=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.rows)) return null;
    return payload;
  } catch {
    return null;
  }
}

function loadPublishedData() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

function ensureIds(rows) {
  if (!rows.length) return [];
  if (rows.every((row) => row.id)) return rows;
  return assignStableIds(rows);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCompactNumber(value) {
  if (value === "" || value === null || value === undefined) return "-";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(Math.round(numericValue));
}

function formatAveragePoints(value) {
  if (value === "" || value === null || value === undefined) return "-";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(numericValue);
}

function formatRankingPercent(value) {
  if (value === "" || value === null || value === undefined) return "-";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatIsoDateLabel(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function downloadCsv(rows) {
  const headers = ["Date", "Day", "Time", "Milford Team", "Away Team", "Status"];
  const lines = rows.map((row) =>
    [row.date, row.day, row.time, row.team, row.opponent, labelStatus(row)]
      .map((value) => `"${String(value || "").replaceAll('"', '""')}"`)
      .join(",")
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "filtered-fixtures.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadJson(payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fixtures.json";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadAnalyticsData() {
  try {
    const response = await fetch(`${analyticsJsonUrl}?v=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || typeof payload !== "object") return null;
    return payload;
  } catch {
    return null;
  }
}

function renderAnalytics() {
  if (els.viewsToday) {
    els.viewsToday.textContent = formatCompactNumber(state.analytics.viewsToday);
  }
  if (els.uniqueVisitorsToday) {
    els.uniqueVisitorsToday.textContent = formatCompactNumber(
      state.analytics.uniqueVisitorsToday
    );
  }
  if (els.weeklyViewsAverage) {
    els.weeklyViewsAverage.textContent = formatCompactNumber(
      state.analytics.totalViewsThisWeek
    );
  }
  if (els.uniqueVisitorsThisWeek) {
    els.uniqueVisitorsThisWeek.textContent = formatCompactNumber(
      state.analytics.uniqueVisitorsThisWeek
    );
  }
}

function openHelpModal() {
  if (!els.helpModal) return;
  els.helpModal.classList.add("is-open");
  els.helpModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  if (els.closeHelp) els.closeHelp.focus();
}

function closeHelpModal() {
  if (!els.helpModal) return;
  els.helpModal.classList.remove("is-open");
  els.helpModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (els.openHelp) els.openHelp.focus();
}

function closeDidjaTooltip() {
  if (!els.didjaKnow) return;
  els.didjaKnow.classList.remove("is-open");
  els.didjaKnow.setAttribute("aria-expanded", "false");
}

function toggleDidjaTooltip() {
  if (!els.didjaKnow) return;
  const isOpen = els.didjaKnow.classList.toggle("is-open");
  els.didjaKnow.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

if (els.currentFile) {
  els.currentFile.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      els.fileStatus.textContent = `Loading ${file.name}...`;
      const workbookData = await readWorkbook(file);
      const published = savePublishedData(
        workbookData.rows,
        workbookData.monthlyPlanned,
        workbookData.monthlyPlayed,
        workbookData.reportSummary || state.reportSummary,
        workbookData.portalFeatures || state.portalFeatures
      );
      setRows(
        published.rows,
        [],
        published.monthlyPlanned,
        published.monthlyPlayed,
        published.reportSummary,
        published.portalFeatures
      );
      displayUploadStatus(published.uploadedAt);
      displayPortalFeatures(published.portalFeatures);
      if (els.downloadJson) {
        els.downloadJson.disabled = false;
        els.downloadJson.dataset.payload = JSON.stringify(published);
      }
    } catch (error) {
      els.fileStatus.textContent = error.message;
    }
  });
}

if (els.downloadJson) {
  els.downloadJson.addEventListener("click", () => {
    const payload = els.downloadJson.dataset.payload
      ? JSON.parse(els.downloadJson.dataset.payload)
      : buildPublishedPayload(
          state.current,
          state.monthlyPlanned,
          state.monthlyPlayed,
          state.reportSummary,
          state.portalFeatures
        );
    downloadJson(payload);
    els.parseStatus.textContent = "fixtures.json download started.";
  });
}

[els.searchInput, els.teamFilter, els.nextDaysInput].forEach(
  (input) => {
    input.addEventListener("input", () => {
      renderFixtures();
      els.visibleCount.textContent = `${applyFilters().length} shown`;
    });
  }
);

els.homeAwayButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.homeAwayFilter = button.dataset.homeAway || "all";
    updateHomeAwayButtons();
    renderFixtures();
    els.visibleCount.textContent = `${applyFilters().length} shown`;
  });
});

els.statusFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.statusFilter = button.dataset.statusFilter || "all";
    updateStatusFilterButtons();
    renderFixtures();
    els.visibleCount.textContent = `${applyFilters().length} shown`;
  });
});

if (els.exportCsv) {
  els.exportCsv.addEventListener("click", () => {
    downloadCsv(applyFilters());
  });
}

if (els.openHelp) {
  els.openHelp.addEventListener("click", openHelpModal);
}

if (els.closeHelp) {
  els.closeHelp.addEventListener("click", closeHelpModal);
}

if (els.helpModal) {
  els.helpModal.addEventListener("click", (event) => {
    if (event.target === els.helpModal) closeHelpModal();
  });
}

if (els.didjaKnow) {
  els.didjaKnow.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleDidjaTooltip();
  });
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".didja-wrap")) closeDidjaTooltip();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.helpModal?.classList.contains("is-open")) {
    closeHelpModal();
  }
  if (event.key === "Escape" && els.didjaKnow?.classList.contains("is-open")) {
    closeDidjaTooltip();
    els.didjaKnow.focus();
  }
});

async function initialisePublishedData() {
  const sharedData = await loadSharedPublishedData();
  const publishedData = sharedData || loadPublishedData();

  if (publishedData) {
    setRows(
      publishedData.rows || [],
      [],
      publishedData.monthlyPlanned || [],
      publishedData.monthlyPlayed || [],
      publishedData.reportSummary || state.reportSummary,
      publishedData.portalFeatures || state.portalFeatures
    );
    displayUploadStatus(publishedData.uploadedAt);
    displayPortalFeatures(publishedData.portalFeatures);
    if (els.downloadJson) {
      els.downloadJson.disabled = false;
      els.downloadJson.dataset.payload = JSON.stringify(publishedData);
    }
  }
}

async function initialiseAnalytics() {
  const analyticsData = await loadAnalyticsData();
  if (!analyticsData) return;
  state.analytics = {
    viewsToday: analyticsData.viewsToday || "",
    uniqueVisitorsToday: analyticsData.uniqueVisitorsToday || "",
    totalViewsThisWeek: analyticsData.totalViewsThisWeek || "",
    uniqueVisitorsThisWeek: analyticsData.uniqueVisitorsThisWeek || "",
    updatedAt: analyticsData.updatedAt || "",
  };
  renderAnalytics();
}

initialisePublishedData();
initialiseAnalytics();
