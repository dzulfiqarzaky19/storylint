import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cx } from './cx'
import './ui.css'

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Icon-only control: the accessible name has no visible text to fall back on. */
  label: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cx('ui-icon-button', 'ui-focusable', className)}
      {...rest}
    />
  )
})
