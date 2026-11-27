import Expired from "./expirado";
import { cookies } from "next/headers";
import api from "../util/api";

export default async function ExpiredPage() {
  const cookieStore = await cookies();
  const resturant_id = cookieStore.get("lanchoneteId")?.value;

  const response = await api.get(`/user/${resturant_id}`);
  if (!response) {
    throw new Error("Restaurante nao encontrado...");
  }
  const res = response.data;
  console.log("dados", res);
  const email = res.email;
  console.log("email do usuario:", email);

  return <Expired email={email} />;
}
