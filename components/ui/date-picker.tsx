import { cn } from "@/lib/cn";

export interface DatePickerProps {
  readonly className?: string;
  readonly defaultValue?: string;
  readonly id?: string;
  readonly name: string;
  readonly required?: boolean;
}

export function DatePicker({
  className,
  defaultValue,
  id,
  name,
  required,
}: DatePickerProps) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-border-subtle bg-card px-3 py-2 text-sm text-ink",
        className,
      )}
      defaultValue={defaultValue}
      id={id}
      name={name}
      required={required}
      type="date"
    />
  );
}
