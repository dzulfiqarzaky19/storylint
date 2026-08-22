// /plot layout — world-scoped header, parity with /research. Loads the
// universe -> world tree and hands it to the global Header as `scope` so the
// wordmark becomes the ScopePill; `basePath: "/plot"` keeps a world switch ON
// /plot instead of jumping to /wiki. The ACTIVE world is URL-driven and resolved
// inside ScopePill (a layout can't read searchParams), so this is a pure tree
// provider — it never modifies the /wiki, /research, /write surfaces.
import Header from "@/components/shell/Header";
import { getWorldTree } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function PlotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tree = await getWorldTree();
  return (
    <>
      <Header scope={{ tree, basePath: "/plot" }} />
      {children}
    </>
  );
}
