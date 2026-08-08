import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import Header from "@/components/shell/Header";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ashkeld",
  description: "A gazetteer in progress.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
