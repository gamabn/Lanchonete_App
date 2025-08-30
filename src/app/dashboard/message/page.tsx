import api from "@/app/util/api"
import { Chat } from "../Components/Chat";

export default async function Message(){

        const chat = await api.get('/chat')
        if(!chat)return;
       // console.log('todos os chat',chat.data)
          const allChat = chat.data
    return(
       <Chat chat={allChat}/>
    
    )
}