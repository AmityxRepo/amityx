#!/usr/bin/env node
// Vocabulary gate — P.9 / D-012 (docs/PRODUCT_SPEC.md §P.9, app/DESIGN.md §1).
//
// Greps user-facing copy (JSX text + string literals) for the P.9 "Never say"
// terms. Schema/code identifiers (repository layer, types, table/column names)
// are allowed to stay precise — this only checks what a human would actually
// read on screen, so it scans:
//   - src/pages/marketing/**, src/pages/app/**, src/pages/dev/**
//   - src/components/** (excluding CRM-specific components)
// and skips:
//   - src/pages/crm/** and any Crm* component — P.9's vocabulary table row for
//     /crm says plain CRM terms are fine for our (internal, trained) staff.
//   - src/repository/**, src/lib/** — schema-precise code, not UI copy.
//
// Reused by T-009's vocabulary gate. Heuristic, not a full parser: if a banned
// word is ever needed as a legitimate non-UI identifier inside a scanned file,
// alias it locally rather than weakening this script.
import { readFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(root, '..', 'src')

// Flattened P.9 "Never say" column (English UI-copy bans). Multi-word phrases
// are matched as phrases; everything is case-insensitive with word boundaries.
const BANNED_TERMS = [
  'tenant',
  'organization',
  'facility',
  'programs',
  'offerings',
  'catalog',
  'sessions',
  'instances',
  'events',
  'attendance capture',
  'logging',
  'observations',
  'documentation',
  'leads',
  'conversions',
  'pipeline',
  'guardians',
  'contacts',
  'users',
  'broadcasts',
  'media assets',
  'moments',
  'enrollments',
  'registrations',
]

const SCAN_ROOTS = [
  path.join(srcDir, 'pages', 'marketing'),
  path.join(srcDir, 'pages', 'app'),
  path.join(srcDir, 'pages', 'dev'),
  path.join(srcDir, 'components'),
]

const EXCLUDE_DIR_SEGMENTS = ['crm']

function isExcludedPath(filePath) {
  const normalized = filePath.split(path.sep).join('/')
  if (/\/crm\//i.test(normalized)) return true
  if (/^Crm[A-Z]/.test(path.basename(filePath))) return true // e.g. CrmLayout.tsx, CrmHome.tsx
  return false
}

function walk(dir, files = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return files
  }
  for (const entry of entries) {
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, files)
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

/** Extract only the text a user could actually read: JSX text nodes and string
 * literals. This avoids flagging legitimate code identifiers (e.g. a `programs`
 * variable from the repository layer) that never render as copy. */
function extractCopy(source) {
  const chunks = []
  const stringRe = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g
  let m
  while ((m = stringRe.exec(source))) chunks.push(m[0])

  const jsxTextRe = />([^<>{}\n]+)</g
  while ((m = jsxTextRe.exec(source))) chunks.push(m[1])

  return chunks.join('\n')
}

function checkFile(filePath) {
  const source = readFileSync(filePath, 'utf8')
  const copy = extractCopy(source)
  const hits = []
  for (const term of BANNED_TERMS) {
    const re = new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (re.test(copy)) hits.push(term)
  }
  return hits
}

function main() {
  const files = SCAN_ROOTS.flatMap((dir) => walk(dir)).filter((f) => !isExcludedPath(f))

  let failed = false
  for (const file of files) {
    const hits = checkFile(file)
    if (hits.length > 0) {
      failed = true
      console.error(`${path.relative(process.cwd(), file)}: banned term(s) → ${hits.join(', ')}`)
    }
  }

  if (failed) {
    console.error('\nlint:vocab FAILED — replace the term(s) above with the P.9 canonical UI word (app/DESIGN.md §1).')
    process.exit(1)
  }

  console.log(`lint:vocab passed — ${files.length} UI file(s) scanned, no banned terms found.`)
}

main()
