import { foreignKey, integer, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core'
import { customers } from './customers'
import { projects } from './projects'

export const customersProjects = pgTable(
  'customers_projects',
  {
    customerId: integer('customer_id').notNull(),
    projectId: integer('project_id').notNull(),
    role: varchar({ length: 20 }),
  },
  (table) => [
    primaryKey({ columns: [table.customerId, table.projectId] }),
    foreignKey({ columns: [table.customerId], foreignColumns: [customers.id] }),
    foreignKey({ columns: [table.projectId], foreignColumns: [projects.id] }),
  ],
)
