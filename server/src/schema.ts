import { z } from 'zod';

// User Management Schemas
export const userRoleEnum = z.enum(['admin', 'manager', 'user']);
export type UserRole = z.infer<typeof userRoleEnum>;

export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleEnum,
  is_active: z.boolean(),
  email_verified: z.boolean(),
  avatar_url: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: userRoleEnum.default('user')
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const resetPasswordInputSchema = z.object({
  email: z.string().email()
});

export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

// Team Management Schemas
export const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  manager_id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Team = z.infer<typeof teamSchema>;

export const createTeamInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  manager_id: z.number()
});

export type CreateTeamInput = z.infer<typeof createTeamInputSchema>;

export const teamMemberSchema = z.object({
  id: z.number(),
  team_id: z.number(),
  user_id: z.number(),
  joined_at: z.coerce.date()
});

export type TeamMember = z.infer<typeof teamMemberSchema>;

// Category Schemas
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  icon: z.string().nullable(),
  parent_id: z.number().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

export const createCategoryInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  color: z.string().default('#8B5CF6'),
  icon: z.string().nullable().optional(),
  parent_id: z.number().nullable().optional()
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

// Expense Schemas
export const expenseStatusEnum = z.enum(['draft', 'pending', 'approved', 'rejected', 'paid']);
export type ExpenseStatus = z.infer<typeof expenseStatusEnum>;

export const expenseSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  category_id: z.number(),
  amount: z.number(),
  description: z.string(),
  expense_date: z.coerce.date(),
  receipt_url: z.string().nullable(),
  tags: z.array(z.string()),
  status: expenseStatusEnum,
  approved_by: z.number().nullable(),
  approved_at: z.coerce.date().nullable(),
  is_recurring: z.boolean(),
  recurring_pattern: z.string().nullable(),
  team_id: z.number().nullable(),
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Expense = z.infer<typeof expenseSchema>;

export const createExpenseInputSchema = z.object({
  category_id: z.number(),
  amount: z.number().positive(),
  description: z.string().min(1),
  expense_date: z.coerce.date(),
  receipt_url: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  is_recurring: z.boolean().default(false),
  recurring_pattern: z.string().nullable().optional(),
  team_id: z.number().nullable().optional(),
  notes: z.string().nullable().optional()
});

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;

export const updateExpenseInputSchema = z.object({
  id: z.number(),
  category_id: z.number().optional(),
  amount: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  expense_date: z.coerce.date().optional(),
  receipt_url: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullable().optional()
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>;

export const approveExpenseInputSchema = z.object({
  expense_id: z.number(),
  status: z.enum(['approved', 'rejected']),
  notes: z.string().nullable().optional()
});

export type ApproveExpenseInput = z.infer<typeof approveExpenseInputSchema>;

// Budget Schemas
export const budgetSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  category_id: z.number().nullable(),
  amount: z.number(),
  period: z.enum(['monthly', 'yearly']),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  alert_threshold: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Budget = z.infer<typeof budgetSchema>;

export const createBudgetInputSchema = z.object({
  category_id: z.number().nullable().optional(),
  amount: z.number().positive(),
  period: z.enum(['monthly', 'yearly']),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  alert_threshold: z.number().min(0).max(100).default(80)
});

export type CreateBudgetInput = z.infer<typeof createBudgetInputSchema>;

// Analytics & Reports Schemas
export const expenseAnalyticsSchema = z.object({
  total_amount: z.number(),
  expense_count: z.number(),
  avg_expense: z.number(),
  category_breakdown: z.array(z.object({
    category_name: z.string(),
    amount: z.number(),
    percentage: z.number()
  })),
  monthly_trend: z.array(z.object({
    month: z.string(),
    amount: z.number()
  })),
  budget_vs_actual: z.object({
    budget_amount: z.number(),
    actual_amount: z.number(),
    variance: z.number(),
    variance_percentage: z.number()
  })
});

export type ExpenseAnalytics = z.infer<typeof expenseAnalyticsSchema>;

export const reportInputSchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  category_ids: z.array(z.number()).optional(),
  team_id: z.number().nullable().optional(),
  format: z.enum(['pdf', 'excel', 'csv']).default('pdf')
});

export type ReportInput = z.infer<typeof reportInputSchema>;

// Search & Filter Schemas
export const searchExpensesInputSchema = z.object({
  query: z.string().optional(),
  category_ids: z.array(z.number()).optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  min_amount: z.number().optional(),
  max_amount: z.number().optional(),
  tags: z.array(z.string()).optional(),
  status: expenseStatusEnum.optional(),
  team_id: z.number().nullable().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sort_by: z.enum(['date', 'amount', 'category', 'created_at']).default('date'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type SearchExpensesInput = z.infer<typeof searchExpensesInputSchema>;

// Notification Schemas
export const notificationTypeEnum = z.enum(['budget_alert', 'approval_request', 'expense_approved', 'expense_rejected', 'system_update']);
export type NotificationType = z.infer<typeof notificationTypeEnum>;

export const notificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: notificationTypeEnum,
  title: z.string(),
  message: z.string(),
  is_read: z.boolean(),
  metadata: z.record(z.any()).nullable(),
  created_at: z.coerce.date()
});

export type Notification = z.infer<typeof notificationSchema>;

export const createNotificationInputSchema = z.object({
  user_id: z.number(),
  type: notificationTypeEnum,
  title: z.string(),
  message: z.string(),
  metadata: z.record(z.any()).nullable().optional()
});

export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;

// Dashboard Schemas
export const dashboardDataSchema = z.object({
  total_expenses: z.number(),
  monthly_expenses: z.number(),
  budget_utilization: z.number(),
  pending_approvals: z.number(),
  recent_expenses: z.array(expenseSchema),
  category_spending: z.array(z.object({
    category_name: z.string(),
    amount: z.number(),
    budget_amount: z.number().nullable(),
    color: z.string()
  })),
  monthly_trend: z.array(z.object({
    month: z.string(),
    amount: z.number()
  })),
  top_categories: z.array(z.object({
    category_name: z.string(),
    amount: z.number(),
    transaction_count: z.number()
  }))
});

export type DashboardData = z.infer<typeof dashboardDataSchema>;