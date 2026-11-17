export const whatsappStates = ["disconnected", "connecting", "qr_required", "connected", "reconnecting", "error", "legacy_active"] as const;
export type WhatsAppState = typeof whatsappStates[number];
export interface WhatsAppSnapshot { restaurant_id: string; status: WhatsAppState; qr_available: boolean; error: string | null }
export interface WhatsAppQR { restaurant_id: string; qr: string | null; expires_at: string | null }
const codes = new Set(["UNAUTHORIZED", "OWNER_NOT_FOUND", "INVALID_OWNER", "LEGACY_WORKER_ACTIVE", "REAL_CHECKOUT_DISABLED",
  "WHATSAPP_CONNECTION_DISABLED", "WHATSAPP_WORKER_DISABLED", "REAL_CHECKOUT_REQUIRED", "REAL_CHECKOUT_UNAVAILABLE", "INVALID_WHATSAPP_RESPONSE", "TENANT_MISMATCH", "WHATSAPP_TIMEOUT", "WHATSAPP_BACKEND_UNREACHABLE", "WHATSAPP_ROUTE_UNAVAILABLE", "HOST_STOPPING", "START_FAILED", "STOP_FAILED", "LOCK_PRESENT", "AUTH_FILES_INVALID",
  "SESSION_AUTH_DIR_CHANGED", "SESSION_REPLACED", "REAUTH_REQUIRED", "RETRY_LIMIT", "WHATSAPP_UNAVAILABLE"]);
export function safeWhatsAppCode(value: unknown): string { return typeof value === "string" && codes.has(value) ? value : "WHATSAPP_UNAVAILABLE"; }
export function parseWhatsAppSnapshot(value: unknown): WhatsAppSnapshot {
  const data = value as Partial<WhatsAppSnapshot> | null;
  if (!data || typeof data.restaurant_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.restaurant_id) ||
      !whatsappStates.includes(data.status as WhatsAppState) || typeof data.qr_available !== "boolean") throw new Error("Invalid response");
  return { restaurant_id: data.restaurant_id, status: data.status as WhatsAppState, qr_available: data.qr_available,
    error: data.error == null ? null : safeWhatsAppCode(data.error) };
}
export function whatsappErrorMessage(code: string): string {
  switch (code) {
    case "INVALID_WHATSAPP_RESPONSE": return "O servidor retornou um status de WhatsApp inválido. Verifique se o backend está atualizado e tente novamente.";
    case "TENANT_MISMATCH": return "A conexão retornada pertence a outra sessão. Recarregue a página para validar sua conta.";
    case "WHATSAPP_TIMEOUT": return "O servidor demorou para responder. Atualize o status antes de tentar conectar novamente.";
    case "WHATSAPP_BACKEND_UNREACHABLE": return "Não foi possível comunicar com o backend. Verifique se o serviço está disponível e atualize o status.";
    case "WHATSAPP_ROUTE_UNAVAILABLE": return "A rota de WhatsApp não está disponível no backend configurado. Verifique se o backend está atualizado.";
    case "START_FAILED": return "Não foi possível iniciar a sessão do WhatsApp. Atualize o status e tente conectar novamente.";
    case "REAL_CHECKOUT_REQUIRED":
    case "REAL_CHECKOUT_UNAVAILABLE": return "O atendimento do WhatsApp está temporariamente indisponível. Tente novamente.";
    case "UNAUTHORIZED": return "Sua sessão expirou. Entre novamente para continuar.";
    case "OWNER_NOT_FOUND": case "INVALID_OWNER": return "Você não tem permissão para gerenciar esta conexão.";
    case "LEGACY_WORKER_ACTIVE": return "Esta conexão está em uso pelo modo de desenvolvimento. Encerre esse modo antes de conectar pelo painel.";
    case "WHATSAPP_CONNECTION_DISABLED":
    case "WHATSAPP_WORKER_DISABLED":
    case "REAL_CHECKOUT_DISABLED": return "A conexão pelo painel ainda não está habilitada. Contate o suporte.";
    case "LOCK_PRESENT": return "Esta sessão está em uso. Aguarde o encerramento da outra conexão ou contate o suporte.";
    case "REAUTH_REQUIRED": case "AUTH_FILES_INVALID": return "A sessão do WhatsApp precisa de verificação. Contate o suporte antes de tentar um novo pareamento.";
    case "SESSION_REPLACED": return "O WhatsApp foi conectado em outra instância. Confira essa conexão antes de tentar novamente.";
    case "STOP_FAILED": return "Não foi possível confirmar a desconexão. Atualize o status antes de tentar novamente.";
    default: return "Não foi possível acessar a conexão do WhatsApp. Tente atualizar o status.";
  }
}
