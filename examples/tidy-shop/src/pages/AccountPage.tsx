import { ProfileForm } from '@/components/account/ProfileForm'
import { session } from '@/state/session'

export const AccountPage = () => ProfileForm({ user: session.user })
