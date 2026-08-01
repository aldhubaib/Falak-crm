// Stage results are cached on disk so a prompt can be iterated at stage 5
// without re-fetching and re-paying for stages 1-4.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = join(here, "..", "output");

export function writeStage(name: string, data: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

export function writeText(name: string, body: string): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), body);
}

export function readStage<T>(name: string): T {
  const path = join(OUT_DIR, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(`Missing ${name}.json — run the earlier stages first.`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function stageExists(name: string): boolean {
  return existsSync(join(OUT_DIR, `${name}.json`));
}

export function heading(text: string): void {
  console.log(`\n${"─".repeat(64)}\n${text}\n${"─".repeat(64)}`);
}
