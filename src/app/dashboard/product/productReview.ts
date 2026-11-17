import type { Configuration } from "./configuredProductClient";

export type ReviewSection = "information" | "sizes" | "customizations" | "publication" | "management";
export interface ReviewTarget { section: ReviewSection; groupId?: string; label?: string }

// Display only messages, never driver/request objects, SQL or credential material.
export function safeProductMessage(message: unknown, fallback = "Não foi possível concluir a operação. Tente novamente.") {
  if (typeof message !== "string" || !message.trim() || message.length > 1000 ||
      /\b(?:bearer|authorization|password|jwt|jwt_secret|database_url|sqlstate|pg_catalog|node_modules)\b|\b(?:token|secret|credential|senha|api[_-]?key|access[_-]?token|refresh[_-]?token)\b|postgres(?:ql)?:\/\/|https?:\/\/[^\s/]+@|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b|\b(?:ECONNREFUSED|ECONNRESET|ENOTFOUND|TypeError|ReferenceError|SyntaxError)\b|Cannot read properties|is not a function|Unexpected token|[\r\n]\s*at\s|\b(?:select|insert|update|delete|alter|drop|grant)\s+[\s\S]*\b(?:from|into|table|set|on)\b/i.test(message)) return fallback;
  return message;
}

export function formReviewTarget(key: string | undefined, configuration: Configuration): ReviewTarget {
  if (key === "configuration") return { section: "information", label: "Informações, tamanhos e regras" };
  if (key === "image") return { section: "publication", label: "Imagem do produto" };
  if (key === "addVariant") return { section: "sizes" };
  if (key === "addGroup") return { section: "customizations" };
  if (key?.startsWith("new-option-")) return { section: "customizations", groupId: key.slice("new-option-".length) };
  if (key?.startsWith("option-")) return { section: "customizations", groupId: configuration.groups.find(group => group.options.some(option => option.id === key.slice("option-".length)))?.id };
  return { section: "management" };
}

// Existing responses identify fields by messages, not structured field/group IDs.
// Associate only an unambiguous saved name; otherwise use the operation's section.
export function issueReviewTarget(message: string, configuration: Configuration, fallback: ReviewTarget = { section: "publication" }): ReviewTarget {
  const lower = message.toLocaleLowerCase("pt-BR");
  const groups = configuration.groups.filter(group => {
    const name = group.name.toLocaleLowerCase("pt-BR");
    return lower.startsWith(`grupo ${name}:`) || lower.includes(`grupo ${name} `) ||
      group.options.some(option => lower.startsWith(`opção ${option.name.toLocaleLowerCase("pt-BR")}:`));
  });
  const groupId = groups.length === 1 ? groups[0].id : undefined;
  if (/nome do produto|categoria|descrição/u.test(lower)) return { section: "information" };
  if (/tamanho|preço base|menor tamanho/u.test(lower)) {
    if (groupId && /disponíve|ingrediente|possui apenas/u.test(lower)) return { section: "customizations", groupId };
    return { section: "sizes", groupId };
  }
  if (groupId || /grupo|opç|adicional|ingrediente/u.test(lower)) return { section: "customizations", groupId: groupId ?? fallback.groupId };
  if (/preço/u.test(lower)) return fallback.section === "customizations" ? fallback : { section: "sizes" };
  return fallback;
}
