import type { CartProduct, PublicProductConfiguration } from "../models/interface";

function parseSavedJson(value: string | null): unknown {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function restoreCart(productsJson: string | null, quantitiesJson: string | null, restaurantId: string) {
  const savedProducts = parseSavedJson(productsJson);
  const savedQuantities = parseSavedJson(quantitiesJson);
  const quantities = savedQuantities && typeof savedQuantities === "object" && !Array.isArray(savedQuantities)
    ? savedQuantities as Record<string, unknown> : {};
  const products: CartProduct[] = [];
  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  for (const item of Array.isArray(savedProducts) ? savedProducts : []) {
    if (!item || typeof item.id !== "string" || !item.id ||
      item.restaurant_id !== restaurantId || typeof item.name !== "string" ||
      !Number.isFinite(readDeliveryFee(item.price))) continue;
    const hasConfiguration = item.variant_id !== undefined || item.option_ids !== undefined;
    if (hasConfiguration && (typeof item.variant_id !== "string" || !item.variant_id ||
        !Array.isArray(item.option_ids) || item.option_ids.length > 100 ||
        !item.option_ids.every((id: unknown) => typeof id === "string" && id.length > 0) ||
        new Set(item.option_ids).size !== item.option_ids.length)) continue;
    const key = cartLineKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    const quantity = Number(quantities[key]);
    counts[key] = Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 32767 ? quantity : 1;
    products.push({ ...item, price: Number(item.price),
      image_url: typeof item.image_url === "string" ? item.image_url : "",
      ...(hasConfiguration ? {
        option_ids: [...item.option_ids].sort(),
        variant_name: typeof item.variant_name === "string" ? item.variant_name : "Selecionado",
        options: Array.isArray(item.options) ? item.options.filter((option: unknown) => {
          if (!option || typeof option !== "object") return false;
          const entry = option as Record<string, unknown>;
          return typeof entry.id === "string" && typeof entry.name === "string" &&
            typeof entry.group_name === "string" && item.option_ids.includes(entry.id);
        }) : [],
      } : {}),
    });
  }
  return { products, counts };
}

// Missing or malformed fees must never become free delivery through Number(null).
export function readDeliveryFee(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())) return NaN;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
}

export function lerValorEmReais(value: string): number {
  const clean = value.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (!clean) return 0;
  const valid = clean.includes(",")
    ? /^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(clean)
    : /^\d+(?:\.\d{1,2})?$/.test(clean);
  if (!valid) return NaN;
  const number = Number(clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
}

export function cartLineKey(item: Pick<CartProduct, "id" | "variant_id" | "option_ids">): string {
  return item.variant_id
    ? JSON.stringify([item.id, item.variant_id, [...(item.option_ids ?? [])].sort()])
    : item.id;
}

export function orderItems(products: CartProduct[], quantities: Record<string, number>) {
  return products.map((item) => {
    const quantity = quantities[cartLineKey(item)];
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 32767) {
      throw new Error("Quantidade inválida. Revise os itens do carrinho.");
    }
    return {
      product_id: item.id,
      quantity,
      ...(item.variant_id ? { variant_id: item.variant_id, option_ids: item.option_ids ?? [] } : {}),
    };
  });
}

// This estimate is for display. The order service calculates the definitive amount.
export function configuredCartProduct(
  configuration: PublicProductConfiguration,
  restaurantId: string,
  variantId: string,
  optionIds: string[],
  validateLimits = true,
): CartProduct {
  const { product, variants, groups } = configuration;
  if (product.restaurant_id !== restaurantId) throw new Error("Produto de outro estabelecimento.");
  const variant = variants.find((item) => item.id === variantId);
  if (!variant) throw new Error("Selecione um tamanho disponível.");
  if (optionIds.length > 100 || new Set(optionIds).size !== optionIds.length) {
    throw new Error("Lista de opções inválida.");
  }
  const selected = new Set(optionIds);
  const options = groups.flatMap((group) => group.options
    .filter((option) => selected.has(option.id) && option.group_id === group.id)
    .map((option) => ({
      id: option.id, name: option.name, group_name: group.name,
      additional_price: readDeliveryFee(option.additional_price),
    })));
  if (options.length !== selected.size) throw new Error("Uma opção está indisponível. Selecione o produto novamente.");
  for (const group of groups) {
    const limit = variant.groupLimits.find((item) => item.groupId === group.id);
    if (!limit || !Number.isInteger(limit.minSelect) || !Number.isInteger(limit.maxSelect) ||
        limit.minSelect < 0 || limit.maxSelect < limit.minSelect ||
        (group.required && limit.minSelect === 0)) {
      throw new Error("Configuração indisponível para este tamanho.");
    }
    const count = group.options.filter((option) => selected.has(option.id)).length;
    if (validateLimits && (count < limit.minSelect || count > limit.maxSelect)) {
      throw new Error(`${group.name}: selecione entre ${limit.minSelect} e ${limit.maxSelect} opções.`);
    }
  }
  const amounts = [readDeliveryFee(variant.price), ...options.map((option) => option.additional_price)];
  if (amounts.some((value) => !Number.isFinite(value))) throw new Error("Preço indisponível.");
  const price = amounts.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
  return {
    ...product,
    price,
    has_variants: true,
    variant_id: variant.id,
    variant_name: variant.name,
    option_ids: [...optionIds].sort(),
    options,
  };
}

export async function loadPublicConfiguration(productId: string, restaurantId: string) {
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}/configuration`, {
    cache: "no-store", signal: AbortSignal.timeout(15000),
  }).catch(() => { throw new Error("Falha de conexão ao carregar o produto. Tente novamente."); });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(body?.error || "Não foi possível carregar o produto.");
  const configuration = body as PublicProductConfiguration;
  if (configuration.product.id !== productId || configuration.product.restaurant_id !== restaurantId) {
    throw new Error("Produto de outro estabelecimento.");
  }
  return configuration;
}

export async function refreshCartProducts(products: CartProduct[], restaurantId: string) {
  const configurations = new Map<string, Promise<PublicProductConfiguration>>();
  return Promise.all(products.map(async (item) => {
    let request = configurations.get(item.id);
    if (!request) {
      request = loadPublicConfiguration(item.id, restaurantId);
      configurations.set(item.id, request);
    }
    try {
      const configuration = await request;
      if (item.variant_id) {
        return configuredCartProduct(configuration, restaurantId, item.variant_id, item.option_ids ?? []);
      }
      if (configuration.product.has_variants || configuration.variants.length) {
        throw new Error("Selecione o tamanho e as opções novamente no cardápio.");
      }
      const price = readDeliveryFee(configuration.product.price);
      if (!Number.isFinite(price)) throw new Error("Preço indisponível.");
      return { ...configuration.product, price };
    } catch (error) {
      throw new Error(`${item.name}: ${error instanceof Error ? error.message : "produto indisponível"}. Revise este item no cardápio.`);
    }
  }));
}
