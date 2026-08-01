/**
 * GATE A — explicit named legacy allowlist for pre-stamp proof artifacts.
 *
 * Do NOT expand with globs or directory wildcards. Every entry is a full
 * repo-relative path that was already on disk before the provenance stamp
 * existed. New files under e2e/proofs MUST carry a proof-provenance block
 * (see e2e/proof-provenance.mjs). Fabricating head SHAs for old proofs is
 * forbidden — leave them here until re-run under the stamp helper.
 *
 * To remove an entry: re-run the producer with writeProofArtifact (or an
 * equivalent stamp), commit the stamped artifact, delete the path here.
 */
export const LEGACY_UNSTAMPED_PROOFS = Object.freeze([
  'e2e/proofs/E1-step-stall-proof.txt',
  'e2e/proofs/T-002-l2-composition-mutation.txt',
  'e2e/proofs/T-002-l2-reverse-draft-clobber-mutation.txt',
  'e2e/proofs/T-003-arrival-paths.txt',
  'e2e/proofs/T-003-scroll-restore-mutation.txt',
  'e2e/proofs/T-004-durable-dirty.txt',
  'e2e/proofs/T-004-l1-stability-summary.json',
  'e2e/proofs/T-004-l1-stability.jsonl',
  'e2e/proofs/buffalo-land-opaque-on-green.output',
  'e2e/proofs/land-gate-not-measured.md',
  'e2e/proofs/land-gate/buffalo-calm-incomplete.output',
  'e2e/proofs/land-gate/silent-calm-death-report.txt',
  'e2e/proofs/save-chip-blank-on-error-measure.md',
  'e2e/proofs/slice-i-flake/FAILURE_MODES.txt',
  'e2e/proofs/slice-i-flake/README.md',
  'e2e/proofs/slice-i-flake/land-3d213b1-full.output',
  'e2e/proofs/slice-i-flake/land-ac4017a-reland-success.output',
  'e2e/proofs/slice-i-flake/land-ac4017a-slice-i-candidate-fail.output',
  'e2e/proofs/slice-i-flake/land-c7ffde8-slice-f-candidate-fail.output',
  'e2e/proofs/slice-i-flake/reland-ac4017a-baseline-green.log',
  'e2e/proofs/slice-i-flake/reland-ac4017a-candidate-green.log',
  'e2e/proofs/t005-eperm-path-lock/AFTER.json',
  'e2e/proofs/t005-eperm-path-lock/BEFORE.json',
  'e2e/proofs/t005-eperm-path-lock/MUTATION-load-unlocked.json',
  'e2e/proofs/t005-eperm-path-lock/README.md',
  'e2e/proofs/t009-rule11a-no-check/flag-safety.json',
  'e2e/proofs/t009-rule11a-no-check/mutation-proof.json',
]);
