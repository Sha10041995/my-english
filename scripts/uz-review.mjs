#!/usr/bin/env node
/**
 * Uzbek review workflow (no dependencies).
 *
 *   node scripts/uz-review.mjs export  [out.csv]   -> docs/uzbek-review.csv (default)
 *   node scripts/uz-review.mjs apply   [in.csv]    -> patches source files with `uzbek_reviewed` values
 *
 * The export finds every Uzbek string that sits next to its English counterpart in the source:
 *   - { en: "...", uz: "..." } / { uz: "...", en: "..." } objects
 *   - L("uz", "en") helper calls in components (Uzbek first) and L("en", "uz") in src/content (English first)
 *   - the meaningUz argument of vocabulary entries v("id", "lemma", level, pos, "meaningUz", ...)
 * Dynamic template-literal strings are reported but cannot be exported (they need manual review).
 * `apply` replaces the exact original literal with the reviewed one, only when it occurs exactly once in that file.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const SRC = path.join(root, "src");
const STR = String.raw`"((?:[^"\\]|\\.)*)"`;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(d.name) ? [p] : [];
  });
}

const unq = (s) => JSON.parse(`"${s}"`);
const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;

export function collect() {
  const rows = [];
  let dynamic = 0;
  for (const file of walk(SRC)) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file).replaceAll("\\", "/");
    const inContent = rel.startsWith("src/content/");
    const add = (kind, en, uz, rawUz, idx) => rows.push({ file: rel, line: lineOf(text, idx), kind, en: unq(en), uz: unq(uz), rawUz });

    for (const m of text.matchAll(new RegExp(String.raw`\{\s*(uz|en):\s*${STR},\s*(uz|en):\s*${STR}\s*\}`, "g"))) {
      const [, k1, s1, k2, s2] = m;
      if (k1 === k2) continue;
      const en = k1 === "en" ? s1 : s2;
      const uz = k1 === "uz" ? s1 : s2;
      add("object", en, uz, uz, m.index);
    }
    // L("a","b") and ex("a","b")
    for (const m of text.matchAll(new RegExp(String.raw`\b(?:L|ex)\(\s*${STR},\s*${STR}\s*\)`, "g"))) {
      const [, a, b] = m;
      if (inContent) add("L(en,uz)", a, b, b, m.index);
      else add("L(uz,en)", b, a, a, m.index);
    }
    for (const m of text.matchAll(new RegExp(String.raw`\bv\(\s*${STR},\s*${STR},\s*"(?:A0|A1|A2|B1|B2)",\s*${STR},\s*${STR},\s*${STR}`, "g"))) {
      add("vocab", m[6], m[5], m[5], m.index);
    }
    dynamic += (text.match(/\bL\(\s*`/g) ?? []).length + (text.match(/\bL\([^`)]*,\s*`/g) ?? []).length;
  }
  // de-duplicate identical (file, uz) pairs
  const seen = new Set();
  return { rows: rows.filter((r) => (seen.has(r.file + "\u0000" + r.rawUz) ? false : seen.add(r.file + "\u0000" + r.rawUz))), dynamic };
}

const csvCell = (s) => `"${String(s).replaceAll('"', '""')}"`;

function parseCsv(text) {
  const out = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.length > 1 || row[0] !== "") out.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

const cmd = process.argv[2];
if (cmd === "export") {
  const out = process.argv[3] ?? path.join(root, "docs", "uzbek-review.csv");
  const { rows, dynamic } = collect();
  const header = ["file", "line", "kind", "english", "uzbek_draft", "uzbek_reviewed", "reviewer_notes"];
  const body = rows.map((r) => [r.file, r.line, r.kind, r.en, r.uz, "", ""].map(csvCell).join(","));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, "﻿" + [header.join(","), ...body].join("\n") + "\n", "utf8");
  console.log(`Exported ${rows.length} Uzbek strings to ${path.relative(root, out)}. ${dynamic} dynamic template strings need manual review.`);
} else if (cmd === "apply") {
  const input = process.argv[3] ?? path.join(root, "docs", "uzbek-review.csv");
  const rows = parseCsv(fs.readFileSync(input, "utf8").replace(/^﻿/, ""));
  const [header, ...data] = rows;
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  let applied = 0;
  let skipped = 0;
  for (const r of data) {
    const reviewed = (r[idx.uzbek_reviewed] ?? "").trim();
    const draft = r[idx.uzbek_draft];
    if (!reviewed || reviewed === draft) continue;
    const file = path.join(root, r[idx.file]);
    const text = fs.readFileSync(file, "utf8");
    const from = JSON.stringify(draft);
    const to = JSON.stringify(reviewed);
    const count = text.split(from).length - 1;
    if (count !== 1) {
      console.warn(`SKIP ${r[idx.file]}:${r[idx.line]} – literal found ${count} times (edit manually): ${draft.slice(0, 50)}`);
      skipped++;
      continue;
    }
    fs.writeFileSync(file, text.replace(from, () => to), "utf8");
    applied++;
  }
  const reviewedTotal = data.filter((r) => (r[idx.uzbek_reviewed] ?? "").trim()).length;
  fs.writeFileSync(
    path.join(root, "docs", "uzbek-review-status.json"),
    JSON.stringify({ updatedAt: new Date().toISOString(), totalStrings: data.length, reviewedRows: reviewedTotal, applied, skipped }, null, 2) + "\n",
  );
  console.log(`Applied ${applied}, skipped ${skipped}.`);
} else {
  console.log("Usage: node scripts/uz-review.mjs export|apply [file.csv]");
  process.exit(1);
}
