import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: "Inventario, peso y costos de filamentos para impresión 3D.",
    start_url: "/",
    display: "standalone",
    background_color: brand.colors["warm-canvas"],
    theme_color: brand.colors.ink,
    orientation: "portrait-primary",
    icons: [
      {
        src: "/brand/proper-v1/android-chrome-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/brand/proper-v1/android-chrome-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
