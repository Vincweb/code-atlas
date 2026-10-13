import { foreignKey, index, integer, pgTable, serial, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../helpers'
import { users } from './users'

export const customers = pgTable('customers', {
  id: serial().primaryKey(),
  name: text().notNull(),
  ownerId: integer('owner_id').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
})

export const customerNotes = pgTable(
  'customer_notes',
  {
    id: serial().primaryKey(),
    customerId: integer('customer_id').notNull(),
    body: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'customer_notes_customer_id_fk',
    }).onDelete('cascade'),
    index('customer_notes_customer_idx').on(table.customerId),
  ],
)
