import type { ReactNode } from "react";
import Header from "@/components/shell/Header";
import { getWorldTree } from "@/server/db/structure/queries";

type Surface = "wiki" | "write" | "research" | "plot";

export default async function SurfaceLayout({
  surface,
  children,
}: {
  surface: Surface;
  children: ReactNode;
}) {
  const tree = await getWorldTree();
  return (
    <>
      {surface === "write" ? (
        <Header bookScope={{ tree }} />
      ) : surface === "wiki" ? (
        <Header scope={{ tree }} />
      ) : (
        <Header scope={{ tree, basePath: `/${surface}` }} />
      )}
      {children}
    </>
  );
}
