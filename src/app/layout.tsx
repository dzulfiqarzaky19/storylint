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
        <style>{`
          .skipLink {
            position: absolute;
            left: -9999px;
            top: 0;
            z-index: 100;
            padding: 8px 14px;
            background: var(--ground);
            color: var(--ink);
            border: var(--rule-major);
            font-weight: 700;
          }
          .skipLink:focus {
            left: 0;
          }
        `}</style>
        <a href="#main" className="skipLink">
          Skip to main content
        </a>
        <Header />
        <div id="main" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
