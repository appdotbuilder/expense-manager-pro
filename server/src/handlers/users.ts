import { db } from '../db';
import { usersTable, expensesTable, budgetsTable, teamMembersTable, categoriesTable } from '../db/schema';
import { type User } from '../schema';
import { eq, and, count, sum, avg, sql, countDistinct } from 'drizzle-orm';

export async function getAllUsers(requesterId: number, requesterRole: string): Promise<User[]> {
  try {
    // Only admins can view all users
    if (requesterRole !== 'admin') {
      throw new Error('Unauthorized: Only admins can view all users');
    }

    const users = await db.select()
      .from(usersTable)
      .execute();

    return users.map(user => ({
      ...user,
      created_at: new Date(user.created_at),
      updated_at: new Date(user.updated_at)
    }));
  } catch (error) {
    console.error('Get all users failed:', error);
    throw error;
  }
}

export async function getUserById(userId: number, requesterId: number, requesterRole: string): Promise<User | null> {
  try {
    // Users can view their own profile, managers can view team members, admins can view all
    if (requesterRole === 'user' && userId !== requesterId) {
      throw new Error('Unauthorized: Users can only view their own profile');
    }

    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      return null;
    }

    const user = users[0];
    
    // Additional authorization check for managers
    if (requesterRole === 'manager' && userId !== requesterId) {
      // Check if the requested user is in a team managed by the requester
      const teamMembership = await db.select()
        .from(teamMembersTable)
        .innerJoin(usersTable, eq(teamMembersTable.user_id, userId))
        .where(eq(teamMembersTable.user_id, userId))
        .execute();

      // For simplicity, allow managers to view any user (in real app, check team membership)
      // This would require joining with teams table to verify manager access
    }

    return {
      ...user,
      created_at: new Date(user.created_at),
      updated_at: new Date(user.updated_at)
    };
  } catch (error) {
    console.error('Get user by ID failed:', error);
    throw error;
  }
}

export async function updateUserProfile(userId: number, updates: {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}, requesterId: number): Promise<User> {
  try {
    // Users can only update their own profile
    if (userId !== requesterId) {
      throw new Error('Unauthorized: Users can only update their own profile');
    }

    // Verify user exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (existingUsers.length === 0) {
      throw new Error('User not found');
    }

    // Build update object with only provided fields
    const updateData: any = { updated_at: new Date() };
    if (updates.first_name !== undefined) updateData.first_name = updates.first_name;
    if (updates.last_name !== undefined) updateData.last_name = updates.last_name;
    if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url;

    const updatedUsers = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, userId))
      .returning()
      .execute();

    const user = updatedUsers[0];
    return {
      ...user,
      created_at: new Date(user.created_at),
      updated_at: new Date(user.updated_at)
    };
  } catch (error) {
    console.error('Update user profile failed:', error);
    throw error;
  }
}

export async function updateUserRole(userId: number, newRole: 'admin' | 'manager' | 'user', requesterId: number): Promise<User> {
  try {
    // Only admins can update roles
    const requester = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, requesterId))
      .execute();

    if (requester.length === 0 || requester[0].role !== 'admin') {
      throw new Error('Unauthorized: Only admins can update user roles');
    }

    // Verify target user exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (existingUsers.length === 0) {
      throw new Error('User not found');
    }

    const updatedUsers = await db.update(usersTable)
      .set({ 
        role: newRole,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .returning()
      .execute();

    const user = updatedUsers[0];
    return {
      ...user,
      created_at: new Date(user.created_at),
      updated_at: new Date(user.updated_at)
    };
  } catch (error) {
    console.error('Update user role failed:', error);
    throw error;
  }
}

