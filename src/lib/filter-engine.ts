// Client-side filter engine for the CRM data tables (companies, contacts,
// deals). Ported from the Lovable design: each table declares its filterable
// fields, the FilterDialog builds rules, and applyFilters() evaluates them.
// Rows must match ALL rules (AND semantics).

export type FilterType = "text" | "number" | "date" | "select";

export type FilterFieldOption = { id: string; label: string };

export type FilterField<Row> = {
  id: string;
  label: string;
  type: FilterType;
  /** Options for "select" fields. */
  options?: FilterFieldOption[];
  /** Extracts the raw value from a row. Select fields may return string[] */
  get: (row: Row) => unknown;
};

export type FilterOp =
  | "contains"
  | "not_contains"
  | "equals"
  | "not_equals"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "before"
  | "after"
  | "on"
  | "any_of"
  | "none_of"
  | "is_empty"
  | "is_not_empty";

export type FilterRule = {
  id: string;
  fieldId: string;
  op: FilterOp;
  value?: string | number | string[];
};

export type OperatorMeta = { op: FilterOp; label: string; needsValue: boolean };

export const OPERATORS_BY_TYPE: Record<FilterType, OperatorMeta[]> = {
  text: [
    { op: "contains", label: "contains", needsValue: true },
    { op: "not_contains", label: "doesn't contain", needsValue: true },
    { op: "equals", label: "is", needsValue: true },
    { op: "not_equals", label: "is not", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  number: [
    { op: "equals", label: "=", needsValue: true },
    { op: "not_equals", label: "≠", needsValue: true },
    { op: "gt", label: ">", needsValue: true },
    { op: "gte", label: "≥", needsValue: true },
    { op: "lt", label: "<", needsValue: true },
    { op: "lte", label: "≤", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  date: [
    { op: "on", label: "is on", needsValue: true },
    { op: "before", label: "is before", needsValue: true },
    { op: "after", label: "is after", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  select: [
    { op: "any_of", label: "is any of", needsValue: true },
    { op: "none_of", label: "is none of", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
};

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Local calendar date (YYYY-MM-DD) for comparing date rules. */
function dayKey(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** A rule counts as "active" when it's complete enough to evaluate. */
export function activeRuleCount<Row>(
  rules: FilterRule[],
  fields: FilterField<Row>[],
): number {
  return rules.filter((r) => {
    const field = fields.find((f) => f.id === r.fieldId);
    if (!field) return false;
    const meta = OPERATORS_BY_TYPE[field.type].find((o) => o.op === r.op);
    if (!meta) return false;
    return meta.needsValue ? !isEmpty(r.value) : true;
  }).length;
}

function evalRule<Row>(row: Row, rule: FilterRule, field: FilterField<Row>): boolean {
  const raw = field.get(row);

  switch (rule.op) {
    case "is_empty":
      return isEmpty(raw);
    case "is_not_empty":
      return !isEmpty(raw);
    default:
      break;
  }

  // Rules that need a value but don't have one yet are ignored (pass).
  if (isEmpty(rule.value)) return true;

  if (field.type === "text") {
    const hay = String(raw ?? "").toLowerCase();
    const needle = String(rule.value).toLowerCase();
    switch (rule.op) {
      case "contains":
        return hay.includes(needle);
      case "not_contains":
        return !hay.includes(needle);
      case "equals":
        return hay === needle;
      case "not_equals":
        return hay !== needle;
      default:
        return true;
    }
  }

  if (field.type === "number") {
    const n = typeof raw === "number" ? raw : Number(raw);
    const v = Number(rule.value);
    if (Number.isNaN(n) || Number.isNaN(v)) return false;
    switch (rule.op) {
      case "equals":
        return n === v;
      case "not_equals":
        return n !== v;
      case "gt":
        return n > v;
      case "gte":
        return n >= v;
      case "lt":
        return n < v;
      case "lte":
        return n <= v;
      default:
        return true;
    }
  }

  if (field.type === "date") {
    const rowDay = dayKey(raw);
    const ruleDay = dayKey(rule.value);
    if (!rowDay || !ruleDay) return false;
    switch (rule.op) {
      case "on":
      case "equals":
        return rowDay === ruleDay;
      case "before":
        return rowDay < ruleDay;
      case "after":
        return rowDay > ruleDay;
      default:
        return true;
    }
  }

  // select — the row value may be a single id or an array of ids.
  const selected = Array.isArray(rule.value)
    ? rule.value.map(String)
    : [String(rule.value)];
  const rowIds = Array.isArray(raw) ? raw.map(String) : [String(raw ?? "")];
  const overlaps = rowIds.some((id) => selected.includes(id));
  switch (rule.op) {
    case "any_of":
      return overlaps;
    case "none_of":
      return !overlaps;
    default:
      return true;
  }
}

export function applyFilters<Row>(
  rows: Row[],
  rules: FilterRule[],
  fields: FilterField<Row>[],
): Row[] {
  const active = rules
    .map((r) => ({ rule: r, field: fields.find((f) => f.id === r.fieldId) }))
    .filter((x): x is { rule: FilterRule; field: FilterField<Row> } => !!x.field);
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every(({ rule, field }) => evalRule(row, rule, field)));
}
