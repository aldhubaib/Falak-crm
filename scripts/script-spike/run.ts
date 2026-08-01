// Spike runner.
//
//   npx tsx --env-file=.env scripts/script-spike/run.ts            all stages
//   npx tsx --env-file=.env scripts/script-spike/run.ts --from 5   resume at 5
//   npx tsx --env-file=.env scripts/script-spike/run.ts --only 6   one stage
//
// Stages read their input from output/*.json, so re-running from the middle
// costs nothing. Iterate on a prompt at stage 5 without re-fetching or
// re-translating anything above it.
import { config } from "dotenv";
import { heading } from "./lib/io";
import { usageReport } from "./lib/llm";
import { PRICES } from "./config";

config();

const STAGES = [
  { n: 1, name: "fetch", load: () => import("./stages/01-fetch") },
  { n: 2, name: "clean", load: () => import("./stages/02-clean") },
  { n: 3, name: "entities", load: () => import("./stages/03-entities") },
  { n: 4, name: "translate", load: () => import("./stages/04-translate") },
  { n: 5, name: "facts", load: () => import("./stages/05-facts") },
  { n: 6, name: "conflicts", load: () => import("./stages/06-conflicts") },
  { n: 7, name: "draft", load: () => import("./stages/07-draft") },
];

function arg(flag: string): number | null {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : null;
}

async function main() {
  const only = arg("--only");
  const from = arg("--from") ?? 1;
  const selected = only ? STAGES.filter((s) => s.n === only) : STAGES.filter((s) => s.n >= from);

  if (!selected.length) {
    console.error("No stages selected.");
    process.exit(1);
  }

  const started = Date.now();
  for (const stage of selected) {
    const t0 = Date.now();
    const mod = await stage.load();
    await mod.run();
    console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  heading("Token usage");
  const { rows, totalUsd } = usageReport();
  for (const r of rows) {
    const priced = PRICES[r.model];
    const cost = priced
      ? `  $${((r.input / 1e6) * priced.in + (r.output / 1e6) * priced.out).toFixed(3)}`
      : "";
    console.log(`  ${r.model}  ${r.calls} calls  in=${r.input}  out=${r.output}${cost}`);
  }
  if (totalUsd === null) {
    console.log("  No prices configured — fill in PRICES in config.ts for a cost line.");
  } else {
    console.log(`  TOTAL  $${totalUsd.toFixed(3)} for this run`);
  }
  console.log(`  wall clock ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log("\n  Next:  npx tsx --env-file=.env scripts/script-spike/report.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