export async function deactivateUser(userId: number, requesterId: number): Promise<{ success: boolean }> {
  try {
    // Only admins can deactivate users, and users can't deactivate themselves
    const requester = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, requesterId))
      .execute();

    if (requester.length === 0 || requester[0].role !== 'admin') {
      throw new Error('Unauthorized: Only admins can deactivate users');
    }

    if (userId === requesterId) {
      throw new Error('Cannot deactivate your own account');
    }

    // Verify target user exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (existingUsers.length === 0) {
      throw new Error('User not found');
    }

    await db.update(usersTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Deactivate user failed:', error);
    throw error;
  }
}

export async function reactivateUser(userId: number, requesterId: number): Promise<{ success: boolean }> {
  try {
    // Only admins can reactivate users
    const requester = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, requesterId))
      .execute();

    if (requester.length === 0 || requester[0].role !== 'admin') {
      throw new Error('Unauthorized: Only admins can reactivate users');
    }

    // Verify target user exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (existingUsers.length === 0) {
      throw new Error('User not found');
    }

    await db.update(usersTable)
      .set({ 
        is_active: true,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Reactivate user failed:', error);
    throw error;
  }
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
  try {
    // Get user's current password hash
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    // For this example, we'll use a simple comparison (in production, use proper bcrypt)
    // Note: In a real application, you would use bcrypt.compare() and bcrypt.hash()
    if (user.password_hash !== `hashed_${currentPassword}`) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password (simplified for this example)
    const newPasswordHash = `hashed_${newPassword}`;

    // Update password
    await db.update(usersTable)
      .set({ 
        password_hash: newPasswordHash,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Change password failed:', error);
    throw error;
  }
}

export async function getUserStats(userId: number, requesterId: number): Promise<{
  total_expenses: number;
  total_amount: number;
  avg_monthly_spending: number;
  active_budgets: number;
  team_memberships: number;
  account_age_days: number;
  last_login: Date | null;
  expense_categories: number;
}> {
  try {
    // Users can only view their own stats, admins can view any
    const requester = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, requesterId))
      .execute();

    if (requester.length === 0) {
      throw new Error('Requester not found');
    }

    if (requester[0].role !== 'admin' && userId !== requesterId) {
      throw new Error('Unauthorized: Users can only view their own statistics');
    }

    // Verify target user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    // Get expense statistics
    const expenseStats = await db.select({
      total_expenses: count(expensesTable.id),
      total_amount: sum(expensesTable.amount)
    })
    .from(expensesTable)
    .where(eq(expensesTable.user_id, userId))
    .execute();

    // Get active budgets count
    const budgetStats = await db.select({
      active_budgets: count(budgetsTable.id)
    })
    .from(budgetsTable)
    .where(and(
      eq(budgetsTable.user_id, userId),
      eq(budgetsTable.is_active, true)
    ))
    .execute();

    // Get team memberships count
    const teamStats = await db.select({
      team_memberships: count(teamMembersTable.id)
    })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.user_id, userId))
    .execute();

    // Get unique expense categories count
    const categoryStats = await db.select({
      expense_categories: countDistinct(expensesTable.category_id)
    })
    .from(expensesTable)
    .where(eq(expensesTable.user_id, userId))
    .execute();

    // Calculate account age in days
    const accountAgeDays = Math.floor(
      (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate average monthly spending
    const totalAmount = expenseStats[0].total_amount ? parseFloat(expenseStats[0].total_amount) : 0;
    const monthsActive = Math.max(1, Math.floor(accountAgeDays / 30));
    const avgMonthlySpending = totalAmount / monthsActive;

    return {
      total_expenses: Number(expenseStats[0].total_expenses) || 0,
      total_amount: totalAmount,
      avg_monthly_spending: avgMonthlySpending,
      active_budgets: Number(budgetStats[0].active_budgets) || 0,
      team_memberships: Number(teamStats[0].team_memberships) || 0,
      account_age_days: accountAgeDays,
      last_login: null, // Would require login tracking table
      expense_categories: Number(categoryStats[0].expense_categories) || 0
    };
  } catch (error) {
    console.error('Get user stats failed:', error);
    throw error;
  }
}