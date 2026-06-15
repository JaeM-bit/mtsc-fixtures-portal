import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const siteId = process.env.PLAUSIBLE_SITE_ID;
const apiKey = process.env.PLAUSIBLE_API_KEY;
const outputPath = new URL("../data/analytics.json", import.meta.url);
const reportingTimeZone = "Europe/London";

function formatYmd(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getLondonDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return new Date(Date.UTC(map.year, map.month - 1, map.day));
}

function getMondayToSundayWindow(timeZone) {
  const currentLondonDate = getLondonDateParts(new Date(), timeZone);
  const dayOfWeek = currentLondonDate.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(currentLondonDate);
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  return {
    start: formatYmd(monday),
    end: formatYmd(sunday),
  };
}

if (!siteId || !apiKey) {
  throw new Error("PLAUSIBLE_SITE_ID and PLAUSIBLE_API_KEY must be set.");
}

const { start: weekStart, end: weekEnd } = getMondayToSundayWindow(
  reportingTimeZone
);

async function queryPlausible(dateRange, metric) {
  const response = await fetch("https://plausible.io/api/v2/query", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site_id: siteId,
      metrics: [metric],
      date_range: dateRange,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Plausible API request failed for ${metric} with status ${response.status}: ${await response.text()}`
    );
  }

  const payload = await response.json();
  return Number(payload?.results?.[0]?.metrics?.[0] || 0);
}

const viewsToday = await queryPlausible("day", "pageviews");
const uniqueVisitorsToday = await queryPlausible("day", "visitors");
const pageviews = await queryPlausible([weekStart, weekEnd], "pageviews");
const uniqueVisitorsThisWeek = await queryPlausible([weekStart, weekEnd], "visitors");
const updatedAt = new Date().toISOString().slice(0, 10);

await mkdir(dirname(outputPath.pathname), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      viewsToday,
      uniqueVisitorsToday,
      totalViewsThisWeek: pageviews,
      uniqueVisitorsThisWeek,
      updatedAt,
      pageviews,
    },
    null,
    2
  )}\n`
);

console.log(
  `Updated captain analytics: ${viewsToday} pageviews today, ${uniqueVisitorsToday} visitors today, ${pageviews} pageviews this week, ${uniqueVisitorsThisWeek} visitors this week.`
);
