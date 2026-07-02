"use client";

import { X, CheckCircle2, AlertCircle, Info, AlertTriangle, RotateCcw } from "lucide-react";
import { useToast, type Toast as ToastType } from "@/lib/toast/context";

const variantStyles: Record<ToastType["variant"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

const variantIcons: Record<ToastType["variant"], typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const actionIcons: Record<string, typeof RotateCcw> = {
  Retry: RotateCcw,
};

function ToastItem({ toast }: { toast: ToastType }) {
  const { removeToast } = useToast();
  const Icon = variantIcons[toast.variant];
  const ActionIcon = toast.action ? actionIcons[toast.action.label] ?? null : null;

  return (
    <div
      className={`pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-3 shadow-lg transition-all ${variantStyles[toast.variant]}`}
      role="status"
    >
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      <div className="flex-1">
        {toast.title && (
          <p className="text-xs font-semibold">{toast.title}</p>
        )}
        <p className="text-xs leading-relaxed">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              removeToast(toast.id);
            }}
            className="mt-1.5 inline-flex items-center gap-1 rounded border border-current px-2 py-0.5 text-xs font-medium hover:opacity-80"
          >
            {ActionIcon && <ActionIcon className="size-3" />}
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
