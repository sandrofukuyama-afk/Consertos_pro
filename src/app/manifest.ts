import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ConsertosPro - Diagnóstico Inteligente de Bancada",
    short_name: "ConsertosPro",
    description: "Sistema da oficina para acompanhar casos, registrar testes e manter memória técnica.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1a1613",
    theme_color: "#b86d3c",
    orientation: "portrait",
    lang: "pt-BR",
    categories: ["productivity", "business", "utilities"],
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
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
