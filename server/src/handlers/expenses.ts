import { db } from '../db';
import { expensesTable, categoriesTable, usersTable, teamsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type CreateExpenseInput, type UpdateExpenseInput, type ApproveExpenseInput, type Expense, type SearchExpensesInput } from '../schema';

export async function createExpense(input: CreateExpenseInput, userId: number): Promise<Expense> {
    try {
        // Verify that the category exists
        const category = await db.select()
            .from(categoriesTable)
            .where(eq(categoriesTable.id, input.category_id))
            .execute();

        if (category.length === 0) {
            throw new Error(`Category with id ${input.category_id} does not exist`);
        }

        // If team_id is provided, verify that the team exists
        if (input.team_id) {
            const team = await db.select()
                .from(teamsTable)
                .where(eq(teamsTable.id, input.team_id))
                .execute();

            if (team.length === 0) {
                throw new Error(`Team with id ${input.team_id} does not exist`);
            }
        }

        // Create the expense record
        const result = await db.insert(expensesTable)
            .values({
                user_id: userId,
                category_id: input.category_id,
                amount: input.amount.toString(), // Convert number to string for numeric column
                description: input.description,
                expense_date: input.expense_date.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
                receipt_url: input.receipt_url || null,
                tags: input.tags, // Pass array directly for jsonb column
                status: 'draft',
                is_recurring: input.is_recurring,
                recurring_pattern: input.recurring_pattern || null,
                team_id: input.team_id || null,
                notes: input.notes || null
            })
            .returning()
            .execute();

        const expense = result[0];

        // Convert numeric fields back to numbers and handle date/tags
        return {
            ...expense,
            amount: parseFloat(expense.amount), // Convert string back to number
            expense_date: new Date(expense.expense_date), // Convert string back to Date
            tags: Array.isArray(expense.tags) ? expense.tags : (expense.tags ? JSON.parse(expense.tags as string) : [])
        };
    } catch (error) {
        console.error('Expense creation failed:', error);
        throw error;
    }
}

export async function getExpenses(userId: number, userRole: string): Promise<Expense[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to fetch expenses based on user role:
    // - Users see only their expenses
    // - Managers see team expenses
    // - Admins see all expenses
    return Promise.resolve([]);
}

export async function getExpenseById(expenseId: number, userId: number, userRole: string): Promise<Expense | null> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to fetch a specific expense with proper access control
    // and return detailed expense information including related data.
    return Promise.resolve(null);
}

export async function updateExpense(input: UpdateExpenseInput, userId: number): Promise<Expense> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to update expense details with validation
    // ensuring only expense owner can modify draft/rejected expenses.
    return Promise.resolve({
        id: input.id,
        user_id: userId,
        category_id: input.category_id || 1,
        amount: input.amount || 0,
        description: input.description || '',
        expense_date: input.expense_date || new Date(),
        receipt_url: input.receipt_url || null,
        tags: input.tags || [],
        status: 'draft',
        approved_by: null,
        approved_at: null,
        is_recurring: false,
        recurring_pattern: null,
        team_id: null,
        notes: input.notes || null,
        created_at: new Date(),
        updated_at: new Date()
    } as Expense);
}

export async function deleteExpense(expenseId: number, userId: number): Promise<{ success: boolean }> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to soft delete expense with proper authorization
    // ensuring only draft expenses can be deleted by their owners.
    return Promise.resolve({ success: true });
}

export async function approveExpense(input: ApproveExpenseInput, approverId: number): Promise<Expense> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to approve/reject expense requests by managers/admins,
    // send notifications to expense owners, and update expense status.
    return Promise.resolve({
        id: input.expense_id,
        user_id: 1,
        category_id: 1,
        amount: 100,
        description: 'Sample expense',
        expense_date: new Date(),
        receipt_url: null,
        tags: [],
        status: input.status,
        approved_by: approverId,
        approved_at: new Date(),
        is_recurring: false,
        recurring_pattern: null,
        team_id: null,
        notes: input.notes || null,
        created_at: new Date(),
        updated_at: new Date()
    } as Expense);
}

export async function searchExpenses(input: SearchExpensesInput, userId: number, userRole: string): Promise<{
    expenses: Expense[];
    total: number;
    page: number;
    limit: number;
}> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to provide advanced search and filtering capabilities
    // with full-text search, date ranges, categories, amounts, tags, and pagination.
    return Promise.resolve({
        expenses: [],
        total: 0,
        page: input.page,
        limit: input.limit
    });
}

export async function getRecurringExpenses(userId: number): Promise<Expense[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to fetch all recurring expenses for a user
    // and provide management interface for recurring patterns.
    return Promise.resolve([]);
}

export async function getPendingApprovals(managerId: number): Promise<Expense[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to fetch expenses pending approval for managers
    // including team member expenses requiring authorization.
    return Promise.resolve([]);
}