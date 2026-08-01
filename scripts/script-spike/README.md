# Script module spike

Throwaway validation of the fact-extraction pipeline before any of it becomes a
module. No database, no queue, no UI, and no imports from `src/` — delete this
folder and nothing else changes.

It exists to answer four questions:

1. Does `youtube-transcript.io` return **timestamps**? The provenance design
   depends on it.
2. Is the extracted **fact layer good enough** for a writer to work from?
3. What does one script **cost** in tokens?
4. Which model writes the best **Kuwaiti**?

## Setup

Add to `.env`:

```
YOUTUBE_TRANSCRIPT_TOKEN=...   # youtube-transcript.io → profile → API token
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...          # only if Claude is in the bake-off
```

Then edit `config.ts`:

- `SOURCES` — three real sources from an episode you have **already
  published**. Mix caption kinds if you can: one human-subtitled, one
  auto-captioned only.
- `EPISODE` — name and target runtime.
- `GROUND_TRUTH` — the 15 facts your writer considers essential, taken from the
  finished script and written **before** looking at any output. This is the
  recall check, and it is the one that catches a pipeline that looks accurate
  while quietly dropping half the story.
- `MODELS` — verify the model ids against each provider. They move fast.
- `PRICES` — optional, enables the cost line in the report.

## Running

```bash
npx tsx --env-file=.env scripts/script-spike/run.ts            # all stages
npx tsx --env-file=.env scripts/script-spike/run.ts --from 5   # resume at 5
npx tsx --env-file=.env scripts/script-spike/run.ts --only 6   # one stage
npx tsx --env-file=.env scripts/script-spike/report.ts         # scoring sheet
```

Each stage writes to `output/` and reads the previous stage from disk, so
iterating on the stage 5 prompt never re-fetches or re-translates. `output/` is
gitignored — it holds third-party transcripts.

## Stages

| # | Stage | What it does |
|---|---|---|
| 1 | fetch | All YouTube ids in one batched call. Dumps the raw body and prints the timestamp verdict. |
| 2 | clean | Deterministic per-language cleaning, then punctuation restoration with a word-drift guard. |
| 3 | entities | Extract and cluster spelling variants **before** translation. |
| 4 | translate | Sentence-aligned MSA pivot, entities pinned as tokens, offsets kept. |
| 5 | facts | Attributes and events with normalised values and citations. |
| 6 | conflicts | Attribute group-by, embedding-shortlisted event clustering, typed output. |
| 7 | draft | Kuwaiti draft per competing model, from the fact layer only. |

## Reading the result

`report.ts` counts what it can and leaves four judgements for you and your
writer: entity merge errors, fact precision, conflict noise ratio, and draft
quality. Write your thresholds down before you read any output.

Go/no-go: hallucinations at ~zero, precision high, recall acceptable to the
writer, conflict noise manageable. If extraction fails here, fix it before
writing a line of schema — everything else in the module is built on top of it.

## Architecture note for the real module

The spike is disposable, but the isolation it demonstrates is not. When this
becomes a module, keep it a **self-contained unit inside the existing app**
rather than a separate deployment: it needs Clerk sessions, workspace scoping
and the projects data, and re-plumbing all three across a service boundary
would cost more than it protects.

Isolation comes from boundaries, not from a second repo:

- **Own Postgres schema.** Put every script table in a `script` schema via
  Prisma `multiSchema`. Migrations then never touch CRM tables.
- **No foreign keys into CRM tables.** Store `workspaceId`, `projectId` and
  `taskId` as plain strings, not Prisma relations. This is the load-bearing
  rule — one relation to `Project` welds the modules together and every CRM
  migration starts risking scripts, and vice versa.
- **One directory.** `src/modules/script/` holds actions, jobs, prompts,
  components and types together.
- **One integration file.** `src/modules/script/integration.ts` is the only
  place allowed to read CRM data or write to a task. Enforce it with an ESLint
  `no-restricted-imports` rule so the boundary fails in CI rather than in
  review.
- **Own queue name and worker concurrency**, so a stuck transcription never
  blocks anything else.
- **Versioned prompt files** committed as data, since prompts will change far
  more often than code.
- **A permission module entry** (`scripts` in `Role.permissions`) so the whole
  thing can be switched off without touching CRM code.
