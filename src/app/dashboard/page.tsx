import api from "../util/api"
import { cookies } from "next/headers";
import { Home } from "@/app/dashboard/Components/Home";


export default async function Dashboard(){
     const cookieStore = await cookies();
     const token =  cookieStore.get("token")?.value;

    const response = await api.get('/order_item', {
      headers: {
        Authorization: `Bearer ${token}`
      },
    });
        const data = response.data;
   // console.log('Resposta da api',data)

    return(
        <Home data={data}/>
    )
}