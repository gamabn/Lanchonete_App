import { NextResponse, NextRequest } from "next/server";
import api from "@/app/util/api";
import { cookies } from "next/headers";

export async function POST(request: NextRequest){
  const cookieStore = await cookies();
  const token =  cookieStore.get("token")?.value;

  const formData = await request.formData();
  const name = formData.get("name");
  const price = formData.get("price");
  const description = formData.get("description");
  const imageFile = formData.get("file");

  if(!name || !price || !description || !imageFile){
    return NextResponse.json({message: "Todos os campos sao obrigatorio"}, {status: 400})
  
  }
    //const token = request.cookies.get("token")?.value;
   
     if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

    // Repassa o FormData diretamente. O Axios/Fetch vai configurar o Content-Type
    // para 'multipart/form-data' automaticamente.
    const response = await api.post("/product", formData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return NextResponse.json(response.data); 
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
  } catch (error) {
    return NextResponse.json({ message: "Erro ao buscar produtos" }, { status: 500 });
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
