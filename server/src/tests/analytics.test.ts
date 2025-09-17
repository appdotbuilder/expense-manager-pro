import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, expensesTable, budgetsTable, teamsTable } from '../db/schema';
import { getExpenseAnalytics } from '../handlers/analytics';

// Test data setup
const setupTestData = async () => {
  // Create test users
  const users = await db.insert(usersTable)
    .values([
      {
        email: 'admin@test.com',
        password_hash: 'hash123',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      },
      {
        email: 'manager@test.com',
        password_hash: 'hash123',
        first_name: 'Manager',
        last_name: 'User',
        role: 'manager'
      },
      {
        email: 'user@test.com',
        password_hash: 'hash123',
        first_name: 'Regular',
        last_name: 'User',
        role: 'user'
      },
      {
        email: 'teammate@test.com',
        password_hash: 'hash123',
        first_name: 'Team',
        last_name: 'Member',
        role: 'user'
      }
    ])
    .returning()
    .execute();

  // Create categories
  const categories = await db.insert(categoriesTable)
    .values([
      {
        name: 'Travel',
        description: 'Travel expenses',
        color: '#FF5733',
        is_active: true
      },
      {
        name: 'Office Supplies',
        description: 'Office related expenses',
        color: '#33FF57',
        is_active: true
      },
      {
        name: 'Meals',
        description: 'Meal expenses',
        color: '#3357FF',
        is_active: true
      }
    ])
    .returning()
    .execute();

  // Create team with manager
  const teams = await db.insert(teamsTable)
    .values([
      {
        name: 'Engineering Team',
        description: 'Software engineering team',
        manager_id: users[1].id // manager user
      }
    ])
    .returning()
    .execute();

  // Create expenses with different dates and categories
  const currentDate = new Date();
  const lastMonth = new Date(currentDate);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  
  // Convert dates to date strings
  const currentDateStr = currentDate.toISOString().split('T')[0];
  const lastMonthStr = lastMonth.toISOString().split('T')[0];
  
  const expenses = await db.insert(expensesTable)
    .values([
      // Current month expenses for regular user
      {
        user_id: users[2].id,
        category_id: categories[0].id,
        amount: '150.00',
        description: 'Flight tickets',
        expense_date: currentDateStr,
        status: 'approved'
      },
      {
        user_id: users[2].id,
        category_id: categories[1].id,
        amount: '75.50',
        description: 'Office supplies',
        expense_date: currentDateStr,
        status: 'approved'
      },
      {
        user_id: users[2].id,
        category_id: categories[2].id,
        amount: '45.25',
        description: 'Lunch meeting',
        expense_date: currentDateStr,
        status: 'approved'
      },
      // Last month expenses for regular user
      {
        user_id: users[2].id,
        category_id: categories[0].id,
        amount: '200.00',
        description: 'Hotel stay',
        expense_date: lastMonthStr,
        status: 'approved'
      },
      // Manager's own expenses
      {
        user_id: users[1].id,
        category_id: categories[1].id,
        amount: '100.00',
        description: 'Manager office supplies',
        expense_date: currentDateStr,
        status: 'approved'
      },
      // Team member's expense (should be visible to manager)
      {
        user_id: users[3].id,
        category_id: categories[2].id,
        amount: '30.75',
        description: 'Team lunch',
        expense_date: currentDateStr,
        status: 'approved',
        team_id: teams[0].id
      }
    ])
    .returning()
    .execute();

  // Create budgets
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
  const endOfMonthStr = endOfMonth.toISOString().split('T')[0];
  
  await db.insert(budgetsTable)
    .values([
      {
        user_id: users[2].id,
        category_id: categories[0].id,
        amount: '300.00',
        period: 'monthly',
        start_date: startOfMonthStr,
        end_date: endOfMonthStr,
        alert_threshold: '80.00',
        is_active: true
      },
      {
        user_id: users[2].id,
        category_id: categories[1].id,
        amount: '100.00',
        period: 'monthly',
        start_date: startOfMonthStr,
        end_date: endOfMonthStr,
        alert_threshold: '80.00',
        is_active: true
      }
    ])
    .execute();

  return { users, categories, expenses, teams };
};

