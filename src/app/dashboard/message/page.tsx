import api from "@/app/util/api"
import { Chat } from "../Components/Chat";
//import { cookies } from "next/headers";

// Força a página a ser renderizada dinamicamente no servidor a cada requisição.
// Isso garante que a lista de chats seja sempre a mais recente.
export const dynamic = 'force-dynamic';

export default async function Message(){

       // const cookieStore = await cookies();
        //const token = cookieStore.get("token")?.value;

        const chat = await api.get('/chat' 
        // {
        //    headers: {
        //        Authorization: `Bearer ${token}`
         //   }
       // }
      )
        if(!chat)return;
        console.log('todos os chat',chat.data)
          const allChat = chat.data
    return(
       <Chat chat={allChat}/>
    
    )
}