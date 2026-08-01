// Minimal provider layer over plain fetch — the spike deliberately adds no
// dependencies. Every call is tallied so the report can price a full script.
import { PRICES } from "../config";

export type Provider = "openai" | "anthropic";

export type Usage = { model: string; input: number; output: number; calls: number };

const tally = new Map<string, Usage>();

function record(model: string, input: number, output: number): void {
  const prev = tally.get(model) ?? { model, input: 0, output: 0, calls: 0 };
  prev.input += input;
  prev.output += output;
  prev.calls += 1;
  tally.set(model, prev);
}

export function usageReport(): { rows: Usage[]; totalUsd: number | null } {
  const rows = [...tally.values()];
  let totalUsd = 0;
  let priced = false;
  for (const r of rows) {
    const p = PRICES[r.model];
    if (!p) continue;
    priced = true;
    totalUsd += (r.input / 1e6) * p.in + (r.output / 1e6) * p.out;
  }
  return { rows, totalUsd: priced ? totalUsd : null };
}

export function resetUsage(): void {
  tally.clear();
}

function requireKey(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — add it to .env`);
  return v;
}

type CallOpts = {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: Provider;
};

async function callOpenAI(
  model: string,
  prompt: string,
  opts: CallOpts,
): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireKey("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_completion_tokens: opts.maxTokens ?? 8000,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  record(model, json.usage?.prompt_tokens ?? 0, json.usage?.completion_tokens ?? 0);
  return json.choices[0]?.message?.content ?? "";
}

async function callAnthropic(
  model: string,
  prompt: string,
  opts: CallOpts,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": requireKey("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      system: opts.system,
      messages: [{ role: "user", content: prompt }],
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 8000,
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage?: { input_tokens: number; output_tokens: number };
  };
  record(model, json.usage?.input_tokens ?? 0, json.usage?.output_tokens ?? 0);
  return json.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
}

export async function complete(
  model: string,
  prompt: string,
  opts: CallOpts = {},
): Promise<string> {
  const provider = opts.provider ?? "openai";
  const run = () =>
    provider === "anthropic"
      ? callAnthropic(model, prompt, opts)
      : callOpenAI(model, prompt, opts);

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await run();
    } catch (err) {
      lastError = err;
      // Rate limits and 5xx are worth a backoff; bad requests are not.
      const msg = String(err);
      if (!/\b(429|5\d\d)\b/.test(msg)) throw err;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw lastError;
}

/** Strip markdown fences and pull the outermost JSON value out of a reply. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[[{]/);
  if (start === -1) return body;
  const open = body[start];
  const close = open === "[" ? "]" : "}";
  const end = body.lastIndexOf(close);
  return end > start ? body.slice(start, end + 1) : body.slice(start);
}

/**
 * JSON call with one repair round. Models drop a bracket often enough at this
 * output size that failing the whole stage on it wastes real money.
 */
export async function completeJson<T>(
  model: string,
  prompt: string,
  opts: CallOpts = {},
): Promise<T> {
  const raw = await complete(model, prompt, opts);
  try {
    return JSON.parse(extractJson(raw)) as T;
  } catch {
    const repaired = await complete(
      model,
      `This should have been valid JSON but does not parse. Return only the corrected JSON, nothing else.\n\n${raw.slice(0, 20000)}`,
      { ...opts, temperature: 0 },
    );
    return JSON.parse(extractJson(repaired)) as T;
  }
}

export async function embed(texts: string[], model: string): Promise<number[][]> {
  const out: number[][] = [];
  // The endpoint accepts batches; 96 keeps each request comfortably small.
  for (let i = 0; i < texts.length; i += 96) {
    const batch = texts.slice(i, i + 96);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireKey("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: batch }),
    });
    if (!res.ok) {
      throw new Error(`Embeddings ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      data: { embedding: number[] }[];
      usage?: { prompt_tokens: number };
    };
    record(model, json.usage?.prompt_tokens ?? 0, 0);
    out.push(...json.data.map((d) => d.embedding));
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Bounded parallelism — keeps provider rate limits out of the stage code. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
