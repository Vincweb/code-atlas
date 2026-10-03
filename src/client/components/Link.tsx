import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navigate } from '../router'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }

export const Link = ({ to, onClick, ...rest }: Props) => {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
  return <a {...rest} href={to} onClick={handle} />
}
