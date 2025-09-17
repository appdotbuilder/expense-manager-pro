import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import all schemas
import {
  createUserInputSchema,
  loginInputSchema,
  resetPasswordInputSchema,
  createExpenseInputSchema,
  updateExpenseInputSchema,
  approveExpenseInputSchema,
  searchExpensesInputSchema,
  createCategoryInputSchema,
  createBudgetInputSchema,
  createTeamInputSchema,
  createNotificationInputSchema,
  reportInputSchema,
  userRoleEnum
} from './schema';

// Import all handlers
import { registerUser, loginUser, resetPassword, verifyEmail, getCurrentUser } from './handlers/auth';
import { 
  createExpense, 
  getExpenses, 
  getExpenseById,
  updateExpense, 
  deleteExpense,
  approveExpense,
  searchExpenses,
  getRecurringExpenses,
  getPendingApprovals
} from './handlers/expenses';
import { 
  createCategory, 
  getCategories, 
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoriesWithStats,
  getTopCategories
} from './handlers/categories';
import {
  createBudget,
  getBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
  getBudgetUtilization,
  checkBudgetAlerts,
  getBudgetRecommendations
} from './handlers/budgets';
import {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  getTeamMembers,
  getTeamExpenses
} from './handlers/teams';
import {
  getExpenseAnalytics,
  generateReport,
  getSpendingPredictions,
  getSpendingPatterns,
  getComparisonAnalytics,
  exportExpenseData,
  importExpenseData
} from './handlers/analytics';
import {
  getDashboardData,
  getRealtimeStats,
  getChartData,
  getManagerDashboard,
  getAdminDashboard
} from './handlers/dashboard';
import {
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
  sendBudgetAlert,
  sendApprovalRequest,
  sendApprovalResult,
  sendSystemUpdate
} from './handlers/notifications';
import {
  getAllUsers,
  getUserById,
  updateUserProfile,
  updateUserRole,
  deactivateUser,
  reactivateUser,
  changePassword,
  getUserStats
} from './handlers/users';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

