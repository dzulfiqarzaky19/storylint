import type { Shelf } from "@/domain/types";
import { KIND_FOR_SHELF } from "@/domain/types";

export function kindForNewEntry(shelf: Shelf, categoryId?: string): string {
  return categoryId ?? KIND_FOR_SHELF[shelf];
}
