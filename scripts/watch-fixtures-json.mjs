import { access, copyFile, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = fileURLToPath(new URL("..", import.meta.url));
const downloadsDir = join(process.env.HOME || "", "Downloads");
const targetFile = join(projectDir, "data", "fixtures.json");
const watchedPattern = /^fixtures.*\.json$/i;
let pending = false;
let timer = null;

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function getLatestDownload() {
  const entries = await readdir(downloadsDir, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isFile() || !watchedPattern.test(entry.name)) continue;
    const fullPath = join(downloadsDir, entry.name);
    const stats = await stat(fullPath);
    candidates.push({ path: fullPath, mtimeMs: stats.mtimeMs });
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.path || null;
}

async function validateFixturesJson(sourceFile) {
  const payload = JSON.parse(await readFile(sourceFile, "utf8"));
  if (!payload || typeof payload !== "object") {
    throw new Error("fixtures JSON must be an object.");
  }
  if (!Array.isArray(payload.rows)) {
    throw new Error("fixtures JSON is missing a rows array.");
  }
  if (!Array.isArray(payload.monthlyPlanned)) {
    throw new Error("fixtures JSON is missing a monthlyPlanned array.");
  }
  return payload;
}

async function importLatestDownload() {
  const latestFile = await getLatestDownload();
  if (!latestFile) {
    return;
  }

  const sourceStats = await stat(latestFile);
  const targetExists = await fileExists(targetFile);
  if (targetExists) {
    const targetStats = await stat(targetFile);
    if (targetStats.mtimeMs >= sourceStats.mtimeMs) {
      return;
    }
  }

  const payload = await validateFixturesJson(latestFile);
  await mkdir(dirname(targetFile), { recursive: true });
  await copyFile(latestFile, targetFile);
  await rm(latestFile);

  console.log(
    `Imported ${basename(latestFile)} -> data/fixtures.json (${payload.rows.length} rows, ${payload.monthlyPlanned.length} monthly rows).`
  );
}

function scheduleImport() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    pending = false;
    try {
      await importLatestDownload();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }
  }, 400);
}

async function main() {
  if (!(await fileExists(downloadsDir))) {
    throw new Error(`Downloads folder not found: ${downloadsDir}`);
  }

  console.log("Watching Downloads for fixtures*.json files...");
  console.log(`Target: ${targetFile}`);
  await importLatestDownload();

  watch(downloadsDir, { persistent: true }, (_eventType, filename) => {
    if (!filename || !watchedPattern.test(String(filename))) return;
    if (pending) return;
    pending = true;
    scheduleImport();
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
