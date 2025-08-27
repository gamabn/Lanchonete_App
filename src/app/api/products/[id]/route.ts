import { NextResponse,NextRequest } from "next/server";
import api from "@/app/util/api";

export async function GET(req: Request){
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop(); // pega o ID da rota

    if(!id) return NextResponse.json({error: "ID não fornecido"}, {status: 400})

        try{
            const response = await api.get(`/product/${id}`);
            return NextResponse.json(response.data);
        }catch(err){
            return NextResponse.json({error: "Erro ao buscar loja"}, {status: 500})
        }
}