import { FileText } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-center text-zinc-600">
      <FileText size={32} />
      <p className="max-w-xs text-sm">
        Preencha o assunto da prova e clique em "Gerar Prova" para ver a prévia e o código HTML aqui.
      </p>
    </div>
  );
}
