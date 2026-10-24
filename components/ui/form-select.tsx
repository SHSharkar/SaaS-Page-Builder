import { cn } from "@/lib/cn";

export interface SelectOption {
  readonly label: string;
  readonly value: string;
}

export interface FormSelectProps {
  readonly className?: string;
  readonly defaultValue?: string;
  readonly id?: string;
  readonly name: string;
  readonly onChange?: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly value?: string;
}

export function FormSelect({
  className,
  defaultValue,
  id,
  name,
  onChange,
  options,
  value,
}: FormSelectProps) {
  return (
    <select
      className={cn(
        "w-full rounded-md border border-border-subtle bg-card px-3 py-2 text-sm text-ink",
        className,
      )}
      defaultValue={defaultValue}
      id={id}
      name={name}
      onChange={
        onChange ? (event) => onChange(event.currentTarget.value) : undefined
      }
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
