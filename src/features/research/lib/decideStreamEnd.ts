export const STREAM_INCOMPLETE_MESSAGE = "The answer didn't finish streaming. Please try again.";

export interface StreamEndInput {
  reconciled: boolean;
  sawError: boolean;
  question: string;
}

export interface StreamEndDecision {
  setError?: string;
  restoreDraft?: string;
}

export function decideStreamEnd(input: StreamEndInput): StreamEndDecision {
  if (input.reconciled || input.sawError) return {};
  return { setError: STREAM_INCOMPLETE_MESSAGE, restoreDraft: input.question };
}
