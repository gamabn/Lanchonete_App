export function categoryValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (/[\p{Cc}\p{Cs}]/u.test(value)) throw new Error("Categoria inválida.");
  const category = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (Array.from(category).length > 80) throw new Error("Categoria deve ter até 80 caracteres.");
  return category || null;
}

export function categorySuggestions(products: { restaurant_id?: string; category?: string | null }[], restaurantId?: string): string[] {
  if (!restaurantId) return [];
  const values = new Map<string, string>();
  for (const product of products) {
    if (product.restaurant_id !== restaurantId) continue;
    try {
      const category = categoryValue(product.category);
      if (category) {
        const key = category.toLocaleLowerCase("pt-BR");
        if (!values.has(key)) values.set(key, category);
      }
    } catch { /* Ignore malformed historical suggestions; backend validates writes. */ }
  }
  return [...values.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