describe('getExpenseAnalytics', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate analytics for regular user with current month data', async () => {
    const { users } = await setupTestData();
    const regularUser = users[2];
    
    const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    
    const result = await getExpenseAnalytics(regularUser.id, 'user', startDate, endDate);
    
    // Basic statistics validation
    expect(result.total_amount).toEqual(270.75); // 150 + 75.50 + 45.25
    expect(result.expense_count).toEqual(3);
    expect(result.avg_expense).toBeCloseTo(90.25, 2);
    
    // Category breakdown validation
    expect(result.category_breakdown).toHaveLength(3);
    
    const travelCategory = result.category_breakdown.find(c => c.category_name === 'Travel');
    expect(travelCategory?.amount).toEqual(150.00);
    expect(travelCategory?.percentage).toBeCloseTo(55.40, 1);
    
    const officeCategory = result.category_breakdown.find(c => c.category_name === 'Office Supplies');
    expect(officeCategory?.amount).toEqual(75.50);
    expect(officeCategory?.percentage).toBeCloseTo(27.89, 1);
    
    // Monthly trend validation
    expect(result.monthly_trend).toHaveLength(1);
    expect(result.monthly_trend[0].amount).toEqual(270.75);
    
    // Budget comparison validation
    expect(result.budget_vs_actual.budget_amount).toEqual(400.00); // 300 + 100
    expect(result.budget_vs_actual.actual_amount).toEqual(270.75);
    expect(result.budget_vs_actual.variance).toEqual(-129.25); // 270.75 - 400
    expect(result.budget_vs_actual.variance_percentage).toBeCloseTo(-32.31, 2);
  });

  it('should generate analytics for manager with team visibility', async () => {
    const { users } = await setupTestData();
    const manager = users[1];
    
    const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    
    const result = await getExpenseAnalytics(manager.id, 'manager', startDate, endDate);
    
    // Should include manager's own expenses + team member's expenses
    expect(result.total_amount).toEqual(130.75); // 100 (manager) + 30.75 (team member)
    expect(result.expense_count).toEqual(2);
    expect(result.avg_expense).toBeCloseTo(65.375, 2);
    
    // Category breakdown should include both manager and team expenses
    expect(result.category_breakdown).toHaveLength(2);
    
    const officeCategory = result.category_breakdown.find(c => c.category_name === 'Office Supplies');
    expect(officeCategory?.amount).toEqual(100.00);
    
    const mealsCategory = result.category_breakdown.find(c => c.category_name === 'Meals');
    expect(mealsCategory?.amount).toEqual(30.75);
  });

  it('should generate analytics for admin with all data visibility', async () => {
    const { users } = await setupTestData();
    const admin = users[0];
    
    const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    
    const result = await getExpenseAnalytics(admin.id, 'admin', startDate, endDate);
    
    // Should include all current month expenses from all users
    expect(result.total_amount).toEqual(401.50); // All current month expenses
    expect(result.expense_count).toEqual(5);
    expect(result.avg_expense).toBeCloseTo(80.30, 2);
    
    // Should include all categories
    expect(result.category_breakdown).toHaveLength(3);
  });

  it('should handle date range filtering correctly', async () => {
    const { users } = await setupTestData();
    const regularUser = users[2];
    
    // Query for last month only
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    
    const result = await getExpenseAnalytics(regularUser.id, 'user', startDate, endDate);
    
    // Should only include last month's expense
    expect(result.total_amount).toEqual(200.00);
    expect(result.expense_count).toEqual(1);
    expect(result.category_breakdown).toHaveLength(1);
    expect(result.category_breakdown[0].category_name).toEqual('Travel');
  });

  it('should handle empty results gracefully', async () => {
    const { users } = await setupTestData();
    const regularUser = users[2];
    
    // Query for future dates with no expenses
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const startDate = new Date(futureDate.getFullYear(), futureDate.getMonth(), 1);
    const endDate = new Date(futureDate.getFullYear(), futureDate.getMonth() + 1, 0);
    
    const result = await getExpenseAnalytics(regularUser.id, 'user', startDate, endDate);
    
    expect(result.total_amount).toEqual(0);
    expect(result.expense_count).toEqual(0);
    expect(result.avg_expense).toEqual(0);
    expect(result.category_breakdown).toHaveLength(0);
    expect(result.monthly_trend).toHaveLength(0);
    expect(result.budget_vs_actual.budget_amount).toEqual(0);
    expect(result.budget_vs_actual.actual_amount).toEqual(0);
    expect(result.budget_vs_actual.variance).toEqual(0);
    expect(result.budget_vs_actual.variance_percentage).toEqual(0);
  });

  it('should calculate percentages correctly with single category', async () => {
    const { users, categories } = await setupTestData();
    
    // Create user with single expense
    const singleUser = await db.insert(usersTable)
      .values({
        email: 'single@test.com',
        password_hash: 'hash123',
        first_name: 'Single',
        last_name: 'User',
        role: 'user'
      })
      .returning()
      .execute();
    
    await db.insert(expensesTable)
      .values({
        user_id: singleUser[0].id,
        category_id: categories[0].id,
        amount: '100.00',
        description: 'Single expense',
        expense_date: new Date().toISOString().split('T')[0],
        status: 'approved'
      })
      .execute();
    
    const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    
    const result = await getExpenseAnalytics(singleUser[0].id, 'user', startDate, endDate);
    
    expect(result.category_breakdown).toHaveLength(1);
    expect(result.category_breakdown[0].percentage).toEqual(100);
  });

  it('should handle manager without team correctly', async () => {
    // Create manager without team
    const managerUser = await db.insert(usersTable)
      .values({
        email: 'lonely.manager@test.com',
        password_hash: 'hash123',
        first_name: 'Lonely',
        last_name: 'Manager',
        role: 'manager'
      })
      .returning()
      .execute();
    
    const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    
    const result = await getExpenseAnalytics(managerUser[0].id, 'manager', startDate, endDate);
    
    // Should return empty results but not fail
    expect(result.total_amount).toEqual(0);
    expect(result.expense_count).toEqual(0);
    expect(result.category_breakdown).toHaveLength(0);
  });
});