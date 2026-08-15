// T-SCOPE-1 — plain header for the research surface. No scope data (research is
// not world-scoped), so the global Header degrades to the static ASHKELD
// wordmark; passing no `scope` is exactly the graceful-degrade path.
import Header from "@/components/shell/Header";

export default function ResearchLayout({
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
