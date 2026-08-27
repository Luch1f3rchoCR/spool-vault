import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/pwa-registration";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Spool Vault",
  title: {
    default: "Spool Vault",
    template: "%s · Spool Vault"
  },
  description: "Inventario, peso y costos de filamentos para impresión 3D.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/spool-vault-favicon.svg?v=1", type: "image/svg+xml" }],
    shortcut: "/spool-vault-favicon.svg?v=1",
    apple: "/spool-vault-favicon.svg?v=1"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Spool Vault"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#17211d",
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
