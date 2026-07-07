"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, title, onClose, children, className }: ModalProps) {
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
      return;
    }
    if (visible) {
      setClosing(true);
      const timer = window.setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 180);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open, visible]);

  function requestClose() {
    onClose();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] grid min-h-dvh place-items-center overflow-y-auto p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button
        type="button"
        aria-label="Close modal"
        className={cn("fixed inset-0 cursor-default bg-foreground/30 backdrop-blur-md", closing ? "animate-overlay-out" : "animate-overlay")}
        onClick={requestClose}
      />
      <div className={cn("relative my-6 w-full max-w-4xl rounded-lg border bg-card shadow-2xl sm:my-10", closing ? "animate-overlay-out" : "animate-sheet-up", className)}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={requestClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
