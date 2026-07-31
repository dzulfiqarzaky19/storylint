import './tokens.css'

export type Theme = 'dark' | 'light'

/** Manuscript paper profile (Kobo-style). Independent of chrome theme. */
export type ReadingProfile = 'day' | 'sepia' | 'mint' | 'night'

export const READING_PROFILES: readonly ReadingProfile[] = ['day', 'sepia', 'mint', 'night'] as const

const READING_LABELS: Record<ReadingProfile, string> = {
  day: 'Daytime Clear',
  sepia: 'Cozy Sepia',
  mint: 'Twilight Mint',
  night: 'Night Obsidian',
}

export function readingLabel(profile: ReadingProfile): string {
  return READING_LABELS[profile]
}

<<<<<<< HEAD
/** Dark is :root default; light is [data-theme="light"]. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'dark') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
=======
/** Dark is default chrome; always set data-theme so tests/CSS share one switch. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-theme', theme)
>>>>>>> storylint/lab-slice
}

export function applyReading(
  profile: ReadingProfile,
  root: HTMLElement = document.documentElement,
): void {
  root.setAttribute('data-reading', profile)
}

export function nextReading(profile: ReadingProfile): ReadingProfile {
  const i = READING_PROFILES.indexOf(profile)
  return READING_PROFILES[(i + 1) % READING_PROFILES.length] ?? 'day'
}
