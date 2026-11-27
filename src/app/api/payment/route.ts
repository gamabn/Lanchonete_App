import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isAxiosError } from "axios";
import api from "@/app/util/api";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json(
        { message: "Email nao informado" },
        { status: 400 },
      );
    }

    const response = await api.post(
      "/payment",
      { email },

      {
        timeout: 15000,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return NextResponse.json(response.data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ERRO AO INICIAR PAGAMENTO:", {
      status: isAxiosError(error) ? error.response?.status : undefined,
      data: isAxiosError(error) ? error.response?.data : undefined,
    });

    if (isAxiosError(error) && error.response) {
      return NextResponse.json(error.response.data, {
        status: error.response.status,
      });
    }

    return NextResponse.json(
      { message: "Não foi possível conectar ao serviço de pagamento." },
      { status: 503 },
    );
  }
}
