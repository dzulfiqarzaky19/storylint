export type ApplyTarget = {
  mode: 'insert' | 'replace'
  start: number
  end: number
}

export function applyManuscriptText(body: string, target: ApplyTarget, text: string): string {
  const valid = Number.isInteger(target.start) && Number.isInteger(target.end) &&
    target.start >= 0 && target.end >= target.start && target.end <= body.length && text.length > 0 &&
    (target.mode === 'insert' ? target.start === target.end : target.start < target.end)
  if (!valid) throw new Error('Invalid manuscript range')
  return body.slice(0, target.start) + text + body.slice(target.end)
}
