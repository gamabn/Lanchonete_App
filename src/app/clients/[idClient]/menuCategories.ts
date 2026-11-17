import type { Product } from "@/app/models/interface";

export const ALL_CATEGORIES = "all";
export const UNCATEGORIZED = "uncategorized";

function categoryName(category: string | null | undefined) {
  return category?.normalize("NFC").trim().replace(/\s+/gu, " ") || null;
}

function categoryKey(category: string | null | undefined) {
  const name = categoryName(category);
  return name ? `category:${name.toLocaleLowerCase("pt-BR")}` : UNCATEGORIZED;
}

export function menuCategories(products: Product[], restaurantId: string) {
  const categories = new Map<string, string>();
  let hasUncategorized = false;
  for (const product of products) {
    if (product.restaurant_id !== restaurantId) continue;
    const name = categoryName(product.category);
    if (!name) { hasUncategorized = true; continue; }
    const key = categoryKey(name);
    if (!categories.has(key)) categories.set(key, name);
  }
  return [
    { key: ALL_CATEGORIES, label: "Todos" },
    ...Array.from(categories, ([key, label]) => ({ key, label })),
    ...(hasUncategorized ? [{ key: UNCATEGORIZED, label: "Sem categoria" }] : []),
  ];
}

export function filterMenuProducts(products: Product[], restaurantId: string, selected: string, search: string) {
  const term = search.trim().toLowerCase();
  return products.filter(product =>
    product.restaurant_id === restaurantId &&
    (selected === ALL_CATEGORIES || categoryKey(product.category) === selected) &&
    (!term || `${product.name} ${product.description ?? ""}`.toLowerCase().includes(term)),
  );
}
