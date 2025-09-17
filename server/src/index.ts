import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  loginInputSchema,
  updateUserInputSchema,
  createExpenseCategoryInputSchema,
  createExpenseInputSchema,
  updateExpenseInputSchema,
  expenseSearchInputSchema,
  createBudgetInputSchema,
  createTeamInputSchema,
  addTeamMemberInputSchema,
  getDashboardStatsInputSchema,
  generateReportInputSchema,
  createNotificationInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { loginUser } from './handlers/login_user';
import { getUsers } from './handlers/get_users';
import { updateUser } from './handlers/update_user';
import { createExpenseCategory } from './handlers/create_expense_category';
import { getExpenseCategories } from './handlers/get_expense_categories';
import { createExpense } from './handlers/create_expense';
import { getExpenses } from './handlers/get_expenses';
import { updateExpense } from './handlers/update_expense';
import { createBudget } from './handlers/create_budget';
import { getBudgets } from './handlers/get_budgets';
import { createTeam } from './handlers/create_team';
import { addTeamMember } from './handlers/add_team_member';
import { getTeams } from './handlers/get_teams';
import { getDashboardStats } from './handlers/get_dashboard_stats';
import { generateReport } from './handlers/generate_report';
import { getNotifications } from './handlers/get_notifications';
import { createNotification } from './handlers/create_notification';
import { markNotificationRead } from './handlers/mark_notification_read';
import { approveExpense } from './handlers/approve_expense';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  loginUser: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => loginUser(input)),

  getUsers: publicProcedure
    .query(() => getUsers()),

  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  // Expense category routes
  createExpenseCategory: publicProcedure
    .input(createExpenseCategoryInputSchema)
    .mutation(({ input }) => createExpenseCategory(input)),

  getExpenseCategories: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getExpenseCategories(input.userId)),

  // Expense routes
  createExpense: publicProcedure
    .input(createExpenseInputSchema)
    .mutation(({ input }) => createExpense(input)),

  getExpenses: publicProcedure
    .input(expenseSearchInputSchema)
    .query(({ input }) => getExpenses(input)),

  updateExpense: publicProcedure
    .input(updateExpenseInputSchema)
    .mutation(({ input }) => updateExpense(input)),

  approveExpense: publicProcedure
    .input(z.object({ 
      expenseId: z.number(), 
      approverId: z.number(), 
      approved: z.boolean() 
    }))
    .mutation(({ input }) => approveExpense(input.expenseId, input.approverId, input.approved)),

  // Budget routes
  createBudget: publicProcedure
    .input(createBudgetInputSchema)
    .mutation(({ input }) => createBudget(input)),

  getBudgets: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getBudgets(input.userId)),

  // Team routes
  createTeam: publicProcedure
    .input(createTeamInputSchema)
    .mutation(({ input }) => createTeam(input)),

  getTeams: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getTeams(input.userId)),

  addTeamMember: publicProcedure
    .input(addTeamMemberInputSchema)
    .mutation(({ input }) => addTeamMember(input)),

  // Dashboard and analytics routes
  getDashboardStats: publicProcedure
    .input(getDashboardStatsInputSchema)
    .query(({ input }) => getDashboardStats(input)),

  generateReport: publicProcedure
    .input(generateReportInputSchema)
    .mutation(({ input }) => generateReport(input)),

  // Notification routes
  getNotifications: publicProcedure
    .input(z.object({ 
      userId: z.number(), 
      unreadOnly: z.boolean().optional().default(false) 
    }))
    .query(({ input }) => getNotifications(input.userId, input.unreadOnly)),

  createNotification: publicProcedure
    .input(createNotificationInputSchema)
    .mutation(({ input }) => createNotification(input)),

  markNotificationRead: publicProcedure
    .input(z.object({ 
      notificationId: z.number(), 
      userId: z.number() 
    }))
    .mutation(({ input }) => markNotificationRead(input.notificationId, input.userId)),
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
  console.log(`TRPC server listening at port: ${port}`);
}

start();