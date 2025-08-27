export const formatReal = (cents: number | null | undefined): string => {
  if (cents === null || cents === undefined || isNaN(cents)) return '';
  // Garante que 'cents' é um número inteiro
  const num = Math.round(cents);
  // Divide por 100 para obter o valor real (ex: 123456 -> 1234.56)
  const realValue = num / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2, // Garante sempre 2 casas decimais
    maximumFractionDigits: 2, // Garante sempre 2 casas decimais
  }).format(realValue);
};

export const parseRealToCents = (value: string): number => {
  if (!value) return 0;
  // Remove "R$", espaços, pontos de milhar (.), e substitui vírgula por ponto para o parseFloat
  const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  // Converte para centavos e arredonda para evitar problemas de ponto flutuante
  return isNaN(num) ? 0 : Math.round(num * 100);
};
