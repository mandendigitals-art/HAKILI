"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions/auth";

export function SubmitButton({ children, className = "btn-primary", pendingText = "Veuillez patienter…" }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.error && !state?.success) return null;
  return (
    <div
      role="status"
      className={`rounded-lg px-3 py-2 text-sm break-words ${state.error ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}
    >
      {state.error ?? state.success}
    </div>
  );
}

/** Formulaire générique branché sur une Server Action renvoyant un ActionState. */
export function ActionForm({
  action,
  children,
  className = "space-y-4",
  submitLabel = "Enregistrer",
  submitClassName = "btn-primary",
  resetOnSuccess = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
  submitClassName?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.success) {
      formRef.current?.reset();
    }
  }, [state, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
      <SubmitButton className={submitClassName}>{submitLabel}</SubmitButton>
    </form>
  );
}

export function ConfirmButton({ children, className = "btn-danger", message = "Confirmer cette action ?" }: { children: ReactNode; className?: string; message?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  return (
    <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={() => navigator.clipboard.writeText(text)}>
      {label}
    </button>
  );
}
