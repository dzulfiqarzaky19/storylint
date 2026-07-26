import './tokens.css'

export type Theme = 'dark' | 'light'

/** Dark is the :root default; light is the [data-theme="light"] override in tokens.css. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'dark') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}
