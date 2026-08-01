/**
 * Sync step labels for e2e smokes.
 *
 * Write must be sync so a stall after this line still leaves the label on the
 * pipe before Playwright's bare timeout kills the process (E1 stall-proof).
 * slice-k / slice-l and prove-step-stall must share this helper — a copy is
 * not a proof of the shipped path.
 */
export function makeStep(prefix) {
  const t0 = Date.now()
  return function step(label) {
    process.stdout.write(`[${prefix} +${Date.now() - t0}ms] ${label}\n`)
  }
}
