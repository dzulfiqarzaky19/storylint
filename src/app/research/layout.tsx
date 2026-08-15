// T-RESEARCH-2 — scoped header for the research surface. Research is now
// WORLD-scoped (parity with /wiki), so this loads the universe -> world tree and
// hands it to the global Header as `scope`, making the wordmark the design-3a
// ScopePill. `basePath: "/research"` keeps a world switch ON /research instead
// of jumping to /wiki. The ACTIVE world is URL-driven and resolved inside
// ScopePill (a layout can't read searchParams), so this layout is a pure tree
// provider.
import Header from "@/components/shell/Header";
import { getWorldTree } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tree = await getWorldTree();
  return (
    <>
      <Header scope={{ tree, basePath: "/research" }} />
      {children}
    </>
  );
}
