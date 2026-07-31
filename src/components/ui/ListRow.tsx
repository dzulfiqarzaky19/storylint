import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cx } from './cx'
import './ui.css'

export type ListRowProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  meta?: string
}

export const ListRow = forwardRef<HTMLButtonElement, ListRowProps>(function ListRow(
  { active = false, meta, className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-current={active ? 'true' : undefined}
      className={cx('ui-list-row', active && 'ui-list-row--active', 'ui-focusable', className)}
      {...rest}
    >
      <span className="ui-list-row__label">{children}</span>
      {meta ? <span className="ui-list-row__meta">{meta}</span> : null}
    </button>
  )
})
