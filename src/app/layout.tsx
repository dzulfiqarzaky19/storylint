import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Cockpit typeface roles (globals.css maps --font-serif/sans/mono onto these).
// Every face carries 700 because the app's UI chrome declares it (rail toggles,
// confirm buttons, band headings). A weight the face does not ship is SYNTHESIZED
// by the browser — a smeared fake bold — so the loaded set must cover what the
// stylesheets ask for. 800 is not loaded anywhere on purpose: IBM Plex tops out
// at 700, so the CSS never asks past it (design.md -> Type).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
