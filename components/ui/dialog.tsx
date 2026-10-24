"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ModalDialogProps {
  readonly children: ReactNode;
  readonly closeLabel: string;
  readonly description?: string;
  readonly title: string;
  readonly triggerLabel: string;
}

export function ModalDialog({
  children,
  closeLabel,
  description,
  title,
  triggerLabel,
}: ModalDialogProps) {
  return (
    <BaseDialog.Root>
      <BaseDialog.Trigger
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-border-subtle bg-card px-4 py-2 text-sm font-medium text-ink",
        )}
      >
        {triggerLabel}
      </BaseDialog.Trigger>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 bg-canvas/80" />
        <BaseDialog.Popup className="fixed top-1/2 left-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border-subtle bg-card p-6 text-ink shadow-lg">
          <BaseDialog.Title className="text-lg font-semibold">
            {title}
          </BaseDialog.Title>
          {description ? (
            <BaseDialog.Description className="mt-1 text-sm text-subtle">
              {description}
            </BaseDialog.Description>
          ) : null}
          <div className="mt-4">{children}</div>
          <div className="mt-4 flex justify-end">
            <BaseDialog.Close className="rounded-md border border-border-subtle bg-muted px-3 py-1.5 text-sm font-medium text-ink">
              {closeLabel}
            </BaseDialog.Close>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
