import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { outfit } from "./_landing/font";
import "./globals.css";

// Texto: Hanken Grotesk. Títulos: Outfit (la misma de la landing y del logo).
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Winflow",
  description: "Propuestas con la voz de tu agencia y seguimiento automático",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      className={`${hanken.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
