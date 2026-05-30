"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onOpenChange, title, description, children, className }: DialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl sm:max-w-lg sm:p-6",
            className
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pr-2">
              <Dialog.Title className="text-lg font-semibold text-gray-900">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-gray-500">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="shrink-0 rounded-lg p-1 hover:bg-gray-100" aria-label="Close dialog">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MaxBlocksDialog({
  open,
  onOpenChange,
  maxBlocks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxBlocks: number;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Block limit reached">
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-700">
          You can only block {maxBlocks} units at a time.
          <br />
          Release one to continue.
        </p>
      </div>
    </Modal>
  );
}
