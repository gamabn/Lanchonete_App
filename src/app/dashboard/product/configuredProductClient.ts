interface GroupLimit {
  groupId: string;
  minSelect: number;
  maxSelect: number;
}

export interface Configuration {
  product: {
    id: string;
    name: string;
    published: boolean;
    description: string | null;
    price: string;
    image_url: string | null;
    available: boolean | null;
  };
  variants: {
    id: string;
    name: string;
    price: string;
    available: boolean | null;
    groupLimits: GroupLimit[];
  }[];
  groups: {
    id: string;
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    options: { id: string; name: string; additionalPrice: number; available: boolean | null }[];
  }[];
}

export interface PublicationValidation {
  valid: boolean;
  errors: string[];
}

export class ProductRequestError extends Error {
  constructor(message: string, readonly status: number, readonly details: string[] = []) {
    super(message);
  }
}

export async function requestProduct<T>(url: string, fallback: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" }).catch(() => {
    throw new Error(fallback);
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    const message = body?.error || body?.message || fallback;
    const details: string[] = Array.isArray(body?.details)
      ? body.details.filter((item: unknown): item is string => typeof item === "string")
      : [];
    throw new ProductRequestError(details.length ? `${message} ${details.join(" ")}` : message, response.status, details);
  }
  return body as T;
}

