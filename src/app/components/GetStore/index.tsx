import api from "@/app/util/api"

export async function GetStoreId(id: string){
     if(!id)return 

  const response = await api.get(`/user/${id}`)
  console.log('loja do cliente',response)
  return response.data
}