"use client";

import { useMemo, useState } from "react";
import type { SelectOption } from "./form-select";
import { FormSelect } from "./form-select";
import { Input } from "./input";
import { Stack } from "./stack";

export interface SearchableSelectProps {
  readonly defaultValue?: string;
  readonly filterPlaceholder: string;
  readonly id?: string;
  readonly name: string;
  readonly options: readonly SelectOption[];
}

export function SearchableSelect({
  defaultValue,
  filterPlaceholder,
  id,
  name,
  options,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return options;
    }
    return options.filter(
      (item) =>
        item.label.toLowerCase().includes(trimmed) ||
        item.value.toLowerCase().includes(trimmed),
    );
  }, [options, query]);

  return (
    <Stack gap="sm">
      <Input
        aria-label={filterPlaceholder}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder={filterPlaceholder}
        type="search"
        value={query}
      />
      <FormSelect
        defaultValue={defaultValue}
        id={id}
        name={name}
        options={filtered}
      />
    </Stack>
  );
}
