import type { TextareaHTMLAttributes } from 'react'
import { cx } from './cx'
import './ui.css'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean
}

export function Textarea({ invalid = false, className, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cx(
        'ui-field',
        'ui-textarea',
        'ui-focusable',
        invalid && 'ui-field--invalid',
        className,
      )}
      {...rest}
    />
  )
}
