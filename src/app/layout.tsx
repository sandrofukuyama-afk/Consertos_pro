import type { Metadata } from "next";
import { FormAssistProvider } from "@/components/form-assist-provider";
import { IBM_Plex_Mono, IBM_Plex_Sans, Sora } from "next/font/google";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PwaProvider } from "@/components/pwa-provider";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  applicationName: "ConsertosPro",
  title: "ConsertosPro",
  description: "Sistema da oficina para acompanhar casos, registrar testes e guardar o que foi aprendido.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ConsertosPro",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/apple-icon",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${sora.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#ca6a55" />
      </head>
      <body className="min-h-full flex flex-col">
        <FormAssistProvider />
        <PwaProvider />
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
