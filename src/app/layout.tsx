import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
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
        {/* Header is rendered per-surface (wiki gets the scoped ScopePill; other
            surfaces a plain wordmark) so only scope-bearing routes load the tree.
            See the layout.tsx under each surface route. */}
        <div id="main" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
