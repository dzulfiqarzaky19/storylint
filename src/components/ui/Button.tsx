import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cx } from './cx'
import './ui.css'

export type ButtonVariant = 'primary' | 'ghost' | 'danger'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', className, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cx('ui-button', `ui-button--${variant}`, 'ui-focusable', className)}
      {...rest}
    />
  )
})
