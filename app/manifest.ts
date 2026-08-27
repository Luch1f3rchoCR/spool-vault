import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spool Vault",
    short_name: "Spool Vault",
    description: "Inventario, peso y costos de filamentos para impresión 3D.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f2e8",
    theme_color: "#17211d",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/spool-vault-favicon.svg?v=1",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
