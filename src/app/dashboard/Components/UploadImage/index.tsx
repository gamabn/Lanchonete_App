import { supabase } from "@/app/lib/supabase";

export async function uploadImage(file: File, productId: string): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const filePath = `products/${productId}.${fileExt}`;

  const { error: uploadError } = await supabase
    .storage
    .from("products") // substitua pelo nome correto do seu bucket
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    console.error("Erro ao fazer upload da imagem:", uploadError);
    return null;
  }

  // Agora gera a URL pública
  const { data } = supabase
    .storage
    .from("products") // mesmo nome do bucket
    .getPublicUrl(filePath);

  return data.publicUrl;
}