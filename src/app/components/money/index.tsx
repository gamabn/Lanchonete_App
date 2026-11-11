export const formatReal = (
  value: number | string | null | undefined,
): string => {
  if (value === null || value === undefined) return "";

  const numero = Number(value);

  if (!Number.isFinite(numero)) return "";

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const parseRealToCents = (value: string): number => {
  if (!value) return 0;
  // Remove "R$", espaços, pontos de milhar (.), e substitui vírgula por ponto para o parseFloat
  const cleaned = value.replace(/[R$\s.]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  // Converte para centavos e arredonda para evitar problemas de ponto flutuante
  return isNaN(num) ? 0 : Math.round(num * 100);
};

export function formatarPreco(
  valor: number | string | null | undefined,
): string {
  const numero = Number(valor ?? 0);

  if (!Number.isFinite(numero)) return "R$ 0,00";

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
