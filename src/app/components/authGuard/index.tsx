// components/AuthGuard.tsx
"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Context } from "@/app/Context";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authStatus, authError, revalidateAuth } = useContext(Context);
  const router = useRouter();

  useEffect(() => {
    // Se a verificação de autenticação ainda não terminou, não fazemos nada.
    if (authStatus === "loading") {
      return;
    }

    // Após a verificação, se não houver usuário, redireciona para o login.
    if (authStatus === "unauthenticated") {
      router.replace("/auth/login");
    }
  }, [authStatus, router]);

  // Mostra uma tela de carregamento enquanto a autenticação está sendo verificada.
  if (authStatus === "loading") {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  // Se o usuário estiver autenticado, renderiza o conteúdo protegido.
  // Caso contrário, o useEffect já terá iniciado o redirecionamento.
  // Retornar null evita um "flash" do conteúdo protegido para usuários não autenticados.
  if (authStatus === "error") {
    return <div role="alert" className="text-center mt-10">
      <p>{authError}</p>
      <button onClick={() => void revalidateAuth()}>Tentar novamente</button>
    </div>;
  }
  return authStatus === "authenticated" ? <>{children}</> : null;
}
