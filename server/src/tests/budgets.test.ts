import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { budgetsTable, usersTable, categoriesTable } from '../db/schema';
import { type CreateBudgetInput } from '../schema';
import { createBudget } from '../handlers/budgets';
import { eq } from 'drizzle-orm';

describe('createBudget', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    let testUserId: number;
    let testCategoryId: number;

    beforeEach(async () => {
        // Create a test user
        const userResult = await db.insert(usersTable)
            .values({
                email: 'test@example.com',
                password_hash: 'hashed_password',
                first_name: 'Test',
                last_name: 'User',
                role: 'user'
            })
            .returning()
            .execute();
        testUserId = userResult[0].id;

        // Create a test category
        const categoryResult = await db.insert(categoriesTable)
            .values({
                name: 'Test Category',
                description: 'A category for testing',
                color: '#FF0000'
            })
            .returning()
            .execute();
        testCategoryId = categoryResult[0].id;
    });

    it('should create a budget with all fields', async () => {
        const testInput: CreateBudgetInput = {
            category_id: testCategoryId,
            amount: 1500.50,
            period: 'monthly',
            start_date: new Date('2024-01-01'),
            end_date: new Date('2024-12-31'),
            alert_threshold: 85
        };

        const result = await createBudget(testInput, testUserId);

        // Basic field validation
        expect(result.user_id).toEqual(testUserId);
        expect(result.category_id).toEqual(testCategoryId);
        expect(result.amount).toEqual(1500.50);
        expect(result.period).toEqual('monthly');
        expect(result.start_date).toEqual(new Date('2024-01-01'));
        expect(result.end_date).toEqual(new Date('2024-12-31'));
        expect(result.alert_threshold).toEqual(85);
        expect(result.is_active).toBe(true);
        expect(result.id).toBeDefined();
        expect(result.created_at).toBeInstanceOf(Date);
        expect(result.updated_at).toBeInstanceOf(Date);

        // Verify numeric type conversions
        expect(typeof result.amount).toBe('number');
        expect(typeof result.alert_threshold).toBe('number');
    });

    it('should create a budget without category (overall budget)', async () => {
        const testInput: CreateBudgetInput = {
            category_id: null,
            amount: 2000,
            period: 'yearly',
            start_date: new Date('2024-01-01'),
            end_date: new Date('2024-12-31'),
            alert_threshold: 90
        };

        const result = await createBudget(testInput, testUserId);

        expect(result.user_id).toEqual(testUserId);
        expect(result.category_id).toBeNull();
        expect(result.amount).toEqual(2000);
        expect(result.period).toEqual('yearly');
        expect(result.alert_threshold).toEqual(90);
        expect(result.is_active).toBe(true);
    });

    it('should save budget to database', async () => {
        const testInput: CreateBudgetInput = {
            category_id: testCategoryId,
            amount: 1000.75,
            period: 'monthly',
            start_date: new Date('2024-01-01'),
            end_date: new Date('2024-01-31'),
            alert_threshold: 80
        };

        const result = await createBudget(testInput, testUserId);

        // Query using proper drizzle syntax
        const budgets = await db.select()
            .from(budgetsTable)
            .where(eq(budgetsTable.id, result.id))
            .execute();

        expect(budgets).toHaveLength(1);
        expect(budgets[0].user_id).toEqual(testUserId);
        expect(budgets[0].category_id).toEqual(testCategoryId);
        expect(parseFloat(budgets[0].amount)).toEqual(1000.75);
        expect(budgets[0].period).toEqual('monthly');
        expect(parseFloat(budgets[0].alert_threshold)).toEqual(80);
        expect(budgets[0].is_active).toBe(true);
        expect(budgets[0].created_at).toBeInstanceOf(Date);
        expect(budgets[0].updated_at).toBeInstanceOf(Date);
    });

    it('should use default alert_threshold when not provided', async () => {
        const testInput: CreateBudgetInput = {
            category_id: testCategoryId,
            amount: 500,
            period: 'monthly',
            start_date: new Date('2024-01-01'),
            end_date: new Date('2024-01-31'),
            alert_threshold: 80 // Default from Zod schema
        };

        const result = await createBudget(testInput, testUserId);

        expect(result.alert_threshold).toEqual(80);
        expect(typeof result.alert_threshold).toBe('number');
    });

    it('should throw error when user does not exist', async () => {
        const testInput: CreateBudgetInput = {
            category_id: testCategoryId,
            amount: 1000,
            period: 'monthly',
            start_date: new Date('2024-01-01'),
            end_date: new Date('2024-01-31'),
            alert_threshold: 80
        };

        const nonExistentUserId = 99999;

        await expect(createBudget(testInput, nonExistentUserId))
            .rejects.toThrow(/User with id 99999 does not exist/i);
    });

    it('should throw error when category does not exist', async () => {
        const testInput: CreateBudgetInput = {
            category_id: 99999, // Non-existent category
            amount: 1000,
            period: 'monthly',
            start_date: new Date('2024-01-01'),
            end_date: new Date('2024-01-31'),
            alert_threshold: 80
        };

        await expect(createBudget(testInput, testUserId))
            .rejects.toThrow(/Category with id 99999 does not exist/i);
    });

    it('should handle decimal amounts correctly', async () => {
        const testInput: CreateBudgetInput = {
            category_id: testCategoryId,
            amount: 1234.56,
            period: 'monthly',
            start_date: new Date('2024-01-01'),
            end_date: new Date('2024-01-31'),
            alert_threshold: 75.5
        };

        const result = await createBudget(testInput, testUserId);

        expect(result.amount).toEqual(1234.56);
        expect(result.alert_threshold).toEqual(75.5);

        // Verify in database
        const budgets = await db.select()
            .from(budgetsTable)
            .where(eq(budgetsTable.id, result.id))
            .execute();

        expect(parseFloat(budgets[0].amount)).toEqual(1234.56);
        expect(parseFloat(budgets[0].alert_threshold)).toEqual(75.5);
    });

    it('should handle different period types', async () => {
        // Test monthly period
        const monthlyInput: CreateBudgetInput = {
            category_id: testCategoryId,
            amount: 500,
            period: 'monthly',
            start_date: new Date('2024-01-01'),
            end_date: new Date('2024-01-31'),
            alert_threshold: 80
        };

        const monthlyResult = await createBudget(monthlyInput, testUserId);
        expect(monthlyResult.period).toEqual('monthly');

        // Test yearly period
        const yearlyInput: CreateBudgetInput = {
            category_id: testCategoryId,
            amount: 6000,
            period: 'yearly',
            start_date: new Date('2024-01-01'),
            end_date: new Date('2024-12-31'),
            alert_threshold: 85
        };

        const yearlyResult = await createBudget(yearlyInput, testUserId);
        expect(yearlyResult.period).toEqual('yearly');
    });
});