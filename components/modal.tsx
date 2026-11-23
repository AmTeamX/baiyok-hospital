"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md";
};

export function Modal({ open, title, description, onClose, children, size = "md" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={`modal modal-${size}`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}>
      <div className="modal-head">
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="ปิด"><X size={19} /></button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
