import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baba yaga",
    short_name: "Sistema Gama Lanches",
    description: "Sistema atendimento e gestao para lanchonete",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#1d4ed8",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
