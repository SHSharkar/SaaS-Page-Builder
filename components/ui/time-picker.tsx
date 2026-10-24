import { cn } from "@/lib/cn";

export interface TimePickerProps {
  readonly className?: string;
  readonly defaultValue?: string;
  readonly id?: string;
  readonly name: string;
  readonly required?: boolean;
}

export function TimePicker({
  className,
  defaultValue,
  id,
  name,
  required,
}: TimePickerProps) {
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
      type="time"
    />
  );
}
