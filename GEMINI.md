# GEMINI.md — Gama Delivery (Frontend)

Frontend Next.js do sistema Gama Delivery (`Lanchonete_App`). O backend fica em repositório separado (`../BackEnd-lanchonete`).

## Stack
- **Framework:** Next.js `15.5.29` (App Router em `src/app`), React `19.1.2`, TypeScript `5` (`strict: true`)
- **Estilo e UI:** Tailwind CSS v4 (`@tailwindcss/postcss`), `lucide-react`, `react-icons`, `react-toastify`, `chart.js` / `react-chartjs-2`
- **Formulários e validação:** `react-hook-form`, `zod` v4, `@hookform/resolvers`
- **Comunicação e utilitários:** `axios`, `socket.io-client`, `cookies-next`, `date-fns`, `qrcode`
- **Testes:** `node --test` (`tests/*.cjs` com `typescript` + `vm` + `jsdom`) e Jest + `@testing-library/react` (`tests/delete-lanchonete.test.tsx`)

## Banco de dados e API
- **Sem acesso direto a banco neste repositório:** não há ORM, migrations nem cliente Supabase em `src/` (embora pacotes `@supabase/*` estejam em `package.json`).
- Toda persistência (PostgreSQL/Neon) e regra de negócio ficam no backend Express (`../BackEnd-lanchonete`), acessado via `backendUrl` (`NEXT_PUBLIC_API_RENDER || NEXT_PUBLIC_API_LOCAL`, ver `src/app/util/backend.ts` e `src/app/util/api.ts`).

## Estrutura de pastas
- `src/middleware.ts`: protege `/dashboard/:path*` validando cookie `token` em `${backendUrl}/me` (redireciona 401 para `/auth/login`; retorna `503` em falhas sem apagar cookie).
- `src/app/page.tsx` e `src/app/layout.tsx`: raiz renderiza login; layout global injeta `ContextProvider` e `ToastContainer`.
- `src/app/auth/` e `src/app/reset-password/`: login, cadastro, verificação de e-mail e redefinição de senha.
- `src/app/dashboard/`: área do restaurante sob `AuthGuard` + `SoundProvider` (`product/`, `editProduct/`, `bairros/`, `financas/`, `message/`, `profile/`, `whatsapp/`, `Components/`, `Delete/`).
- `src/app/clients/[idClient]/`: cardápio público da loja, configurador de produto, carrinho/checkout (`pedidos/`) e chat do cliente (`pedidos/component/chatClient/`).
- `src/app/api/`: Route Handlers BFF/proxy para o backend (`login`, `profile`, `user`, `bairros`, `store`, `store-image`, `product/*`, `products/*`, `orders/*`, `client/*`, `chat/*`, `whatsapp/*`, `web-push`).
- `src/app/Context/`: `index.tsx` (estado de autenticação, perfil, modal/chat, vendas) e `SoundContext.tsx`.
- `src/app/components/`, `src/app/models/interface.ts`, `src/app/util/`, `src/app/money/`: UI compartilhada, interfaces TS, clientes/helpers de checkout, socket e formatação monetária.
- `src/lib/`: cookies e sessão (`cookieServer.ts`, `cookieClient.ts`, `customerCookie.ts`, `customerSession.ts`).
- `src/types/`: declarações de tipos locais (`qrcode.d.ts`).
- `public/`: assets, áudios de alerta (`audio/`) e service workers (`sw.js`, `vapid-sw.js`).
- `tests/`: suítes automatizadas (`.cjs` e `.test.tsx`).

## Comandos (usar `npm` na raiz de `Lanchonete_App`)
- **Dev:** `npm run dev` (local com backend: `NEXT_PUBLIC_API_LOCAL=http://localhost:3333 npm run dev`)
- **Build / Start:** `npm run build` / `npm run start`
- **Lint / Typecheck:** `npm run lint` / `npm run typecheck` (`tsc --noEmit` — rodar sequencialmente, nunca em paralelo com `build`, pois `build` recria `.next/types`)
- **Testes:**
  - `npm run test:auth`
  - `npm run test:checkout`
  - `npm run test:whatsapp`
  - `npm run test:react-types`
  - Outros `.cjs`: `node --test tests/<arquivo>.cjs`
  - Jest: `npx jest`

## Regras de arquitetura e fluxo de trabalho
- **Acompanhamento (`AGENTS.md`):** ler `../BackEnd-lanchonete/PROGRESSO.md` antes de iniciar tarefas de projeto e atualizar apenas esse arquivo ao concluir etapas; não criar controle paralelo no frontend.
- **Autenticação e multi-tenant:**
  - JWT do restaurante fica apenas no cookie HttpOnly `token`; sessão pública de cliente fica no cookie HttpOnly por loja (`customerCookieName(id)`).
  - Nunca expor JWT, credenciais de cliente ou credenciais Baileys ao navegador, nem aceitar seleção de tenant vinda do browser (o backend resolve o tenant pelo token).
  - Não apagar sessões/cookies em erros transitórios (`503`/rede).
- **Proxies BFF (`src/app/api/*`):**
  - Mutações (`POST`, `PATCH`, `DELETE`) devem validar `request.headers.get("origin") === request.nextUrl.origin` (`403` se divergir).
  - Retornar `Cache-Control: no-store` (e `private`, `Vary: Cookie` nos fluxos sensíveis como WhatsApp).
  - Conexões Socket.IO (`/orders` e chat) devem trocar o cookie HttpOnly por ticket curto via route handler (`POST /api/orders/socket-ticket`, `POST /api/chat/socket-ticket`).

## Convenções de código
- Usar alias `@/*` para `./src/*`; manter `tsconfig.json` (`jsx: preserve`, `moduleResolution: bundler`, `strict: true`) sem `any` ou supressões globais de JSX.
- Sanitizar mensagens de erro exibidas à UI/cliente (nunca vazar tokens, stack traces, URLs com credenciais ou SQL).
- Em `src/app/api/*` no Next 15, tipar `context.params` como `Promise<...>` e aguardar com `await`.
- Não misturar `yarn` com `npm` (`package-lock.json` é o padrão de manutenção).
