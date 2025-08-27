import  { NextResponse, NextRequest } from "next/server";
import api from "@/app/util/api";

export async function PUT(request: NextRequest) {
    const token = request.cookies.get("token")?.value;
   const data = await request.json();
   const {id,  name, email, phone, city, neighborhood, street, number } = data;


      if( !name || !email || !phone || !city || !neighborhood || !street || !number){
        return NextResponse.json({message: "Todos os campos sao obrigatorio"}, {status: 400})
      }

      try{

        const response = await api.put(`/user/edit/`, {
          name,
          email,
          phone,
          city,
          neighborhood,
          street,
          number,
        }
          , {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        return NextResponse.json(response.data);

      }catch(error){
      return NextResponse.json({message:'Erro ao Editar,', error} , {status: 500})
      }  

}
