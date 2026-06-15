import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const siteId = process.env.PLAUSIBLE_SITE_ID;
const apiKey = process.env.PLAUSIBLE_API_KEY;
const outputPath = new URL("../data/analytics.json", import.meta.url);
const captainPagePath = "/mtsc-fixtures-portal/";
const reportingTimeZone = "Europe/London";

function pad(value) {
  return String(value).padStart(2, "0");
}

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

function zonedLocalToIso(localParts, timeZone) {
  let utc = new Date(
    Date.UTC(
      localParts.year,
      localParts.month - 1,
      localParts.day,
      localParts.hour,
      localParts.minute,
      localParts.second
    )
  );

  for (let i = 0; i < 4; i += 1) {
    const zoned = getZonedParts(utc, timeZone);
    const desiredMs = Date.UTC(
      localParts.year,
      localParts.month - 1,
      localParts.day,
      localParts.hour,
      localParts.minute,
      localParts.second
    );
    const actualMs = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second
    );
    const diffMinutes = (desiredMs - actualMs) / 60000;
    if (diffMinutes === 0) break;
    utc = new Date(utc.getTime() + diffMinutes * 60000);
  }

  const zoned = getZonedParts(utc, timeZone);
  const localMs = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  const offsetMinutes = Math.round((localMs - utc.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetRemainder = pad(absOffset % 60);

  return (
    `${pad(zoned.year)}-${pad(zoned.month)}-${pad(zoned.day)}` +
    `T${pad(zoned.hour)}:${pad(zoned.minute)}:${pad(zoned.second)}` +
    `${sign}${offsetHours}:${offsetRemainder}`
  );
}

function getMondayToSundayWindow(timeZone) {
  const now = new Date();
  const current = getZonedParts(now, timeZone);
  const currentDate = new Date(Date.UTC(current.year, current.month - 1, current.day));
  const dayOfWeek = currentDate.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(currentDate);
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  return {
    start: zonedLocalToIso(
      {
        year: monday.getUTCFullYear(),
        month: monday.getUTCMonth() + 1,
        day: monday.getUTCDate(),
        hour: 0,
        minute: 0,
        second: 0,
      },
      timeZone
    ),
    end: zonedLocalToIso(
      {
        year: sunday.getUTCFullYear(),
        month: sunday.getUTCMonth() + 1,
        day: sunday.getUTCDate(),
        hour: 23,
        minute: 0,
        second: 0,
      },
      timeZone
    ),
  };
}

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

const { start: weekStart, end: weekEnd } = getMondayToSundayWindow(
  reportingTimeZone
);

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
    date: [weekStart, weekEnd],
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
