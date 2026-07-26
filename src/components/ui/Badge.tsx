import type { HTMLAttributes } from 'react'
import { cx } from './cx'
import './ui.css'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'pending'

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
}

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx('ui-badge', tone !== 'neutral' && `ui-badge--${tone}`, className)}
      {...rest}
    />
  )
}
