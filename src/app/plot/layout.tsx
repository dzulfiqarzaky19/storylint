import type { ReactNode } from "react";
import SurfaceLayout from "@/app/SurfaceLayout";

export const dynamic = "force-dynamic";

export default function PlotLayout({ children }: { children: ReactNode }) {
  return <SurfaceLayout surface="plot">{children}</SurfaceLayout>;
}
