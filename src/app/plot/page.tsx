// Server component: resolve the active world/book from the URL (the SAME resolver
// /wiki + /research use), load the plot progression (plotlines x chapters), and
// hand it to the client grid. Read-only — /plot never mutates. World-scoped so a
// header world switch re-scopes the arcs to that world.
import { getWorldTree } from "@/lib/db/queries";
import { loadPlotProgression } from "@/lib/db/plot";
import { resolveWikiScope } from "@/app/wiki/scope";
import PlotScreen from "@/components/plot/PlotScreen";

export const dynamic = "force-dynamic";

export default async function PlotPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; w?: string }>;
}) {
  const sp = await searchParams;
  const { activeWorldId, activeBookId } = resolveWikiScope(
    await getWorldTree(),
    sp.u,
    sp.w,
  );
  const progression = await loadPlotProgression(activeWorldId, activeBookId);
  // Key on the world so switching worlds remounts the grid with the new arcs.
  return <PlotScreen key={activeWorldId} progression={progression} />;
}
