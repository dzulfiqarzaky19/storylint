// T-SCOPE-2 — the /write header now carries the BOOK scope pill (ACTIVE WORLD ->
// ACTIVE BOOK) instead of the static wordmark. The layout loads the world tree
// (getWorldTree, server-side) and hands it to Header as `bookScope`; Header
// renders the BookPill, whose dropdown switches books and whose footer creates,
// renames, and deletes them. The active book is URL-driven (?u/?w/?book), read by
// the pill and the page from the SAME resolveWriteScope.
import Header from "@/components/shell/Header";
import { getWorldTree } from "@/lib/db/queries";

export default async function WriteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tree = await getWorldTree();
  return (
    <>
      <Header bookScope={{ tree }} />
      {children}
    </>
  );
}
