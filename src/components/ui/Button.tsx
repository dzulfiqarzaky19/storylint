import type { ButtonHTMLAttributes } from 'react'
import { cx } from './cx'
import './ui.css'

export type ButtonVariant = 'primary' | 'ghost' | 'danger'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

export function Button({ variant = 'ghost', className, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cx('ui-button', `ui-button--${variant}`, 'ui-focusable', className)}
      {...rest}
    />
  )
}
