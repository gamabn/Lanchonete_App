import api from "@/app/util/api";
import { Chat } from "../Components/Chat";
import { cookies } from "next/headers";

// Força a página a ser renderizada dinamicamente no servidor a cada requisição.
// Isso garante que a lista de chats seja sempre a mais recente.
export const dynamic = "force-dynamic";

export default async function Message() {
  // const cookieStore = await cookies();
  //const token = cookieStore.get("token")?.value;
  try {
    const response = await api.get("/chat", { headers: { Authorization: `Bearer ${(await cookies()).get("token")?.value}` } });
    const responseData = response.data;

    // console.log("Chat do pedidod", responseData);

    if (!responseData) {
      throw new Error("Chat nao encontrado");
    }

    return <Chat chat={responseData} />;
  } catch (err) {
    // Tratamento de erro: exibe uma mensagem amigável na tela caso a API falhe
    return <p>Erro ao carregar o chat. Tente novamente mais tarde.</p>;
  }
}
