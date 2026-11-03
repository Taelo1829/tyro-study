#!/usr/bin/env node
/**
 * Prints the CHANGELOG.md section for a version, for the GitHub release body.
 *
 *   node scripts/ci/release-notes.mjs 1.0.0 > notes.md
 *
 * Exits 1 if CHANGELOG.md has no "## [1.0.0]" section, so a release can't go
 * out without notes.
 */
import { readFileSync } from "node:fs"

const version = (process.argv[2] || "").replace(/^v/, "")
if (!version) { console.error("Usage: release-notes.mjs <version>"); process.exit(2) }

const text = readFileSync("CHANGELOG.md", "utf8")
const lines = text.split(/\r?\n/)
const start = lines.findIndex(l => l.startsWith(`## [${version}]`))
if (start === -1) {
  console.error(`CHANGELOG.md has no "## [${version}]" section. Move the Unreleased notes under it first.`)
  process.exit(1)
}
const end = lines.findIndex((l, i) => i > start && /^## \[/.test(l))
const body = lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim()
if (!body) { console.error(`The ${version} section is empty.`); process.exit(1) }
console.log(body)
