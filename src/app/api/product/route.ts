import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import api from "@/app/util/api";

export async function POST(request: NextRequest){
  const cookieStore = await cookies();
  const token =  cookieStore.get("token")?.value;

  const formData = await request.formData();
  const name = formData.get("name");
  const price = formData.get("price");
  const description = formData.get("description");
  const imageFile = formData.get("file");

  if(!name || !price || !description || !imageFile){
    return NextResponse.json({message: "Todos os campos são obrigatórios"}, {status: 400})
  
  }
   
     if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  try {
    // Repassa o FormData para o backend no Render
    const response = await api.post("/product", formData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return NextResponse.json(response.data);
  } catch (error: any) {
    // **PONTO CRÍTICO**: Captura o erro real do backend (Render) e o envia para o frontend.
    // Sem isso, você só vê um "Erro 500" genérico.
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || "Erro ao se comunicar com o servidor de produtos.";
    return NextResponse.json({ message }, { status });
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token =  cookieStore.get("token")?.value;


     if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  try {
    const response = await api.get("/product",{
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return NextResponse.json(response.data);
  } catch (error: any) {
    // Melhora o tratamento de erro aqui também
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || "Erro ao buscar produtos no servidor.";
    return NextResponse.json({ message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  const cookieStore = await  cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const product_id = formData.get("product_id");
  const name = formData.get("name");
  const price = formData.get("price");
  const description = formData.get("description");
  const restaurant_id = formData.get("restaurant_id");
  const old_public_id = formData.get("old_public_id"); // agora pega
  const imageFile = formData.get("file");

  if (!product_id || !name || !price || !description || !restaurant_id) {
    return NextResponse.json(
      { message: "Todos os campos (exceto imagem) são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const response = await api.put(`/product/edit`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      "Erro interno no servidor ao atualizar produto.";
    return NextResponse.json({ message }, { status });
  }
}
