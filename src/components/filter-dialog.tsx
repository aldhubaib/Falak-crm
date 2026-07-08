"use client";

// Rule-based filter dialog for the CRM tables. Each rule picks a field, an
// operator (based on the field's type), and a value. Ported from Lovable.

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { IconButton } from "@/components/icon-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  OPERATORS_BY_TYPE,
  type FilterField,
  type FilterRule,
} from "@/lib/filter-engine";
import { cn } from "@/lib/utils";

function uid() {
  return `r_${Math.random().toString(36).slice(2, 9)}`;
}

export function FilterDialog<Row>({
  open,
  onOpenChange,
  fields,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fields: FilterField<Row>[];
  value: FilterRule[];
  onChange: (rules: FilterRule[]) => void;
}) {
  const [draft, setDraft] = useState<FilterRule[]>(value);

  // Reset draft when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) setDraft(value);
    onOpenChange(v);
  };

  const addRule = () => {
    const first = fields[0];
    if (!first) return;
    const op = OPERATORS_BY_TYPE[first.type][0].op;
    setDraft((d) => [...d, { id: uid(), fieldId: first.id, op, value: undefined }]);
  };

  const updateRule = (id: string, patch: Partial<FilterRule>) => {
    setDraft((d) => d.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRule = (id: string) => setDraft((d) => d.filter((r) => r.id !== id));

  const clear = () => setDraft([]);

  const apply = () => {
    onChange(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription>
            Rows must match all rules. Choose a field, then an operator based on its type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {draft.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              No filters yet.
            </div>
          ) : (
            draft.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                fields={fields}
                onChange={(patch) => updateRule(rule.id, patch)}
                onRemove={() => removeRule(rule.id)}
              />
            ))
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addRule}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add filter
          </Button>
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={draft.length === 0}
          >
            Clear all
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={apply}>
              Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleRow<Row>({
  rule,
  fields,
  onChange,
  onRemove,
}: {
  rule: FilterRule;
  fields: FilterField<Row>[];
  onChange: (patch: Partial<FilterRule>) => void;
  onRemove: () => void;
}) {
  const field = fields.find((f) => f.id === rule.fieldId) ?? fields[0];
  const ops = OPERATORS_BY_TYPE[field.type];
  const opMeta = ops.find((o) => o.op === rule.op) ?? ops[0];

  return (
    <div className="grid grid-cols-[1fr_auto_2fr_auto] items-center gap-2">
      {/* Field */}
      <SearchableSelect
        value={field.id}
        onValueChange={(id) => {
          const next = fields.find((f) => f.id === id)!;
          onChange({
            fieldId: id,
            op: OPERATORS_BY_TYPE[next.type][0].op,
            value: undefined,
          });
        }}
        searchPlaceholder="Search fields…"
        className="h-9"
        options={fields.map((f) => ({ value: f.id, label: f.label }))}
      />

      {/* Operator */}
      <SearchableSelect
        value={rule.op}
        onValueChange={(op) =>
          onChange({
            op: op as FilterRule["op"],
            value:
              OPERATORS_BY_TYPE[field.type].find((o) => o.op === op)?.needsValue
                ? rule.value
                : undefined,
          })
        }
        searchPlaceholder="Search…"
        className="h-9 w-[150px]"
        contentClassName="w-48 min-w-48"
        options={ops.map((o) => ({ value: o.op, label: o.label }))}
      />

      {/* Value */}
      <div>
        {opMeta.needsValue ? (
          <ValueInput field={field} rule={rule} onChange={onChange} />
        ) : (
          <div className="text-tiny text-muted-foreground">No value</div>
        )}
      </div>

      <IconButton aria-label="Remove filter" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

function ValueInput<Row>({
  field,
  rule,
  onChange,
}: {
  field: FilterField<Row>;
  rule: FilterRule;
  onChange: (patch: Partial<FilterRule>) => void;
}) {
  if (field.type === "text") {
    return (
      <Input
        value={typeof rule.value === "string" ? rule.value : ""}
        onChange={(e) => onChange({ value: e.target.value })}
        placeholder="Value"
        className="h-9"
      />
    );
  }
  if (field.type === "number") {
    return (
      <Input
        type="number"
        value={
          typeof rule.value === "number"
            ? rule.value
            : typeof rule.value === "string"
              ? rule.value
              : ""
        }
        onChange={(e) =>
          onChange({
            value: e.target.value === "" ? undefined : Number(e.target.value),
          })
        }
        placeholder="0"
        className="h-9"
      />
    );
  }
  if (field.type === "date") {
    return (
      <Input
        type="date"
        value={typeof rule.value === "string" ? rule.value : ""}
        onChange={(e) => onChange({ value: e.target.value })}
        className="h-9"
      />
    );
  }
  // select — multi
  const selected = Array.isArray(rule.value)
    ? rule.value
    : rule.value != null
      ? [String(rule.value)]
      : [];
  const labels =
    field.options
      ?.filter((o) => selected.includes(o.id))
      .map((o) => o.label)
      .slice(0, 2)
      .join(", ") ?? "";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 w-full justify-start text-left font-normal",
            !selected.length && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {selected.length
              ? `${labels}${selected.length > 2 ? ` +${selected.length - 2}` : ""}`
              : "Select…"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="max-h-64 overflow-auto">
          {(field.options ?? []).map((o) => {
            const checked = selected.includes(o.id);
            return (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-surface"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = v
                      ? [...selected, o.id]
                      : selected.filter((x) => x !== o.id);
                    onChange({ value: next });
                  }}
                />
                {o.label}
              </label>
            );
          })}
          {(field.options ?? []).length === 0 && (
            <div className="px-2 py-1.5 text-tiny text-muted-foreground">
              No options.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
