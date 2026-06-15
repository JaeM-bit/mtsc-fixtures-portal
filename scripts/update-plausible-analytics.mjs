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

const weekResponse = await fetch("https://plausible.io/api/v2/query", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    site_id: siteId,
    metrics: ["pageviews"],
    date_range: "28d",
    filters: [["is", "event:page", [captainPagePath]]],
  }),
});

if (!weekResponse.ok) {
  throw new Error(`Plausible API request failed with status ${weekResponse.status}.`);
}

const weekPayload = await weekResponse.json();
const pageviews = Number(weekPayload?.results?.[0]?.metrics?.[0] || 0);
const averageViewsPerWeek = Math.round(pageviews / 4);
const updatedAt = new Date().toISOString().slice(0, 10);

await mkdir(dirname(outputPath.pathname), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    { viewsToday, averageViewsPerWeek, updatedAt, pageviews, periodDays: 28 },
    null,
    2
  )}\n`
);

console.log(
  `Updated analytics for ${captainPagePath}: ${viewsToday} views today and ${averageViewsPerWeek} views/week from ${pageviews} pageviews.`
);
