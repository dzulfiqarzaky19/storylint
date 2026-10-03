import type { Mark } from "@/domain/check";

export interface PickerResult {
  categoryId: string;
  proposeCategoryName?: string;
  entryId?: string;
  entryName: string;
  factKey: string;
  factValue: string;
}

export type PickerOrigin =
  | { from: "mark"; mark: Mark }
  | { from: "card"; propositionId: string };
