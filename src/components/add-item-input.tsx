import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AddItemInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  disabled?: boolean;
  addLabel?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}

export function AddItemInput({
  placeholder,
  value,
  onChange,
  onAdd,
  disabled,
  addLabel = "Add",
  className,
  inputClassName,
  autoFocus,
}: AddItemInputProps) {
  const submit = () => {
    if (!value.trim() || disabled) return;
    onAdd();
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn("h-control-h flex-1", inputClassName)}
      />
      <Button
        type="button"
        size="icon"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label={addLabel}
        className="h-control-h-sm w-control-h-sm shrink-0"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
