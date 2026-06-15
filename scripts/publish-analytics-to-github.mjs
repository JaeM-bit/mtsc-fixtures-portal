import { readFile } from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const branch = process.env.GITHUB_BRANCH || "main";
const path = "data/analytics.json";
const apiBase = "https://api.github.com";

if (!token || !repository) {
  throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY must be set.");
}

const filePath = new URL("../data/analytics.json", import.meta.url);
const content = await readFile(filePath, "utf8");
const encodedContent = Buffer.from(content, "utf8").toString("base64");
const [owner, repo] = repository.split("/");

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
};

let sha;
const existingResponse = await fetch(
  `${apiBase}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
  { headers }
);

if (existingResponse.ok) {
  const existing = await existingResponse.json();
  sha = existing.sha;
  const existingContent = Buffer.from(existing.content || "", "base64").toString("utf8");
  if (existingContent === content) {
    console.log("Analytics file already up to date.");
    process.exit(0);
  }
}

const putResponse = await fetch(
  `${apiBase}/repos/${owner}/${repo}/contents/${path}`,
  {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: "Update Plausible analytics",
      content: encodedContent,
      branch,
      ...(sha ? { sha } : {}),
    }),
  }
);

if (!putResponse.ok) {
  throw new Error(
    `GitHub Contents API update failed with status ${putResponse.status}: ${await putResponse.text()}`
  );
}

console.log("Published analytics file to GitHub.");
