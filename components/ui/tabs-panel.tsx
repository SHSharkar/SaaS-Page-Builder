"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";

export interface TabDefinition {
  readonly content: ReactNode;
  readonly label: string;
  readonly value: string;
}

export interface TabsPanelProps {
  readonly defaultValue: string;
  readonly tabs: readonly TabDefinition[];
}

export function TabsPanel({ defaultValue, tabs }: TabsPanelProps) {
  return (
    <BaseTabs.Root defaultValue={defaultValue}>
      <BaseTabs.List className="flex flex-wrap gap-2 border-b border-border-subtle pb-2">
        {tabs.map((tab) => (
          <BaseTabs.Tab
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink data-[selected]:bg-accent data-[selected]:text-on-accent"
            key={tab.value}
            value={tab.value}
          >
            {tab.label}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
      {tabs.map((tab) => (
        <BaseTabs.Panel className="pt-4" key={tab.value} value={tab.value}>
          {tab.content}
        </BaseTabs.Panel>
      ))}
    </BaseTabs.Root>
  );
}
