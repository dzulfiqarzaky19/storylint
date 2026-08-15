// T-SCOPE-1 — plain header for the write surface. Book scope lives on the page
// itself, not the world switcher, so the global Header degrades to the static
// ASHKELD wordmark (no `scope` prop = graceful degrade, never crashes).
import Header from "@/components/shell/Header";

export default function WriteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
