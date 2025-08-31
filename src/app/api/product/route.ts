import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import api from "@/app/util/api";
import FormData from "form-data";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  const formData = await request.formData();
  const name = formData.get("name");
  const price = formData.get("price");
  const description = formData.get("description");
  const restaurantId = formData.get("restaurant_id"); // <- pegar o campo extra
  const imageFile = formData.get("file") as File;

  if (!name || !price || !description || !restaurantId || !imageFile) {
    return NextResponse.json(
      { message: "Todos os campos são obrigatórios" },
      { status: 400 }
    );
  }

  if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  try {
    // recria um FormData do Node
    const backendForm = new FormData();
    backendForm.append("name", name.toString());
    backendForm.append("price", price.toString());
    backendForm.append("description", description.toString());
    backendForm.append("restaurant_id", restaurantId.toString());

    backendForm.append(
      "file",
      Buffer.from(await imageFile.arrayBuffer()),
      {
        filename: imageFile.name,
        contentType: imageFile.type,
      }
    );

    console.log("produto para api", {
      name,
      price,
      description,
      restaurantId,
      imageFile,
    });

    const response = await api.post("/product", backendForm, {
      headers: {
        ...backendForm.getHeaders(),
        Authorization: `Bearer ${token}`,
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      "Erro ao se comunicar com o servidor de produtos.";
    return NextResponse.json({ message }, { status });
  }
}
