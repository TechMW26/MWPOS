"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const ANIMATION_MS = 320;
let openSheetCount = 0;

function pushSheetZoom(): () => void {
  const shell = document.querySelector<HTMLElement>("[data-mw-app-shell]");
  if (!shell) return () => undefined;
  openSheetCount += 1;
  shell.classList.add("mw-sheet-zoom-out");
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openSheetCount = Math.max(0, openSheetCount - 1);
    if (openSheetCount === 0) shell.classList.remove("mw-sheet-zoom-out");
  };
}

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, title, onClose, children, className }: ModalProps) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    setEntered(false);
    const timer = window.setTimeout(() => setMounted(false), ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    setEntered(false);
    const frame = window.requestAnimationFrame(() => {
      void document.body.offsetHeight;
      setEntered(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseSheetZoom = pushSheetZoom();
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() => {
      const preferred = panelRef.current?.querySelector<HTMLElement>("[autofocus]");
      (preferred ?? panelRef.current?.querySelector<HTMLElement>("button, input, select, textarea"))?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      releaseSheetZoom();
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [mounted]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex min-h-dvh items-end justify-center overflow-hidden overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close popup"
        className={cn(
          "absolute inset-0 cursor-default bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300",
          entered ? "opacity-100" : "opacity-0"
        )}
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        className={cn(
          "relative flex max-h-[92dvh] w-full max-w-4xl transform-gpu flex-col overflow-hidden overscroll-contain rounded-t-[2rem] border-x border-t bg-card shadow-[0_-24px_60px_rgba(15,23,42,0.24)] will-change-transform",
          "transition-[transform,opacity] duration-300 ease-[cubic-bezier(.22,.85,.3,1)] motion-reduce:transition-none",
          entered ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
          className
        )}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3">
          <h2 id={titleId} className="text-xl font-bold tracking-tight">{title}</h2>
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-slate-100" onClick={() => onCloseRef.current()} aria-label="Close">
            <XIcon className="h-5 w-5" weight="bold" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const [working, setWorking] = useState(false);

  async function confirm() {
    setWorking(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={working ? () => undefined : onClose} className="max-w-md">
      <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={working}>Cancel</Button>
        <Button type="button" variant={danger ? "destructive" : "default"} onClick={confirm} disabled={working}>
          {working ? "Please wait…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
