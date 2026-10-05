import { add } from '@ws/math'
import { view } from '@/views/home'

export const run = () => view(add(1, 2))
