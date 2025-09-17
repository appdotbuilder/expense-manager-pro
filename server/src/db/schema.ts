import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum, jsonb, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'user']);
export const expenseStatusEnum = pgEnum('expense_status', ['draft', 'pending', 'approved', 'rejected', 'paid']);
export const budgetPeriodEnum = pgEnum('budget_period', ['monthly', 'yearly']);
export const notificationTypeEnum = pgEnum('notification_type', ['budget_alert', 'approval_request', 'expense_approved', 'expense_rejected', 'system_update']);

// Users Table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  is_active: boolean('is_active').notNull().default(true),
  email_verified: boolean('email_verified').notNull().default(false),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Teams Table
export const teamsTable = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  manager_id: integer('manager_id').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Team Members Table
export const teamMembersTable = pgTable('team_members', {
  id: serial('id').primaryKey(),
  team_id: integer('team_id').notNull().references(() => teamsTable.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  joined_at: timestamp('joined_at').defaultNow().notNull()
});

// Categories Table
export const categoriesTable = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').notNull().default('#8B5CF6'),
  icon: text('icon'),
  parent_id: integer('parent_id').references((): any => categoriesTable.id),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Expenses Table
export const expensesTable = pgTable('expenses', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  category_id: integer('category_id').notNull().references(() => categoriesTable.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description').notNull(),
  expense_date: date('expense_date').notNull(),
  receipt_url: text('receipt_url'),
  tags: jsonb('tags').notNull().default('[]'),
  status: expenseStatusEnum('status').notNull().default('draft'),
  approved_by: integer('approved_by').references(() => usersTable.id),
  approved_at: timestamp('approved_at'),
  is_recurring: boolean('is_recurring').notNull().default(false),
  recurring_pattern: text('recurring_pattern'),
  team_id: integer('team_id').references(() => teamsTable.id),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Budgets Table
export const budgetsTable = pgTable('budgets', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  category_id: integer('category_id').references(() => categoriesTable.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  period: budgetPeriodEnum('period').notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  alert_threshold: numeric('alert_threshold', { precision: 5, scale: 2 }).notNull().default('80'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Notifications Table
export const notificationsTable = pgTable('notifications', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  is_read: boolean('is_read').notNull().default(false),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Password Reset Tokens Table
export const passwordResetTokensTable = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  token: text('token').notNull().unique(),
  expires_at: timestamp('expires_at').notNull(),
  used: boolean('used').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Email Verification Tokens Table
export const emailVerificationTokensTable = pgTable('email_verification_tokens', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  token: text('token').notNull().unique(),
  expires_at: timestamp('expires_at').notNull(),
  used: boolean('used').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many, one }) => ({
  expenses: many(expensesTable),
  budgets: many(budgetsTable),
  notifications: many(notificationsTable),
  managedTeams: many(teamsTable),
  teamMemberships: many(teamMembersTable),
  passwordResetTokens: many(passwordResetTokensTable),
  emailVerificationTokens: many(emailVerificationTokensTable),
  approvedExpenses: many(expensesTable, { relationName: 'approver' })
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

export const categoriesRelations = relations(categoriesTable, ({ one, many }) => ({
  parent: one(categoriesTable, {
    fields: [categoriesTable.parent_id],
    references: [categoriesTable.id],
    relationName: 'parentCategory'
  }),
  children: many(categoriesTable, { relationName: 'parentCategory' }),
  expenses: many(expensesTable),
  budgets: many(budgetsTable)
}));

export const expensesRelations = relations(expensesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [expensesTable.user_id],
    references: [usersTable.id]
  }),
  category: one(categoriesTable, {
    fields: [expensesTable.category_id],
    references: [categoriesTable.id]
  }),
  approver: one(usersTable, {
    fields: [expensesTable.approved_by],
    references: [usersTable.id],
    relationName: 'approver'
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
  category: one(categoriesTable, {
    fields: [budgetsTable.category_id],
    references: [categoriesTable.id]
  })
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [notificationsTable.user_id],
    references: [usersTable.id]
  })
}));

export const passwordResetTokensRelations = relations(passwordResetTokensTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [passwordResetTokensTable.user_id],
    references: [usersTable.id]
  })
}));

export const emailVerificationTokensRelations = relations(emailVerificationTokensTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [emailVerificationTokensTable.user_id],
    references: [usersTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Team = typeof teamsTable.$inferSelect;
export type NewTeam = typeof teamsTable.$inferInsert;

export type TeamMember = typeof teamMembersTable.$inferSelect;
export type NewTeamMember = typeof teamMembersTable.$inferInsert;

export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;

export type Expense = typeof expensesTable.$inferSelect;
export type NewExpense = typeof expensesTable.$inferInsert;

export type Budget = typeof budgetsTable.$inferSelect;
export type NewBudget = typeof budgetsTable.$inferInsert;

export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  teams: teamsTable,
  teamMembers: teamMembersTable,
  categories: categoriesTable,
  expenses: expensesTable,
  budgets: budgetsTable,
  notifications: notificationsTable,
  passwordResetTokens: passwordResetTokensTable,
  emailVerificationTokens: emailVerificationTokensTable
};