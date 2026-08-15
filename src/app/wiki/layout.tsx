// T-SCOPE-1 — scoped header for the wiki surface (and /wiki/manage). Loads the
// universe -> world tree once (getWorldTree) and hands it to the global Header as
// `scope`, so the wordmark becomes the design-3a ScopePill (ASHKELD · world ▾).
// The ACTIVE world is URL-driven and resolved inside ScopePill (a layout can't
// read searchParams), so this layout is a pure tree provider.
import Header from "@/components/shell/Header";
import { getWorldTree } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tree = await getWorldTree();
  return (
    <>
      <Header scope={{ tree }} />
      {children}
    </>
  );
}
