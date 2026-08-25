import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Cockpit typeface roles (globals.css maps --font-serif/sans/mono onto these).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "storylint",
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
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
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
