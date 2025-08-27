import api from "@/app/util/api"
import { cookies } from "next/headers"
import { FinancasDahboard } from "../Components/Financas";


export default async function Financas(){
    const cookieStore = await cookies();
     const token =  cookieStore.get("token")?.value;

     const response = await api.get('/order', {
      headers: {
        Authorization: `Bearer ${token}`
      },
    });

    const data = response.data;
  

    const res = await api.get('/grafic', {
      headers: {
        Authorization: `Bearer ${token}`
      },
    });
    const data2 = res.data;

    console.log('Resposta da outra api',data2)
    console.log('Resposta da api',data)   
   
  return (
    <FinancasDahboard data={data} data2={data2}/>
  )
}

