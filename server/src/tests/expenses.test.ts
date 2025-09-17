import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { expensesTable, categoriesTable, usersTable, teamsTable } from '../db/schema';
import { type CreateExpenseInput } from '../schema';
import { createExpense } from '../handlers/expenses';
import { eq } from 'drizzle-orm';

describe('createExpense', () => {
  let testUserId: number;
  let testCategoryId: number;
  let testTeamId: number;

  beforeEach(async () => {
    await createDB();

    // Create a test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'user'
      })
      .returning()
      .execute();
    testUserId = user[0].id;

    // Create a test category
    const category = await db.insert(categoriesTable)
      .values({
        name: 'Travel',
        description: 'Travel expenses',
        color: '#8B5CF6'
      })
      .returning()
      .execute();
    testCategoryId = category[0].id;

    // Create a test team (with the user as manager)
    const team = await db.insert(teamsTable)
      .values({
        name: 'Test Team',
        description: 'A test team',
        manager_id: testUserId
      })
      .returning()
      .execute();
    testTeamId = team[0].id;
  });

  afterEach(resetDB);

  const baseTestInput: CreateExpenseInput = {
    category_id: 0, // Will be set in tests
    amount: 99.99,
    description: 'Business lunch',
    expense_date: new Date('2024-01-15'),
    receipt_url: 'https://example.com/receipt.pdf',
    tags: ['meal', 'business'],
    is_recurring: false,
    recurring_pattern: null,
    team_id: null,
    notes: 'Lunch with client'
  };

  it('should create a basic expense', async () => {
    const input = { ...baseTestInput, category_id: testCategoryId };

    const result = await createExpense(input, testUserId);

    // Verify returned expense data
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(testUserId);
    expect(result.category_id).toEqual(testCategoryId);
    expect(result.amount).toEqual(99.99);
    expect(typeof result.amount).toBe('number');
    expect(result.description).toEqual('Business lunch');
    expect(result.expense_date).toEqual(new Date('2024-01-15'));
    expect(result.receipt_url).toEqual('https://example.com/receipt.pdf');
    expect(result.tags).toEqual(['meal', 'business']);
    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.status).toEqual('draft');
    expect(result.approved_by).toBeNull();
    expect(result.approved_at).toBeNull();
    expect(result.is_recurring).toBe(false);
    expect(result.recurring_pattern).toBeNull();
    expect(result.team_id).toBeNull();
    expect(result.notes).toEqual('Lunch with client');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save expense to database correctly', async () => {
    const input = { ...baseTestInput, category_id: testCategoryId };

    const result = await createExpense(input, testUserId);

    // Query database to verify expense was saved
    const expenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, result.id))
      .execute();

    expect(expenses).toHaveLength(1);
    const expense = expenses[0];
    
    expect(expense.user_id).toEqual(testUserId);
    expect(expense.category_id).toEqual(testCategoryId);
    expect(parseFloat(expense.amount)).toEqual(99.99);
    expect(expense.description).toEqual('Business lunch');
    expect(new Date(expense.expense_date)).toEqual(new Date('2024-01-15'));
    expect(expense.receipt_url).toEqual('https://example.com/receipt.pdf');
    const tags = Array.isArray(expense.tags) ? expense.tags : JSON.parse(expense.tags as string);
    expect(tags).toEqual(['meal', 'business']);
    expect(expense.status).toEqual('draft');
    expect(expense.is_recurring).toBe(false);
    expect(expense.notes).toEqual('Lunch with client');
  });

  it('should create expense with team assignment', async () => {
    const input = { 
      ...baseTestInput, 
      category_id: testCategoryId,
      team_id: testTeamId 
    };

    const result = await createExpense(input, testUserId);

    expect(result.team_id).toEqual(testTeamId);

    // Verify in database
    const expenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, result.id))
      .execute();

    expect(expenses[0].team_id).toEqual(testTeamId);
  });

  it('should create recurring expense', async () => {
    const input = { 
      ...baseTestInput, 
      category_id: testCategoryId,
      is_recurring: true,
      recurring_pattern: 'monthly'
    };

    const result = await createExpense(input, testUserId);

    expect(result.is_recurring).toBe(true);
    expect(result.recurring_pattern).toEqual('monthly');

    // Verify in database
    const expenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, result.id))
      .execute();

    expect(expenses[0].is_recurring).toBe(true);
    expect(expenses[0].recurring_pattern).toEqual('monthly');
  });

  it('should create expense with minimal required fields', async () => {
    const minimalInput: CreateExpenseInput = {
      category_id: testCategoryId,
      amount: 25.50,
      description: 'Coffee',
      expense_date: new Date('2024-01-16'),
      receipt_url: null,
      tags: [],
      is_recurring: false,
      recurring_pattern: null,
      team_id: null,
      notes: null
    };

    const result = await createExpense(minimalInput, testUserId);

    expect(result.amount).toEqual(25.50);
    expect(result.description).toEqual('Coffee');
    expect(result.receipt_url).toBeNull();
    expect(result.tags).toEqual([]);
    expect(result.team_id).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('should handle empty tags array correctly', async () => {
    const input = { 
      ...baseTestInput, 
      category_id: testCategoryId,
      tags: []
    };

    const result = await createExpense(input, testUserId);

    expect(result.tags).toEqual([]);
    expect(Array.isArray(result.tags)).toBe(true);

    // Verify in database
    const expenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, result.id))
      .execute();

    const tags = Array.isArray(expenses[0].tags) ? expenses[0].tags : JSON.parse(expenses[0].tags as string);
    expect(tags).toEqual([]);
  });

  it('should handle large tag arrays', async () => {
    const largeTags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'business', 'travel', 'meals'];
    const input = { 
      ...baseTestInput, 
      category_id: testCategoryId,
      tags: largeTags
    };

    const result = await createExpense(input, testUserId);

    expect(result.tags).toEqual(largeTags);
    expect(result.tags.length).toEqual(8);
  });

  it('should throw error for non-existent category', async () => {
    const input = { ...baseTestInput, category_id: 99999 };

    await expect(createExpense(input, testUserId))
      .rejects.toThrow(/Category with id 99999 does not exist/i);
  });

  it('should throw error for non-existent team', async () => {
    const input = { 
      ...baseTestInput, 
      category_id: testCategoryId,
      team_id: 99999 
    };

    await expect(createExpense(input, testUserId))
      .rejects.toThrow(/Team with id 99999 does not exist/i);
  });

  it('should handle various numeric amounts correctly', async () => {
    const testCases = [
      { amount: 0.01, description: 'Penny expense' },
      { amount: 1000000.99, description: 'Large expense' },
      { amount: 123.456, description: 'Three decimal places' }, // Should be stored with 2 decimal precision
      { amount: 50, description: 'Whole number' }
    ];

    for (const testCase of testCases) {
      const input = { 
        ...baseTestInput, 
        category_id: testCategoryId,
        amount: testCase.amount,
        description: testCase.description
      };

      const result = await createExpense(input, testUserId);

      expect(typeof result.amount).toBe('number');
      // For amounts with more than 2 decimal places, expect database precision (2 decimal places)
      if (testCase.amount === 123.456) {
        expect(result.amount).toBeCloseTo(123.46, 2);
      } else {
        expect(result.amount).toEqual(testCase.amount);
      }
    }
  });

  it('should set default status to draft', async () => {
    const input = { ...baseTestInput, category_id: testCategoryId };

    const result = await createExpense(input, testUserId);

    expect(result.status).toEqual('draft');
    expect(result.approved_by).toBeNull();
    expect(result.approved_at).toBeNull();
  });

  it('should handle special characters in description and notes', async () => {
    const specialText = "Special chars: àáâãäåæçèéêë & $100 @user #tag 🚀";
    const input = { 
      ...baseTestInput, 
      category_id: testCategoryId,
      description: specialText,
      notes: specialText
    };

    const result = await createExpense(input, testUserId);

    expect(result.description).toEqual(specialText);
    expect(result.notes).toEqual(specialText);

    // Verify in database
    const expenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, result.id))
      .execute();

    expect(expenses[0].description).toEqual(specialText);
    expect(expenses[0].notes).toEqual(specialText);
  });
});