---
name: write-docs
description: >-
  Writes or updates technical documentation in docs/ for this project using
  concise style and fixed templates. Use when creating or editing project docs,
  when the user mentions docs/, feature documentation, architecture.md,
  docs/index.md, or asks to document a feature or change.
---

# Write project documentation

**Scope:** The user (or request) defines what to document—e.g. a feature, a change set, or which files to cover. If unclear, ask what should be in `docs/` before writing.

## Workflow

1. **Read** the relevant source files, `AGENTS.md` (or `GEMINI.md`), and existing `docs/` as needed.
2. **Write** the doc (or only the sections that need updating) following the standards below.
3. If updating an existing file, output **only the changed sections**; if creating a new file, output the **full file**.

---

## Documentation standards

Follow these rules **exactly** when writing any file under `docs/`.

### Style

- **No prose padding.** Every sentence must carry information. Cut filler ("This section describes…", "It is important to note…").
- **Prefer tables and lists** over paragraphs for comparisons, options, field definitions, and step sequences.
- **Code blocks** for any shell command, file path, type signature, or config snippet — never inline.
- **One H1 per file** (the title). Use H2 for major sections, H3 only when a section genuinely needs subsections.
- Use `backticks` for: file paths, function/variable names, CLI flags, env vars, HTTP routes, column names.
- Describe what is **actually built**, not what was planned. Note real deviations explicitly.

### Structure by doc type

**Feature doc** (`docs/<feature>.md`):
```
# <Feature Name>

## What it does
One paragraph max — the problem it solves and the user-visible outcome.

## Implementation
- Key files and their roles (table or list)
- Data flow / request lifecycle if non-obvious
- Any non-obvious invariants or constraints

## API / Schema (if applicable)
Table of endpoints or columns

## Config / Env vars (if applicable)

## Known limitations / deviations from plan
```

**Architecture update** (`docs/architecture.md`):
- Add to the relevant table or section in place — don't append a new section unless genuinely new.
- Update folder layout tree if files moved or added.

**Index update** (`docs/index.md`):
- Add one line to the "Docs in This Folder" list for any new doc file.
- Add a row to "Key Deviations" only if something materially differs from what was planned.

### What NOT to write

- Don't document the "why we chose X over Y" unless it will prevent someone from reverting the decision.
- Don't repeat what is already readable in the code (e.g. don't describe every field of a schema that has clear names).
- Don't add "future work" or "TODO" sections — use GitHub issues for that.
- Don't write a doc for a change that is fully self-explanatory from `AGENTS.md` and the code.

---

## Also follow

- Repo rules in `.agents/rules/agent-workflow.md` (or `.cursor/rules/`, `.claude/rules/`) for when to update which doc file after code changes.
