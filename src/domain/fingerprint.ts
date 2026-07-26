import type { Claim } from './types.ts'

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replaceAll(/\s+/g, ' ')
}

/** Stable FNV-1a fingerprint; no runtime-specific crypto dependency, so domain stays pure. */
export function claimFingerprint(claim: Claim): string {
  const canonical = [
    claim.sheetKind,
    normalize(claim.entityName),
    normalize(claim.key),
    normalize(claim.value),
    claim.claimKind,
  ].join('')

  let hash = 0x811c9dc5
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `claim-${(hash >>> 0).toString(16).padStart(8, '0')}`
}
