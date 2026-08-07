import type { ReactNode } from 'react'

export function DsPreviewRoot({ children }: { children?: ReactNode }) {
  return (
    <div
      data-theme="dark"
      style={{
        background: 'var(--color-canvas)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-body)',
        lineHeight: 'var(--leading-body)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {children}
    </div>
  )
}
