export const LEGACY_THEM_LABEL = "Research";
export const COLLABORATOR_LABEL = "Collaborator";

export function voiceLabel(who: string): string {
  return who === LEGACY_THEM_LABEL ? COLLABORATOR_LABEL : who;
}
