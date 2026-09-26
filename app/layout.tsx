import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { PwaRegistration } from "@/components/pwa-registration";
import { brand } from "@/lib/brand";
import "./brand/proper-brand-tokens.css";
import "./globals.css";
import "./approved-ui.css";
import "./brand/proper-theme.css";

const bodyFont = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const headingFont = Manrope({ subsets: ["latin"], variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  applicationName: brand.name,
  title: {
    default: brand.name,
    template: `%s · ${brand.name}`
  },
  description: "Inventario, peso y costos de filamentos para impresión 3D.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/proper-v1/favicon.ico", sizes: "any" },
      { url: "/brand/proper-v1/favicon-32.png", type: "image/png", sizes: "32x32" }
    ],
    shortcut: "/brand/proper-v1/favicon.ico",
    apple: [{ url: "/brand/proper-v1/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: brand.name
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: brand.colors.ink,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${bodyFont.variable} ${headingFont.variable}`}>
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
