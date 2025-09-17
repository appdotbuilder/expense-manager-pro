import { z } from 'zod';

// Enum definitions
export const userRoleEnum = z.enum(['admin', 'manager', 'user']);
export const expenseStatusEnum = z.enum(['pending', 'approved', 'rejected']);
export const notificationTypeEnum = z.enum(['budget_alert', 'approval_request', 'expense_reminder', 'system_update']);
export const recurringFrequencyEnum = z.enum(['daily', 'weekly', 'monthly', 'yearly']);
export const reportTypeEnum = z.enum(['monthly', 'yearly', 'custom']);
export const exportFormatEnum = z.enum(['pdf', 'excel', 'csv']);

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleEnum,
  is_active: z.boolean(),
  email_verified: z.boolean(),
  reset_token: z.string().nullable(),
  reset_token_expires: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// User input schemas
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

export const updateUserInputSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: userRoleEnum.optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Expense category schema
export const expenseCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  icon: z.string().nullable(),
  is_active: z.boolean(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;

export const createExpenseCategoryInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  icon: z.string().nullable(),
  created_by: z.number()
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategoryInputSchema>;

// Expense schema
export const expenseSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  category_id: z.number(),
  amount: z.number(),
  description: z.string(),
  expense_date: z.coerce.date(),
  receipt_url: z.string().nullable(),
  tags: z.string().nullable(),
  status: expenseStatusEnum,
  approved_by: z.number().nullable(),
  approved_at: z.coerce.date().nullable(),
  is_recurring: z.boolean(),
  recurring_frequency: recurringFrequencyEnum.nullable(),
  next_occurrence: z.coerce.date().nullable(),
  team_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Expense = z.infer<typeof expenseSchema>;

export const createExpenseInputSchema = z.object({
  user_id: z.number(),
  category_id: z.number(),
  amount: z.number().positive(),
  description: z.string().min(1),
  expense_date: z.coerce.date(),
  receipt_url: z.string().url().nullable(),
  tags: z.string().nullable(),
  is_recurring: z.boolean().default(false),
  recurring_frequency: recurringFrequencyEnum.nullable(),
  team_id: z.number().nullable()
});

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;

export const updateExpenseInputSchema = z.object({
  id: z.number(),
  category_id: z.number().optional(),
  amount: z.number().positive().optional(),
  description: z.string().optional(),
  expense_date: z.coerce.date().optional(),
  receipt_url: z.string().url().nullable().optional(),
  tags: z.string().nullable().optional(),
  status: expenseStatusEnum.optional(),
  approved_by: z.number().nullable().optional()
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>;

// Budget schema
export const budgetSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  category_id: z.number(),
  amount: z.number(),
  period_start: z.coerce.date(),
  period_end: z.coerce.date(),
  alert_threshold: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Budget = z.infer<typeof budgetSchema>;

export const createBudgetInputSchema = z.object({
  user_id: z.number(),
  category_id: z.number(),
  amount: z.number().positive(),
  period_start: z.coerce.date(),
  period_end: z.coerce.date(),
  alert_threshold: z.number().min(0).max(100).default(80)
});

export type CreateBudgetInput = z.infer<typeof createBudgetInputSchema>;

// Team schema
export const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  manager_id: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Team = z.infer<typeof teamSchema>;

export const createTeamInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  manager_id: z.number()
});

export type CreateTeamInput = z.infer<typeof createTeamInputSchema>;

// Team member schema
export const teamMemberSchema = z.object({
  id: z.number(),
  team_id: z.number(),
  user_id: z.number(),
  joined_at: z.coerce.date(),
  is_active: z.boolean()
});

export type TeamMember = z.infer<typeof teamMemberSchema>;

export const addTeamMemberInputSchema = z.object({
  team_id: z.number(),
  user_id: z.number()
});

export type AddTeamMemberInput = z.infer<typeof addTeamMemberInputSchema>;

// Notification schema
export const notificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: notificationTypeEnum,
  title: z.string(),
  message: z.string(),
  is_read: z.boolean(),
  metadata: z.string().nullable(),
  created_at: z.coerce.date()
});

export type Notification = z.infer<typeof notificationSchema>;

export const createNotificationInputSchema = z.object({
  user_id: z.number(),
  type: notificationTypeEnum,
  title: z.string().min(1),
  message: z.string().min(1),
  metadata: z.string().nullable()
});

export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;

// Report schema
export const reportSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: reportTypeEnum,
  title: z.string(),
  filters: z.string().nullable(),
  data: z.string().nullable(),
  generated_at: z.coerce.date(),
  expires_at: z.coerce.date().nullable()
});

export type Report = z.infer<typeof reportSchema>;

export const generateReportInputSchema = z.object({
  user_id: z.number(),
  type: reportTypeEnum,
  title: z.string().min(1),
  date_from: z.coerce.date(),
  date_to: z.coerce.date(),
  category_ids: z.array(z.number()).optional(),
  team_id: z.number().nullable(),
  export_format: exportFormatEnum.default('pdf')
});

export type GenerateReportInput = z.infer<typeof generateReportInputSchema>;

// Search and filter schemas
export const expenseSearchInputSchema = z.object({
  user_id: z.number(),
  query: z.string().optional(),
  category_ids: z.array(z.number()).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  min_amount: z.number().optional(),
  max_amount: z.number().optional(),
  status: expenseStatusEnum.optional(),
  tags: z.array(z.string()).optional(),
  team_id: z.number().nullable(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});

export type ExpenseSearchInput = z.infer<typeof expenseSearchInputSchema>;

// Analytics schemas
export const dashboardStatsSchema = z.object({
  total_expenses: z.number(),
  monthly_total: z.number(),
  budget_utilization: z.number(),
  pending_approvals: z.number(),
  category_breakdown: z.array(z.object({
    category_id: z.number(),
    category_name: z.string(),
    amount: z.number(),
    percentage: z.number()
  })),
  spending_trend: z.array(z.object({
    date: z.string(),
    amount: z.number()
  }))
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export const getDashboardStatsInputSchema = z.object({
  user_id: z.number(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  team_id: z.number().nullable()
});

export type GetDashboardStatsInput = z.infer<typeof getDashboardStatsInputSchema>;