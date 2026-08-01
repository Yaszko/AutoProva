import { AlertTriangle, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-red-400 hover:text-red-200"
        aria-label="Dispensar aviso"
      >
        <X size={16} />
      </button>
    </div>
  );
}
