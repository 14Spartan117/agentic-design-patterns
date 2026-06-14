#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const indexPath = join(root, "index.html");
const html = readFileSync(indexPath, "utf8");
const errors = [];

const report = (ok, message) => console.log(`${ok ? "✓" : "✗"} ${message}`);
const fail = (message) => errors.push(message);

function uniqueMatches(source, regex, group = 1) {
  return [...new Set([...source.matchAll(regex)].map((match) => match[group]))];
}

function extractModuleScripts(markup) {
  return [...markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => /\btype\s*=\s*(["'])module\1/i.test(attrs))
    .map(([, attrs, body]) => ({ attrs, body }));
}

function extractImportMap(markup) {
  const match = markup.match(/<script\b[^>]*\btype\s*=\s*(["'])importmap\1[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[2]);
  } catch (error) {
    fail(`importmap JSON is invalid: ${error.message}`);
    return null;
  }
}

function specifierIsMapped(specifier, imports) {
  return Object.keys(imports).some((key) => specifier === key || (key.endsWith("/") && specifier.startsWith(key)));
}

function check(condition, message) {
  if (!condition) fail(message);
  report(condition, message);
}

const allIds = [...html.matchAll(/\bid\s*=\s*(["'])([^"']+)\1/g)].map((match) => match[2]);
const ids = [...new Set(allIds)];
const idCounts = allIds.reduce((counts, id) => counts.set(id, (counts.get(id) || 0) + 1), new Map());
const duplicateIds = [...idCounts].filter(([, count]) => count > 1).map(([id]) => id);
check(duplicateIds.length === 0, duplicateIds.length ? `duplicate IDs found: ${duplicateIds.join(", ")}` : "no duplicate IDs exist");

const domIdsUsedByJs = uniqueMatches(html, /document\.getElementById\(\s*(["'`])([^"'`]+)\1\s*\)/g, 2);
const selectorIdsUsedByJs = uniqueMatches(html, /document\.querySelector\(\s*(["'`])([^"'`]+)\1\s*\)/g, 2)
  .flatMap((selector) => [...selector.matchAll(/#([A-Za-z][\w:-]*)/g)].map((match) => match[1]));
const requiredDomIds = [...new Set([...domIdsUsedByJs, ...selectorIdsUsedByJs])].sort();
const missingDomIds = requiredDomIds.filter((id) => !ids.includes(id));
check(missingDomIds.length === 0, missingDomIds.length ? `missing DOM IDs used by JavaScript: ${missingDomIds.join(", ")}` : `all ${requiredDomIds.length} JavaScript DOM IDs exist`);

const importMap = extractImportMap(html);
const imports = importMap?.imports || {};
const moduleScripts = extractModuleScripts(html);
const moduleSpecifiers = uniqueMatches(moduleScripts.map((script) => script.body).join("\n"), /import\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g);
const missingImportEntries = moduleSpecifiers.filter((specifier) => !specifier.startsWith(".") && !specifier.startsWith("/") && !specifierIsMapped(specifier, imports));
check(Boolean(importMap), "importmap is present and valid JSON");
check(missingImportEntries.length === 0, missingImportEntries.length ? `missing importmap entries for: ${missingImportEntries.join(", ")}` : `all ${moduleSpecifiers.length} bare module imports are mapped`);

const requiredSymbols = [
  "makeStarfield",
  "buildPlanet",
  "loadAssets",
  "buildCockpit",
  "makeShip",
  "makePool",
  "makeInvaderMesh",
  "spawnAsteroidField",
  "spawnPlayerBullet",
  "setupTouch",
  "startGame",
  "endGame",
  "updateTarget",
  "update",
  "updateHudOverlays",
  "animate",
];
const missingSymbols = requiredSymbols.filter((name) => !new RegExp(`\\b(?:function\\s+${name}|const\\s+${name}\\s*=|let\\s+${name}\\s*=|class\\s+${name})\\b`).test(html));
check(missingSymbols.length === 0, missingSymbols.length ? `missing key functions/modules: ${missingSymbols.join(", ")}` : `all ${requiredSymbols.length} key functions/modules are present`);

for (const [index, { body }] of moduleScripts.entries()) {
  const parseableBody = body
    .replace(/^\s*import\s+[^;]+;\s*$/gm, "")
    .replace(/^\s*export\s+/gm, "");
  try {
    new Function(parseableBody);
    report(true, `inline module script ${index + 1} parses`);
  } catch (error) {
    fail(`inline module script ${index + 1} does not parse: ${error.message}`);
    report(false, `inline module script ${index + 1} parses`);
  }
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".git"].includes(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if ([".js", ".mjs"].includes(extname(path))) files.push(path);
  }
  return files;
}

for (const file of walk(root)) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  const label = `${relative(root, file)} parses with node --check`;
  if (result.status === 0) report(true, label);
  else {
    fail(`${label}: ${(result.stderr || result.stdout).trim()}`);
    report(false, label);
  }
}

if (errors.length) {
  console.error("\nValidation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("\nValidation passed.");
