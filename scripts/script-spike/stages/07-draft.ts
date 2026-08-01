// Stage 07 — write the Kuwaiti draft, once per competing model.
//
// The generator never sees a transcript. It receives the locked fact layer,
// the entity roster and the timeline — a few thousand tokens against the tens
// of thousands the extraction stages consumed. That is the point of the whole
// architecture: the expensive, quality-critical model does the least reading.
//
// Every model defaults to MSA no matter what the prompt asks, so the Kuwaiti
// register has to be carried by explicit instruction plus real examples. This
// stage ships with instruction only — the example bank is what Phase 4 builds
// out of approved scripts.
import { EPISODE, MODELS, WORDS_PER_MINUTE } from "../config";
import { complete } from "../lib/llm";
import { readStage, writeStage, writeText, heading } from "../lib/io";
import type { Entity } from "./03-entities";
import type { Attribute, EventFact } from "./05-facts";
import type { Conflict } from "./06-conflicts";

export type Draft = { model: string; provider: string; words: number; body: string };

const SYSTEM = `أنت كاتب سيناريو وثائقي كويتي.

اكتب نصاً للتعليق الصوتي باللهجة الكويتية المحكية — لا الفصحى.

قواعد ملزمة:
1. لا تذكر أي معلومة غير موجودة في قائمة الحقائق. لا تخمين، لا استنتاج، لا معرفة خارجية.
2. اللهجة كويتية طبيعية كما تُنطق، وليست فصحى مبسطة.
3. ابدأ بخطّاف قوي في أول جملتين.
4. قسّم النص إلى مقاطع بعناوين قصيرة.
5. اكتب ما يُقال فقط. أضف ملاحظات الصورة بين قوسين مربعين على سطر مستقل.
6. التزم بعدد الكلمات المطلوب.`;

function describeValue(v: Attribute["value"]): string {
  if (!v) return "";
  switch (v.kind) {
    case "number":
      return `${v.n}${v.unit ? ` ${v.unit}` : ""}`;
    case "date":
      return v.iso;
    case "range":
      return `${v.from} → ${v.to}`;
    default:
      return v.s;
  }
}

export async function run(): Promise<Draft[]> {
  heading("Stage 07 — Kuwaiti draft");

  const entities = readStage<Entity[]>("03-entities");
  const { attributes, events } = readStage<{ attributes: Attribute[]; events: EventFact[] }>(
    "05-facts",
  );
  const conflicts = readStage<Conflict[]>("06-conflicts");

  // Nobody resolved anything in a spike run, so take the trust-weighted
  // suggestion and drop the losing sides. In the product this is the user's
  // decision, and it is the whole reason the conflict screen exists.
  const rejected = new Set<string>();
  for (const c of conflicts) {
    if (c.kind !== "contradiction" || !c.suggested) continue;
    const keep = new Set(c.suggested);
    for (const o of c.options) {
      for (const id of o.factIds) if (!keep.has(id)) rejected.add(id);
    }
  }

  const nameById = new Map(entities.map((e) => [e.id, e.canonical]));
  const roster = entities
    .filter((e) => e.category === "person" || e.category === "location")
    .map((e) => `- ${e.canonical} (${e.category})`)
    .join("\n");

  const factLines = attributes
    .filter((a) => !rejected.has(a.id))
    .map((a) => `- ${nameById.get(a.entityId) ?? a.entityId} / ${a.key}: ${describeValue(a.value)}`)
    .join("\n");

  const timeline = events
    .filter((e) => !rejected.has(e.id))
    .slice()
    .sort((a, b) => {
      const av = a.timeValue && "iso" in a.timeValue ? a.timeValue.iso : "";
      const bv = b.timeValue && "iso" in b.timeValue ? b.timeValue.iso : "";
      return av.localeCompare(bv);
    })
    .map((e) => {
      const when = e.timeValue ? describeValue(e.timeValue) : "وقت غير محدد";
      const where = e.locationId ? ` @ ${nameById.get(e.locationId) ?? e.locationId}` : "";
      return `- [${when}]${where} ${e.summary}`;
    })
    .join("\n");

  const targetWords = Math.round(EPISODE.targetMinutes * WORDS_PER_MINUTE);

  const prompt = `الموضوع: ${EPISODE.name}
مدة الفيديو المستهدفة: ${EPISODE.targetMinutes} دقيقة
عدد الكلمات المطلوب: ${targetWords} تقريباً

الشخصيات والأماكن:
${roster}

الحقائق المثبتة:
${factLines}

التسلسل الزمني:
${timeline}

اكتب النص الآن.`;

  writeText("07-prompt.txt", `${SYSTEM}\n\n---\n\n${prompt}`);
  console.log(`  fact layer: ${factLines.split("\n").length} attributes, ${timeline.split("\n").length} events`);
  console.log(`  target: ${targetWords} words for ${EPISODE.targetMinutes} min`);
  if (rejected.size) console.log(`  ${rejected.size} facts dropped as losing sides of contradictions`);

  const drafts: Draft[] = [];
  for (const model of MODELS.dialect) {
    try {
      const body = await complete(model.id, prompt, {
        system: SYSTEM,
        provider: model.provider,
        temperature: 0.7,
        maxTokens: 8000,
      });
      const words = body.split(/\s+/).filter(Boolean).length;
      const slug = model.id.replace(/[^a-z0-9]+/gi, "-");
      writeText(`07-draft-${slug}.md`, body);
      drafts.push({ model: model.id, provider: model.provider, words, body });
      console.log(`  ${model.id}: ${words} words (${((words / targetWords) * 100).toFixed(0)}% of target)`);
    } catch (err) {
      console.log(`  ${model.id}: FAILED — ${String(err).slice(0, 200)}`);
    }
  }

  writeStage("07-draft", drafts.map(({ body: _body, ...meta }) => meta));
  console.log("  Read the drafts blind, without model names, before checking which is which.");
  return drafts;
}
