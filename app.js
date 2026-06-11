const state = {
  current: [],
  revised: [],
  rows: [],
  monthlyPlanned: [],
};

const seasonStart = "2026-04-01";
const seasonEnd = "2026-08-31";
const storageKey = "mtsc-fixtures-published-data";
const publishedJsonUrl = "data/fixtures.json";

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
  searchInput: document.querySelector("#searchInput"),
  teamFilter: document.querySelector("#teamFilter"),
  nextDaysInput: document.querySelector("#nextDaysInput"),
  exportCsv: document.querySelector("#exportCsv"),
  fixturesBody: document.querySelector("#fixturesBody"),
  visibleCount: document.querySelector("#visibleCount"),
  reportBody: document.querySelector("#reportBody"),
  printReport: document.querySelector("#printReport"),
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

function displayUploadStatus(uploadedAt) {
  if (!uploadedAt) return;
  els.fileStatus.textContent = `File Uploaded on ${formatUploadDateTime(new Date(uploadedAt))}`;
  els.parseStatus.textContent = "";
}

function buildPublishedPayload(rows, monthlyPlanned, uploadedAt = new Date().toISOString()) {
  return {
    uploadedAt,
    rows,
    monthlyPlanned,
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
    const statusCell = getCell(sheet, rowIndex, 11);
    const statusText = cellText(statusCell);

    const row = {
      id: "",
      date: excelDateToIso(dateCell.v, dateCell.w),
      day: cellText(dayCell),
      time: excelTimeToText(timeCell.v, timeCell.w),
      team: cellText(homeCell),
      opponent: cellText(awayCell),
      venue: "",
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
    const countText = cellText(getCell(sheet, rowIndex, 7));
    const count = Number(String(countText).replace(/,/g, ""));

    if (month || countText) {
      rows.push({
        month: month || "Unspecified",
        count: Number.isFinite(count) ? count : 0,
      });
    }
  }

  return rows;
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

function sheetToRows(workbook) {
  const byDateSheetName = workbook.SheetNames.find((name) => normaliseKey(name) === "by date");

  if (!byDateSheetName) {
    throw new Error('No "by date" tab found in this workbook.');
  }

  const sheet = workbook.Sheets[byDateSheetName];
  return {
    rows: mapByDateColumns(sheet),
    monthlyPlanned: readMonthlyPlanned(sheet),
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
  const nextDays = Number(els.nextDaysInput.value);
  const useNextDays = els.nextDaysInput.value !== "" && Number.isFinite(nextDays);
  const today = startOfDay(new Date());
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + Math.max(0, nextDays));

  return state.rows.filter((row) => {
    const haystack = normaliseKey(
      [row.date, row.day, row.time, row.team, row.opponent, row.status].join(" ")
    );
    const rowDate = new Date(`${row.date}T12:00:00`);
    const matchesNextDays =
      !useNextDays ||
      (!Number.isNaN(rowDate.getTime()) && rowDate >= today && rowDate <= endDate);

    return (
      (!term || haystack.includes(term)) &&
      (!team || row.team === team || row.opponent === team) &&
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
          <td><span class="badge">${labelStatus(row)}</span></td>
        </tr>
      `
    )
    .join("");
}

function labelStatus(row) {
  return row.status || "Published";
}

function renderKpis() {
  const milfordTeams = new Set(
    state.rows
      .flatMap((row) => [row.team, row.opponent])
      .filter((team) => normaliseKey(team).startsWith("milford"))
  );
  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + 14);
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
      <div class="summary-item">
        <strong>Matches currently planned by month</strong>
        <p>No monthly planned totals found in by date cells B108:B112 and H108:H112.</p>
      </div>
    `;
  }

  const items = state.monthlyPlanned
    .map(
      (row) => `
        <li>
          <span>${escapeHtml(row.month)}</span>
          <strong>${escapeHtml(row.count)}</strong>
        </li>
      `
    )
    .join("");

  return `
    <div class="summary-item">
      <strong>Matches currently planned by month</strong>
      <ul class="monthly-planned">${items}</ul>
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

function setRows(currentRows, revisedRows = state.revised, monthlyPlanned = state.monthlyPlanned) {
  state.current = ensureIds(currentRows);
  state.revised = ensureIds(revisedRows);
  state.monthlyPlanned = monthlyPlanned;
  state.rows = compareRows(state.current, state.revised);
  renderAll();
}

function savePublishedData(rows, monthlyPlanned) {
  const payload = buildPublishedPayload(rows, monthlyPlanned);
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

if (els.currentFile) {
  els.currentFile.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      els.fileStatus.textContent = `Loading ${file.name}...`;
      const workbookData = await readWorkbook(file);
      const published = savePublishedData(workbookData.rows, workbookData.monthlyPlanned);
      setRows(published.rows, [], published.monthlyPlanned);
      displayUploadStatus(published.uploadedAt);
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
      : buildPublishedPayload(state.current, state.monthlyPlanned);
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

if (els.exportCsv) {
  els.exportCsv.addEventListener("click", () => {
    downloadCsv(applyFilters());
  });
}

els.printReport.addEventListener("click", () => {
  window.print();
});

async function initialisePublishedData() {
  const sharedData = await loadSharedPublishedData();
  const publishedData = sharedData || loadPublishedData();

  if (publishedData) {
    setRows(publishedData.rows || [], [], publishedData.monthlyPlanned || []);
    displayUploadStatus(publishedData.uploadedAt);
    if (els.downloadJson) {
      els.downloadJson.disabled = false;
      els.downloadJson.dataset.payload = JSON.stringify(publishedData);
    }
  }
}

initialisePublishedData();
