This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Frontend, TypeScript e erros JSX no editor

O frontend é esta pasta (`Lanchonete_App`). O backend possui outro
`package.json`, outro `tsconfig.json` e não fornece os tipos React do frontend.
Execute os comandos abaixo a partir de `Lanchonete_App`:

```bash
# Somente se as dependências estiverem ausentes ou incompletas:
npm ci

npm run typecheck
npm run test:react-types
npm run test:auth
npm run test:checkout
npm run build
```

A instalação atual utiliza Next 15.3.5, React/React DOM 19.1.0,
`@types/react` 19.1.8, `@types/react-dom` 19.1.6 e TypeScript 5.8.3.
Os lockfiles npm e Yarn concordam nessas versões; não é necessário atualizar
pacotes para corrigir a resolução JSX. Os comandos de manutenção desta seção
usam npm e `package-lock.json`; evite alternar os instaladores na mesma instalação.
Execute as verificações em sequência: o build recria `.next/types`, portanto um
`tsc` simultâneo pode encontrar arquivos gerados temporariamente ausentes.

As configurações `.vscode/settings.json` na raiz e no frontend apontam para o
mesmo TypeScript local. Incluem os nomes atuais das opções e seus equivalentes
anteriores para versões diferentes do VS Code.

Se `ts(7026)` ou `ts(2875)` aparecerem somente no editor:

1. Abra o arquivo real `src/app/clients/[idClient]/pedidos/component/chatClient/page.tsx`
   dentro de `Lanchonete_App`, com modo de linguagem **TypeScript React**.
2. Execute **TypeScript: Select TypeScript Version → Use Workspace Version**.
3. Execute **TypeScript: Go to Project Configuration**. Deve abrir
   `Lanchonete_App/tsconfig.json`, e não o arquivo do backend nem um projeto inferido.
4. Execute **TypeScript: Restart TS Server** para recarregar o estado do editor.

O `tsconfig.json` mantém `jsx: preserve`, `moduleResolution: bundler` e os aliases
Next existentes. Não acrescente declarações globais de JSX, `any` ou supressões
para contornar esses diagnósticos. O teste `test:react-types` verifica a resolução
real de `react/jsx-runtime`, sua declaração de tipos e os dois componentes de chat.
Se os comandos passarem e o editor continuar acusando erros, é necessário conferir
o caminho do arquivo e o log do TS Server no editor; o build sozinho não confirma
qual projeto o editor selecionou.
