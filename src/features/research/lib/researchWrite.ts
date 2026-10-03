import type { ResearchAction } from "@/features/research/state/researchStore";
import type { PickerOrigin, PickerResult } from "@/domain/wiki/pickedTarget";

export type ResearchIntent =
  | { type: "card.keep"; propositionId: string; kept: boolean }
  | { type: "card.propose"; propositionId: string }
  | { type: "card.cancel" }
  | { type: "card.confirm"; propositionId: string; result: PickerResult };

export type ResearchPersist =
  | { kind: "keep"; propositionId: string; kept: boolean }
  | { kind: "propose"; propositionId: string }
  | { kind: "cancel" }
  | {
      kind: "confirm";
      result: PickerResult;
      origin: Extract<PickerOrigin, { from: "card" }>;
      worldId: string;
      confirmed: true;
    };

export interface ResearchWritePlan {
  action: ResearchAction;
  persist: ResearchPersist;
}

export function planResearchWrite(
  intent: ResearchIntent,
  worldId: string,
): ResearchWritePlan {
  switch (intent.type) {
    case "card.keep":
      return {
        action: {
          type: "KEEP_CARD",
          propositionId: intent.propositionId,
          kept: intent.kept,
        },
        persist: {
          kind: "keep",
          propositionId: intent.propositionId,
          kept: intent.kept,
        },
      };
    case "card.propose":
      return {
        action: { type: "PROPOSE_CARD", propositionId: intent.propositionId },
        persist: { kind: "propose", propositionId: intent.propositionId },
      };
    case "card.cancel":
      return {
        action: { type: "CANCEL_PENDING" },
        persist: { kind: "cancel" },
      };
    case "card.confirm":
      return {
        action: { type: "CONFIRM_CARD", propositionId: intent.propositionId },
        persist: {
          kind: "confirm",
          result: intent.result,
          origin: { from: "card", propositionId: intent.propositionId },
          worldId,
          confirmed: true,
        },
      };
  }
}
