import type { InputHTMLAttributes } from 'react'
import { cx } from './cx'
import './ui.css'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
}

export function Input({ invalid = false, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cx(
        'ui-field',
        'ui-input',
        'ui-focusable',
        invalid && 'ui-field--invalid',
        className,
      )}
      {...rest}
    />
  )
}
