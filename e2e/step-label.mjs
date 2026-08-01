/**
 * Sync step labels for e2e smokes.
 *
 * Write must be sync so a stall after this line still leaves the label on the
 * pipe before Playwright's bare timeout kills the process (E1 stall-proof).
 * slice-k / slice-l and prove-step-stall must share this helper — a copy is
 * not a proof of the shipped path.
 *
 * Runtime call-site lock: every real invoke appends to step.calls. Smokes
 * assert expected phases ∈ step.calls at PASS. Source-text greps are tripwires
 * only (LG-B3: they match comments / dead branches).
 */
export function makeStep(prefix) {
  const t0 = Date.now()
  const calls = []
  function step(label) {
    const name = String(label ?? '')
    calls.push(name)
    process.stdout.write(`[${prefix} +${Date.now() - t0}ms] ${name}\n`)
  }
  step.calls = calls
  step.prefix = prefix
  return step
}

/**
 * Runtime assert: every expected phase was actually invoked on this step fn.
 * Missing entries fail hard — do not loosen. If a phase is legitimately
 * renamed/removed, update e2e/step-phases.mjs with the same justification
 * as removing the phase from the smoke (never delete a list entry just to
 * make this pass).
 */
export function assertStepPhases(step, expected, smokeName = 'smoke') {
  const calls = Array.isArray(step?.calls) ? step.calls : []
  const missing = expected.filter((p) => !calls.includes(p))
  if (missing.length) {
    throw new Error(
      `${smokeName}: step() never called for phase(s): ${missing.join(', ')} ` +
        `(observed calls: ${calls.length ? calls.join(' | ') : '(none)'}). ` +
        `If a phase was intentionally removed, update e2e/step-phases.mjs — ` +
        `do not weaken this assert.`,
    )
  }
}
