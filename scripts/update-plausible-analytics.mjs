import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const siteId = process.env.PLAUSIBLE_SITE_ID;
const apiKey = process.env.PLAUSIBLE_API_KEY;
const outputPath = new URL("../data/analytics.json", import.meta.url);
const captainPagePath = "/";

if (!siteId || !apiKey) {
  throw new Error("PLAUSIBLE_SITE_ID and PLAUSIBLE_API_KEY must be set.");
}

const todayResponse = await fetch("https://plausible.io/api/v2/query", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    site_id: siteId,
    metrics: ["pageviews"],
    date_range: "today",
    filters: [["is", "event:page", [captainPagePath]]],
  }),
});

if (!todayResponse.ok) {
  throw new Error(`Plausible API request failed with status ${todayResponse.status}.`);
}

const todayPayload = await todayResponse.json();
const viewsToday = Number(todayPayload?.results?.[0]?.metrics?.[0] || 0);

const now = new Date();
const weekStart = new Date(now);
const day = weekStart.getDay();
const daysSinceMonday = (day + 6) % 7;
weekStart.setDate(weekStart.getDate() - daysSinceMonday);
weekStart.setHours(6, 0, 0, 0);
if (now < weekStart) {
  weekStart.setDate(weekStart.getDate() - 7);
}

const weekResponse = await fetch("https://plausible.io/api/v2/query", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    site_id: siteId,
    metrics: ["pageviews"],
    date_range: "custom",
    date: [
      weekStart.toISOString().slice(0, 10),
      now.toISOString().slice(0, 10),
    ],
    filters: [["is", "event:page", [captainPagePath]]],
  }),
});

if (!weekResponse.ok) {
  throw new Error(`Plausible API request failed with status ${weekResponse.status}.`);
}

const weekPayload = await weekResponse.json();
const pageviews = Number(weekPayload?.results?.[0]?.metrics?.[0] || 0);
const updatedAt = new Date().toISOString().slice(0, 10);

await mkdir(dirname(outputPath.pathname), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    { viewsToday, totalViewsThisWeek: pageviews, updatedAt, pageviews },
    null,
    2
  )}\n`
);

console.log(
  `Updated analytics for ${captainPagePath}: ${viewsToday} views today and ${pageviews} views this week.`
);