// Mock context for now - in real implementation, this would include authenticated user info
const mockContext = () => ({
  userId: 1,
  userRole: 'user' as const
});

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    register: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => registerUser(input)),
    
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => loginUser(input)),
    
    resetPassword: publicProcedure
      .input(resetPasswordInputSchema)
      .mutation(({ input }) => resetPassword(input)),
    
    verifyEmail: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(({ input }) => verifyEmail(input.token)),
    
    getCurrentUser: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getCurrentUser(ctx.userId);
      })
  }),

  // User management routes
  users: router({
    getAll: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getAllUsers(ctx.userId, ctx.userRole);
      }),
    
    getById: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getUserById(input.userId, ctx.userId, ctx.userRole);
      }),
    
    updateProfile: publicProcedure
      .input(z.object({
        userId: z.number(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        avatar_url: z.string().optional()
      }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        const { userId, ...updates } = input;
        return updateUserProfile(userId, updates, ctx.userId);
      }),
    
    updateRole: publicProcedure
      .input(z.object({ userId: z.number(), role: userRoleEnum }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return updateUserRole(input.userId, input.role, ctx.userId);
      }),
    
    deactivate: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return deactivateUser(input.userId, ctx.userId);
      }),
    
    reactivate: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return reactivateUser(input.userId, ctx.userId);
      }),
    
    changePassword: publicProcedure
      .input(z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8)
      }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return changePassword(ctx.userId, input.currentPassword, input.newPassword);
      }),
    
    getStats: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getUserStats(input.userId, ctx.userId);
      })
  }),

  // Expense management routes
  expenses: router({
    create: publicProcedure
      .input(createExpenseInputSchema)
      .mutation(({ input }) => {
        const ctx = mockContext();
        return createExpense(input, ctx.userId);
      }),
    
    getAll: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getExpenses(ctx.userId, ctx.userRole);
      }),
    
    getById: publicProcedure
      .input(z.object({ expenseId: z.number() }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getExpenseById(input.expenseId, ctx.userId, ctx.userRole);
      }),
    
    update: publicProcedure
      .input(updateExpenseInputSchema)
      .mutation(({ input }) => {
        const ctx = mockContext();
        return updateExpense(input, ctx.userId);
      }),
    
    delete: publicProcedure
      .input(z.object({ expenseId: z.number() }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return deleteExpense(input.expenseId, ctx.userId);
      }),
    
    approve: publicProcedure
      .input(approveExpenseInputSchema)
      .mutation(({ input }) => {
        const ctx = mockContext();
        return approveExpense(input, ctx.userId);
      }),
    
    search: publicProcedure
      .input(searchExpensesInputSchema)
      .query(({ input }) => {
        const ctx = mockContext();
        return searchExpenses(input, ctx.userId, ctx.userRole);
      }),
    
    getRecurring: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getRecurringExpenses(ctx.userId);
      }),
    
    getPendingApprovals: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getPendingApprovals(ctx.userId);
      })
  }),

  // Category management routes
  categories: router({
    create: publicProcedure
      .input(createCategoryInputSchema)
      .mutation(({ input }) => createCategory(input)),
    
    getAll: publicProcedure
      .query(() => getCategories()),
    
    getById: publicProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(({ input }) => getCategoryById(input.categoryId)),
    
    update: publicProcedure
      .input(z.object({
        categoryId: z.number(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        color: z.string().optional(),
        icon: z.string().nullable().optional(),
        parent_id: z.number().nullable().optional()
      }))
      .mutation(({ input }) => {
        const { categoryId, ...updates } = input;
        return updateCategory(categoryId, updates);
      }),
    
    delete: publicProcedure
      .input(z.object({ categoryId: z.number() }))
      .mutation(({ input }) => deleteCategory(input.categoryId)),
    
    getWithStats: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getCategoriesWithStats(ctx.userId);
      }),
    
    getTop: publicProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getTopCategories(ctx.userId, input.limit);
      })
  }),

  // Budget management routes
  budgets: router({
    create: publicProcedure
      .input(createBudgetInputSchema)
      .mutation(({ input }) => {
        const ctx = mockContext();
        return createBudget(input, ctx.userId);
      }),
    
    getAll: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getBudgets(ctx.userId);
      }),
    
    getById: publicProcedure
      .input(z.object({ budgetId: z.number() }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getBudgetById(input.budgetId, ctx.userId);
      }),
    
    update: publicProcedure
      .input(z.object({
        budgetId: z.number(),
        category_id: z.number().nullable().optional(),
        amount: z.number().positive().optional(),
        period: z.enum(['monthly', 'yearly']).optional(),
        start_date: z.coerce.date().optional(),
        end_date: z.coerce.date().optional(),
        alert_threshold: z.number().min(0).max(100).optional()
      }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        const { budgetId, ...updates } = input;
        return updateBudget(budgetId, updates, ctx.userId);
      }),
    
    delete: publicProcedure
      .input(z.object({ budgetId: z.number() }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return deleteBudget(input.budgetId, ctx.userId);
      }),
    
    getUtilization: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getBudgetUtilization(ctx.userId);
      }),
    
    getAlerts: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return checkBudgetAlerts(ctx.userId);
      }),
    
    getRecommendations: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getBudgetRecommendations(ctx.userId);
      })
  }),

  // Team management routes
  teams: router({
    create: publicProcedure
      .input(createTeamInputSchema)
      .mutation(({ input }) => createTeam(input)),
    
    getAll: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getTeams(ctx.userId, ctx.userRole);
      }),
    
    getById: publicProcedure
      .input(z.object({ teamId: z.number() }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getTeamById(input.teamId, ctx.userId);
      }),
    
    update: publicProcedure
      .input(z.object({
        teamId: z.number(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        manager_id: z.number().optional()
      }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        const { teamId, ...updates } = input;
        return updateTeam(teamId, updates, ctx.userId);
      }),
    
    delete: publicProcedure
      .input(z.object({ teamId: z.number() }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return deleteTeam(input.teamId, ctx.userId);
      }),
    
    addMember: publicProcedure
      .input(z.object({ teamId: z.number(), userId: z.number() }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return addTeamMember(input.teamId, input.userId, ctx.userId);
      }),
    
    removeMember: publicProcedure
      .input(z.object({ teamId: z.number(), userId: z.number() }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return removeTeamMember(input.teamId, input.userId, ctx.userId);
      }),
    
    getMembers: publicProcedure
      .input(z.object({ teamId: z.number() }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getTeamMembers(input.teamId, ctx.userId);
      }),
    
    getExpenses: publicProcedure
      .input(z.object({ teamId: z.number() }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getTeamExpenses(input.teamId, ctx.userId);
      })
  }),

  // Analytics and reporting routes
  analytics: router({
    getExpenseAnalytics: publicProcedure
      .input(z.object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date()
      }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getExpenseAnalytics(ctx.userId, ctx.userRole, input.startDate, input.endDate);
      }),
    
    generateReport: publicProcedure
      .input(reportInputSchema)
      .mutation(({ input }) => {
        const ctx = mockContext();
        return generateReport(input, ctx.userId, ctx.userRole);
      }),
    
    getSpendingPredictions: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getSpendingPredictions(ctx.userId);
      }),
    
    getSpendingPatterns: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getSpendingPatterns(ctx.userId);
      }),
    
    getComparisons: publicProcedure
      .input(z.object({
        period: z.enum(['previous_month', 'previous_year', 'same_month_last_year'])
      }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getComparisonAnalytics(ctx.userId, input.period);
      }),
    
    exportData: publicProcedure
      .input(z.object({
        format: z.enum(['csv', 'excel']),
        filters: z.any().optional()
      }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return exportExpenseData(ctx.userId, input.format, input.filters);
      }),
    
    importData: publicProcedure
      .input(z.object({
        fileUrl: z.string(),
        format: z.enum(['csv', 'excel', 'bank_statement'])
      }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return importExpenseData(ctx.userId, input.fileUrl, input.format);
      })
  }),

  // Dashboard routes
  dashboard: router({
    getData: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getDashboardData(ctx.userId, ctx.userRole);
      }),
    
    getRealtimeStats: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getRealtimeStats(ctx.userId);
      }),
    
    getChartData: publicProcedure
      .input(z.object({
        chartType: z.enum(['spending_trend', 'category_breakdown', 'budget_vs_actual']),
        period: z.enum(['week', 'month', 'year'])
      }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getChartData(ctx.userId, input.chartType, input.period);
      }),
    
    getManagerData: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getManagerDashboard(ctx.userId);
      }),
    
    getAdminData: publicProcedure
      .query(() => getAdminDashboard())
  }),

  // Notification routes
  notifications: router({
    create: publicProcedure
      .input(createNotificationInputSchema)
      .mutation(({ input }) => createNotification(input)),
    
    getAll: publicProcedure
      .input(z.object({ unreadOnly: z.boolean().default(false) }))
      .query(({ input }) => {
        const ctx = mockContext();
        return getNotifications(ctx.userId, input.unreadOnly);
      }),
    
    markAsRead: publicProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return markNotificationAsRead(input.notificationId, ctx.userId);
      }),
    
    markAllAsRead: publicProcedure
      .mutation(() => {
        const ctx = mockContext();
        return markAllNotificationsAsRead(ctx.userId);
      }),
    
    delete: publicProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(({ input }) => {
        const ctx = mockContext();
        return deleteNotification(input.notificationId, ctx.userId);
      }),
    
    getUnreadCount: publicProcedure
      .query(() => {
        const ctx = mockContext();
        return getUnreadCount(ctx.userId);
      })
  })
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`🚀 Monthly Expense Manager TRPC server listening at port: ${port}`);
  console.log(`📊 Dashboard API ready for purple-themed frontend!`);
}

start();