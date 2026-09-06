// Server component: resolve the active world/book from the URL (the SAME resolver
// /wiki + /research use), load the plot progression (plotlines x chapters), and
// hand it to the client grid. Read-only — /plot never mutates. World-scoped so a
// header world switch re-scopes the arcs to that world.
import { getWorldTree } from "@/lib/db/queries";
import { loadPlotProgression } from "@/lib/db/plot";
import { resolveActiveScope } from "@/lib/scope/activeScope";
import Plot from "@/features/plot/Plot";

export const dynamic = "force-dynamic";

export default async function PlotPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; w?: string }>;
}) {
  const sp = await searchParams;
  const scope = resolveActiveScope(await getWorldTree(), sp);
  const progression = await loadPlotProgression(scope.worldId, scope.bookId);
  // Key on the world so switching worlds remounts the grid with the new arcs.
  return (
    <Plot
      key={scope.worldId}
      progression={progression}
      worldId={scope.worldId}
      bookId={scope.bookId}
    />
  );
}
