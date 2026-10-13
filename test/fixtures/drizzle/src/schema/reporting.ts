import { sql } from 'drizzle-orm'
import { integer, json, pgMaterializedView, serial, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { audit } from './app'
import { customers } from './customers'
import { users } from './users'

export const auditEvents = audit.table(
  'events',
  {
    id: serial().primaryKey(),
    userId: integer('user_id').references(() => users.id),
    customerId: integer('customer_id').references(() => customers.id),
    payload: json(),
  },
  (t) => {
    return [uniqueIndex('events_user_idx').on(t.userId.asc(), t.id)]
  },
)

export const activeUsers = pgMaterializedView('active_users', {
  id: integer('id'),
  email: text('email'),
}).as(sql`select 1`)
