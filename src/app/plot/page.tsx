import { getWorldTree } from "@/server/db/structure/queries";
import { loadPlotProgression } from "@/server/db/plot/queries";
import { resolveActiveScope } from "@/domain/scope/activeScope";
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
  return (
    <Plot
      key={scope.worldId}
      progression={progression}
      worldId={scope.worldId}
      bookId={scope.bookId}
    />
  );
}
