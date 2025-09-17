import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  pgEnum,
  varchar,
  date,
  json
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'user']);
export const expenseStatusEnum = pgEnum('expense_status', ['pending', 'approved', 'rejected']);
export const notificationTypeEnum = pgEnum('notification_type', ['budget_alert', 'approval_request', 'expense_reminder', 'system_update']);
export const recurringFrequencyEnum = pgEnum('recurring_frequency', ['daily', 'weekly', 'monthly', 'yearly']);
export const reportTypeEnum = pgEnum('report_type', ['monthly', 'yearly', 'custom']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: varchar('first_name', { length: 100 }).notNull(),
  last_name: varchar('last_name', { length: 100 }).notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  is_active: boolean('is_active').notNull().default(true),
  email_verified: boolean('email_verified').notNull().default(false),
  reset_token: text('reset_token'),
  reset_token_expires: timestamp('reset_token_expires'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow()
});

// Expense categories table
export const expenseCategoriesTable = pgTable('expense_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }).notNull(), // Hex color code
  icon: varchar('icon', { length: 50 }), // Icon name/class
  is_active: boolean('is_active').notNull().default(true),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow()
});

// Teams table
export const teamsTable = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  manager_id: integer('manager_id').notNull().references(() => usersTable.id),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow()
});

// Team members table
export const teamMembersTable = pgTable('team_members', {
  id: serial('id').primaryKey(),
  team_id: integer('team_id').notNull().references(() => teamsTable.id),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  joined_at: timestamp('joined_at').notNull().defaultNow(),
  is_active: boolean('is_active').notNull().default(true)
});

// Expenses table
export const expensesTable = pgTable('expenses', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  category_id: integer('category_id').notNull().references(() => expenseCategoriesTable.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description').notNull(),
  expense_date: date('expense_date').notNull(),
  receipt_url: text('receipt_url'),
  tags: text('tags'), // JSON string of tags array
  status: expenseStatusEnum('status').notNull().default('pending'),
  approved_by: integer('approved_by').references(() => usersTable.id),
  approved_at: timestamp('approved_at'),
  is_recurring: boolean('is_recurring').notNull().default(false),
  recurring_frequency: recurringFrequencyEnum('recurring_frequency'),
  next_occurrence: date('next_occurrence'),
  team_id: integer('team_id').references(() => teamsTable.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow()
});

// Budgets table
export const budgetsTable = pgTable('budgets', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  category_id: integer('category_id').notNull().references(() => expenseCategoriesTable.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  period_start: date('period_start').notNull(),
  period_end: date('period_end').notNull(),
  alert_threshold: integer('alert_threshold').notNull().default(80), // Percentage 0-100
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow()
});

// Notifications table
export const notificationsTable = pgTable('notifications', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  is_read: boolean('is_read').notNull().default(false),
  metadata: json('metadata'), // Additional data as JSON
  created_at: timestamp('created_at').notNull().defaultNow()
});

// Reports table
export const reportsTable = pgTable('reports', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  type: reportTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  filters: json('filters'), // Search filters used to generate report
  data: json('data'), // Generated report data
  generated_at: timestamp('generated_at').notNull().defaultNow(),
  expires_at: timestamp('expires_at') // Optional expiration for temporary reports
});

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  expenses: many(expensesTable),
  budgets: many(budgetsTable),
  notifications: many(notificationsTable),
  reports: many(reportsTable),
  createdCategories: many(expenseCategoriesTable),
  managedTeams: many(teamsTable),
  teamMemberships: many(teamMembersTable),
  approvedExpenses: many(expensesTable)
}));

export const expenseCategoriesRelations = relations(expenseCategoriesTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [expenseCategoriesTable.created_by],
    references: [usersTable.id]
  }),
  expenses: many(expensesTable),
  budgets: many(budgetsTable)
}));

export const teamsRelations = relations(teamsTable, ({ one, many }) => ({
  manager: one(usersTable, {
    fields: [teamsTable.manager_id],
    references: [usersTable.id]
  }),
  members: many(teamMembersTable),
  expenses: many(expensesTable)
}));

export const teamMembersRelations = relations(teamMembersTable, ({ one }) => ({
  team: one(teamsTable, {
    fields: [teamMembersTable.team_id],
    references: [teamsTable.id]
  }),
  user: one(usersTable, {
    fields: [teamMembersTable.user_id],
    references: [usersTable.id]
  })
}));

export const expensesRelations = relations(expensesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [expensesTable.user_id],
    references: [usersTable.id]
  }),
  category: one(expenseCategoriesTable, {
    fields: [expensesTable.category_id],
    references: [expenseCategoriesTable.id]
  }),
  approver: one(usersTable, {
    fields: [expensesTable.approved_by],
    references: [usersTable.id]
  }),
  team: one(teamsTable, {
    fields: [expensesTable.team_id],
    references: [teamsTable.id]
  })
}));

export const budgetsRelations = relations(budgetsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [budgetsTable.user_id],
    references: [usersTable.id]
  }),
  category: one(expenseCategoriesTable, {
    fields: [budgetsTable.category_id],
    references: [expenseCategoriesTable.id]
  })
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [notificationsTable.user_id],
    references: [usersTable.id]
  })
}));

export const reportsRelations = relations(reportsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [reportsTable.user_id],
    references: [usersTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type ExpenseCategory = typeof expenseCategoriesTable.$inferSelect;
export type NewExpenseCategory = typeof expenseCategoriesTable.$inferInsert;

export type Team = typeof teamsTable.$inferSelect;
export type NewTeam = typeof teamsTable.$inferInsert;

export type TeamMember = typeof teamMembersTable.$inferSelect;
export type NewTeamMember = typeof teamMembersTable.$inferInsert;

export type Expense = typeof expensesTable.$inferSelect;
export type NewExpense = typeof expensesTable.$inferInsert;

export type Budget = typeof budgetsTable.$inferSelect;
export type NewBudget = typeof budgetsTable.$inferInsert;

export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;

export type Report = typeof reportsTable.$inferSelect;
export type NewReport = typeof reportsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  expenseCategories: expenseCategoriesTable,
  teams: teamsTable,
  teamMembers: teamMembersTable,
  expenses: expensesTable,
  budgets: budgetsTable,
  notifications: notificationsTable,
  reports: reportsTable
};