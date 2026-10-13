import { integer, pgEnum, pgTable, serial, varchar } from 'drizzle-orm/pg-core'
import { timestamps } from '../helpers'
import { customers } from './customers'

export const roleEnum = pgEnum('role', ['admin', 'member'])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: roleEnum('role').notNull(),
  defaultCustomerId: integer('default_customer_id').references(() => customers.id),
  ...timestamps,
})
