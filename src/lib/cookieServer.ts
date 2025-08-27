import  { cookies } from "next/headers";

export async function getCookiesServer() {
    const token = (await cookies()).get("token")?.value;
  // const token = cookies().then(token => token.get("session")?.value)
   return token || null;
}