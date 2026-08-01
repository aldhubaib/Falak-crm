// Scoring sheet.
//
//   npx tsx --env-file=.env scripts/script-spike/report.ts
//
// Prints what can be counted automatically and leaves blanks for the four
// judgements only a human can make. Fill those in WITH your writer, and write
// the thresholds down before reading any output — otherwise you will rate
// whatever the pipeline produced as acceptable.
import { config } from "dotenv";
import { GROUND_TRUTH, MODELS } from "./config";
import { cosine, embed } from "./lib/llm";
import { readStage, stageExists, heading } from "./lib/io";
import type { Entity } from "./stages/03-entities";
import type { PivotSource } from "./stages/04-translate";
import type { Attribute, EventFact } from "./stages/05-facts";
import type { Conflict } from "./stages/06-conflicts";

config();

const RECALL_MATCH = 0.78;

async function main() {
  if (!stageExists("05-facts")) {
    console.error("Run the pipeline first: npx tsx --env-file=.env scripts/script-spike/run.ts");
    process.exit(1);
  }

  const sources = readStage<{ id: string; ok: boolean; captionKind: string; segments?: unknown[] }[]>(
    "01-fetch",
  );
  const entities = readStage<Entity[]>("03-entities");
  const pivots = readStage<PivotSource[]>("04-translate");
  const { attributes, events } = readStage<{ attributes: Attribute[]; events: EventFact[] }>(
    "05-facts",
  );
  const conflicts = stageExists("06-conflicts") ? readStage<Conflict[]>("06-conflicts") : [];

  heading("Counted automatically");

  const timed = sources.filter((s) => (s.segments?.length ?? 0) > 0).length;
  console.log(`  sources ok            ${sources.filter((s) => s.ok).length}/${sources.length}`);
  console.log(`  with timestamps       ${timed}/${sources.length}   ${timed ? "provenance can deep-link" : "provenance is offsets only"}`);
  console.log(`  caption kinds         ${sources.map((s) => `${s.id}=${s.captionKind}`).join("  ")}`);
  console.log(`  sentences             ${pivots.reduce((n, p) => n + p.sentences.length, 0)}`);
  console.log(`  entities              ${entities.length} (${entities.filter((e) => e.aliases.length > 1).length} merged from variants)`);
  console.log(`  attributes            ${attributes.length}`);
  console.log(`  events                ${events.length}`);

  const noSource = [...attributes, ...events].filter((f) => !f.sentenceIndices.length).length;
  console.log(`  facts with no citation ${noSource}   ${noSource ? "← these cannot be verified" : ""}`);

  const kinds = conflicts.reduce<Record<string, number>>((acc, c) => {
    acc[c.kind] = (acc[c.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  conflicts             ${conflicts.length}`, kinds);
  console.log(`  needing a decision    ${conflicts.filter((c) => c.kind === "contradiction").length}`);

  // ── Recall against the writer's list ─────────────────────────────────────
  if (GROUND_TRUTH.length) {
    heading("Recall vs the published script");
    const claims = [
      ...attributes.map((a) => a.claim),
      ...events.map((e) => e.summary),
    ].filter(Boolean);

    const [truthVecs, claimVecs] = await Promise.all([
      embed(GROUND_TRUTH, MODELS.embed),
      embed(claims, MODELS.embed),
    ]);

    let hits = 0;
    GROUND_TRUTH.forEach((truth, i) => {
      let best = -1;
      let bestIdx = -1;
      claimVecs.forEach((v, j) => {
        const score = cosine(truthVecs[i], v);
        if (score > best) {
          best = score;
          bestIdx = j;
        }
      });
      const hit = best >= RECALL_MATCH;
      if (hit) hits++;
      console.log(`  ${hit ? "FOUND  " : "MISSING"} ${best.toFixed(2)}  ${truth}`);
      if (!hit && bestIdx >= 0) console.log(`            closest: ${claims[bestIdx]}`);
    });
    console.log(`\n  recall ${hits}/${GROUND_TRUTH.length} (${((hits / GROUND_TRUTH.length) * 100).toFixed(0)}%)`);
    console.log("  Similarity is a proxy — confirm the MISSING lines by hand before believing them.");
  } else {
    heading("Recall vs the published script");
    console.log("  GROUND_TRUTH is empty. Have your writer list the 15 facts that mattered");
    console.log("  in the finished episode, before looking at any output above.");
  }

  // ── The judgements that need a person ────────────────────────────────────
  heading("Score by hand, with your writer");
  console.log(`
  1. Entity merges            wrong merges: ___    missed merges: ___
     A wrong merge silently destroys facts. Target: zero.

  2. Fact precision           sample 30 facts from 05-facts.json
                              accurate: ___/30    hallucinated: ___/30
     Hallucinations must be ~0. The premise of the module is that a locked
     fact is trustworthy.

  3. Conflict noise           real contradictions: ___    noise: ___
     Over ~50% noise and the review screen is dead on arrival. Redesign
     before building it.

  4. Draft quality            read 07-draft-*.md blind, then reveal
                              which model: ___   dialect held: ___
                              MSA drift: ___    invented facts: ___

  GO if precision is high, hallucinations are ~0, recall is acceptable to the
  writer, and conflict noise is manageable. Otherwise fix extraction before
  writing a single line of schema.
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
