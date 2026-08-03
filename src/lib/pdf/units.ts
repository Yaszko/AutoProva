// Conversão de unidades compartilhada entre os módulos de layout do PDF (o documento jsPDF é
// criado com unit: 'mm', mas tamanhos de fonte são expressos em pt).
export const PT_TO_MM = 0.3528;

export function ptToMm(pt: number): number {
  return pt * PT_TO_MM;
}
