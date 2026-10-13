import { integer, pgTable, serial, text } from 'drizzle-orm/pg-core'
import { customers } from './customers'
import { users } from './users'

export const projects = pgTable('projects', {
  id: serial().primaryKey(),
  title: text().notNull(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  createdBy: integer('created_by').references(() => users.id),
})

export const projectTags = pgTable('project_tags', {
  id: serial().primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  tag: text().notNull(),
})
