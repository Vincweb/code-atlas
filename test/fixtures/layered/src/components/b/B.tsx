import { label } from '@/components/a/A'
import type { Row } from '@/lib/db'

export const B = (props: { row?: Row }) => (
  <i>
    {label}
    {props.row?.id}
  </i>
)
