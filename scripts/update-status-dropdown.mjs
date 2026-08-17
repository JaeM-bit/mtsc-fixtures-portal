import fs from "node:fs/promises";

const worksheetPath = process.argv[2];
if (!worksheetPath) throw new Error("Usage: node update-status-dropdown.mjs /path/to/sheet2.xml");

const oldList = '"Published,Postponed,Cancelled"';
const newList = '"To Do,Booked,Offer,Rain Date,In Progress,Rebook,TBC,Played,Cancelled"';
const xml = await fs.readFile(worksheetPath, "utf8");
if (!xml.includes(oldList)) throw new Error("Existing status validation list was not found.");
await fs.writeFile(worksheetPath, xml.replace(oldList, newList), "utf8");
