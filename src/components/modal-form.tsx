import type { FormEvent, ReactNode } from "react";
import { X } from "lucide-react";

// Shared overlay + form shell for the app's small "fill in and submit" dialogs.
// Clicking the backdrop closes it; clicks inside the form do not.
export function ModalForm({ title, onClose, onSubmit, children, maxWidth = "max-w-md" }: {
  title: string;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={onSubmit} className={`bg-card w-full ${maxWidth} rounded-lg p-6 space-y-3 animate-scale-in`}>
        <div className="flex justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        {children}
      </form>
    </div>
  );
}
