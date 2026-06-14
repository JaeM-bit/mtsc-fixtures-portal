import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const siteId = process.env.PLAUSIBLE_SITE_ID;
const apiKey = process.env.PLAUSIBLE_API_KEY;
const outputPath = new URL("../data/analytics.json", import.meta.url);
const captainPagePath = "/";

if (!siteId || !apiKey) {
  throw new Error("PLAUSIBLE_SITE_ID and PLAUSIBLE_API_KEY must be set.");
}

const response = await fetch("https://plausible.io/api/v2/query", {
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

if (!response.ok) {
  throw new Error(`Plausible API request failed with status ${response.status}.`);
}

const payload = await response.json();
const pageviews = Number(payload?.results?.[0]?.metrics?.[0] || 0);
const averageViewsPerWeek = Math.round(pageviews / 4);
const updatedAt = new Date().toISOString().slice(0, 10);

await mkdir(dirname(outputPath.pathname), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ averageViewsPerWeek, updatedAt, pageviews, periodDays: 28 }, null, 2)}\n`
);

console.log(
  `Updated analytics for ${captainPagePath}: ${averageViewsPerWeek} views/week from ${pageviews} pageviews.`
);
