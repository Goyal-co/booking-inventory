"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

export interface MobileNavItem {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
}

interface MobileNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  items: MobileNavItem[];
  footer?: React.ReactNode;
}

export function MobileNavSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  items,
  footer,
}: MobileNavSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[min(100%,280px)] flex-col border-r border-gray-200 bg-white shadow-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden"
          )}
        >
          <div className="flex items-start justify-between border-b border-gray-200 p-4">
            <div>
              <Dialog.Title className="text-lg font-bold text-brand-600">{title}</Dialog.Title>
              {subtitle && (
                <Dialog.Description className="text-xs text-gray-500">{subtitle}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="rounded-lg p-1 hover:bg-gray-100"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {items.map((item) => {
              const Icon = item.icon;
              const className = cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                item.active ? "bg-brand-50 text-brand-600" : "text-gray-600 hover:bg-gray-50"
              );
              if (item.onClick) {
                return (
                  <button key={item.href + item.label} type="button" onClick={item.onClick} className={className}>
                    {Icon && <Icon className="h-4 w-4" />}
                    {item.label}
                  </button>
                );
              }
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={className}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </a>
              );
            })}
          </nav>
          {footer && <div className="border-t border-gray-200 p-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
