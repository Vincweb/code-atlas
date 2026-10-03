import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format/dates'

export const ProfileForm = ({ user }: { user: { name: string; since: Date } }) => [
  user.name,
  formatDate(user.since),
  Button({ label: 'Save', onClick: () => undefined }),
]
