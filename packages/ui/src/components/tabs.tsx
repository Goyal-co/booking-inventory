"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "../lib/utils";

export function TabsRoot({ children, defaultValue }: { children: React.ReactNode; defaultValue: string }) {
  return (
    <Tabs.Root defaultValue={defaultValue} className="w-full">
      {children}
    </Tabs.Root>
  );
}

export function TabsList({ children }: { children: React.ReactNode }) {
  return (
    <Tabs.List className="flex overflow-x-auto border-b border-gray-200">
      {children}
    </Tabs.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        "px-4 py-2 text-sm font-medium text-gray-500 border-b-2 border-transparent",
        "data-[state=active]:border-brand-600 data-[state=active]:text-brand-600"
      )}
    >
      {children}
    </Tabs.Trigger>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Content value={value} className="pt-4">
      {children}
    </Tabs.Content>
  );
}
