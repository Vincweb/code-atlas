import { App } from '@/routes/App'
import { track } from '@/lib/analytics/track'

track('boot', {})
export const root = App
