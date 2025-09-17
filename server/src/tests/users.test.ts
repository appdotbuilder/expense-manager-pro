import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, expensesTable, budgetsTable, teamMembersTable, teamsTable, categoriesTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { 
  getAllUsers,
  getUserById,
  updateUserProfile,
  updateUserRole,
  deactivateUser,
  reactivateUser,
  changePassword,
  getUserStats
} from '../handlers/users';
// Note: Using simplified password hashing for tests

// Test users data
const createTestUsers = async () => {
  const passwordHash = 'hashed_password123';
  
  const users = await db.insert(usersTable).values([
    {
      email: 'admin@example.com',
      password_hash: passwordHash,
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_active: true,
      email_verified: true
    },
    {
      email: 'manager@example.com',
      password_hash: passwordHash,
      first_name: 'Manager',
      last_name: 'User',
      role: 'manager',
      is_active: true,
      email_verified: true
    },
    {
      email: 'user@example.com',
      password_hash: passwordHash,
      first_name: 'Regular',
      last_name: 'User',
      role: 'user',
      is_active: true,
      email_verified: true
    },
    {
      email: 'inactive@example.com',
      password_hash: passwordHash,
      first_name: 'Inactive',
      last_name: 'User',
      role: 'user',
      is_active: false,
      email_verified: true
    }
  ]).returning().execute();

  return users;
};

describe('User Management Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getAllUsers', () => {
    it('should return all users for admin', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;

      const result = await getAllUsers(adminUser.id, adminUser.role);

      expect(result).toHaveLength(4);
      expect(result.every(user => user.created_at instanceof Date)).toBe(true);
      expect(result.every(user => user.updated_at instanceof Date)).toBe(true);
      
      const adminResult = result.find(u => u.email === 'admin@example.com');
      expect(adminResult?.role).toBe('admin');
      expect(adminResult?.first_name).toBe('Admin');
    });

    it('should throw error for non-admin users', async () => {
      const users = await createTestUsers();
      const regularUser = users.find(u => u.role === 'user')!;

      await expect(getAllUsers(regularUser.id, regularUser.role))
        .rejects.toThrow(/Unauthorized.*Only admins can view all users/i);
    });

    it('should throw error for manager users', async () => {
      const users = await createTestUsers();
      const managerUser = users.find(u => u.role === 'manager')!;

      await expect(getAllUsers(managerUser.id, managerUser.role))
        .rejects.toThrow(/Unauthorized.*Only admins can view all users/i);
    });
  });

  describe('getUserById', () => {
    it('should return user for admin requesting any user', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;
      const targetUser = users.find(u => u.role === 'user')!;

      const result = await getUserById(targetUser.id, adminUser.id, adminUser.role);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(targetUser.id);
      expect(result!.email).toBe('user@example.com');
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
    });

    it('should return user for self-request', async () => {
      const users = await createTestUsers();
      const regularUser = users.find(u => u.role === 'user')!;

      const result = await getUserById(regularUser.id, regularUser.id, regularUser.role);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(regularUser.id);
      expect(result!.email).toBe('user@example.com');
    });

    it('should allow manager to view any user', async () => {
      const users = await createTestUsers();
      const managerUser = users.find(u => u.role === 'manager')!;
      const targetUser = users.find(u => u.role === 'user')!;

      const result = await getUserById(targetUser.id, managerUser.id, managerUser.role);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(targetUser.id);
    });

    it('should throw error for user requesting other user', async () => {
      const users = await createTestUsers();
      const user1 = users[2]; // Regular user
      const user2 = users[3]; // Another user

      await expect(getUserById(user2.id, user1.id, user1.role))
        .rejects.toThrow(/Unauthorized.*Users can only view their own profile/i);
    });

    it('should return null for non-existent user', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;

      const result = await getUserById(99999, adminUser.id, adminUser.role);

      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      const users = await createTestUsers();
      const user = users.find(u => u.role === 'user')!;

      const updates = {
        first_name: 'Updated',
        last_name: 'Name',
        avatar_url: 'https://example.com/avatar.jpg'
      };

      const result = await updateUserProfile(user.id, updates, user.id);

      expect(result.first_name).toBe('Updated');
      expect(result.last_name).toBe('Name');
      expect(result.avatar_url).toBe('https://example.com/avatar.jpg');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update partial profile fields', async () => {
      const users = await createTestUsers();
      const user = users.find(u => u.role === 'user')!;

      const updates = {
        first_name: 'Only First Name'
      };

      const result = await updateUserProfile(user.id, updates, user.id);

      expect(result.first_name).toBe('Only First Name');
      expect(result.last_name).toBe('User'); // Should remain unchanged
    });

    it('should throw error when user tries to update other profile', async () => {
      const users = await createTestUsers();
      const user1 = users[2];
      const user2 = users[3];

      const updates = {
        first_name: 'Hacker'
      };

      await expect(updateUserProfile(user2.id, updates, user1.id))
        .rejects.toThrow(/Unauthorized.*Users can only update their own profile/i);
    });

    it('should throw error for non-existent user', async () => {
      const updates = {
        first_name: 'Test'
      };

      await expect(updateUserProfile(99999, updates, 99999))
        .rejects.toThrow(/User not found/i);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role for admin', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;
      const targetUser = users.find(u => u.role === 'user')!;

      const result = await updateUserRole(targetUser.id, 'manager', adminUser.id);

      expect(result.role).toBe('manager');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should throw error for non-admin requester', async () => {
      const users = await createTestUsers();
      const regularUser = users.find(u => u.role === 'user')!;
      const targetUser = users.find(u => u.email === 'inactive@example.com')!;

      await expect(updateUserRole(targetUser.id, 'admin', regularUser.id))
        .rejects.toThrow(/Unauthorized.*Only admins can update user roles/i);
    });

    it('should throw error for non-existent requester', async () => {
      const users = await createTestUsers();
      const targetUser = users.find(u => u.role === 'user')!;

      await expect(updateUserRole(targetUser.id, 'manager', 99999))
        .rejects.toThrow(/Unauthorized.*Only admins can update user roles/i);
    });

    it('should throw error for non-existent target user', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;

      await expect(updateUserRole(99999, 'manager', adminUser.id))
        .rejects.toThrow(/User not found/i);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user for admin', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;
      const targetUser = users.find(u => u.role === 'user')!;

      const result = await deactivateUser(targetUser.id, adminUser.id);

      expect(result.success).toBe(true);

      // Verify user is deactivated
      const updatedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, targetUser.id))
        .execute();
      
      expect(updatedUser[0].is_active).toBe(false);
    });

    it('should throw error for non-admin requester', async () => {
      const users = await createTestUsers();
      const regularUser = users.find(u => u.role === 'user')!;
      const targetUser = users.find(u => u.email === 'manager@example.com')!;

      await expect(deactivateUser(targetUser.id, regularUser.id))
        .rejects.toThrow(/Unauthorized.*Only admins can deactivate users/i);
    });

    it('should throw error when admin tries to deactivate themselves', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;

      await expect(deactivateUser(adminUser.id, adminUser.id))
        .rejects.toThrow(/Cannot deactivate your own account/i);
    });

    it('should throw error for non-existent target user', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;

      await expect(deactivateUser(99999, adminUser.id))
        .rejects.toThrow(/User not found/i);
    });
  });

  describe('reactivateUser', () => {
    it('should reactivate user for admin', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;
      const inactiveUser = users.find(u => u.email === 'inactive@example.com')!;

      const result = await reactivateUser(inactiveUser.id, adminUser.id);

      expect(result.success).toBe(true);

      // Verify user is reactivated
      const updatedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, inactiveUser.id))
        .execute();
      
      expect(updatedUser[0].is_active).toBe(true);
    });

    it('should throw error for non-admin requester', async () => {
      const users = await createTestUsers();
      const regularUser = users.find(u => u.role === 'user')!;
      const inactiveUser = users.find(u => u.email === 'inactive@example.com')!;

      await expect(reactivateUser(inactiveUser.id, regularUser.id))
        .rejects.toThrow(/Unauthorized.*Only admins can reactivate users/i);
    });

    it('should throw error for non-existent target user', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;

      await expect(reactivateUser(99999, adminUser.id))
        .rejects.toThrow(/User not found/i);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const users = await createTestUsers();
      const user = users.find(u => u.role === 'user')!;

      const result = await changePassword(user.id, 'password123', 'newpassword456');

      expect(result.success).toBe(true);

      // Verify password was changed
      const updatedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, user.id))
        .execute();
      
      expect(updatedUser[0].password_hash).toBe('hashed_newpassword456');
    });

    it('should throw error for incorrect current password', async () => {
      const users = await createTestUsers();
      const user = users.find(u => u.role === 'user')!;

      await expect(changePassword(user.id, 'wrongpassword', 'newpassword456'))
        .rejects.toThrow(/Current password is incorrect/i);
    });

    it('should throw error for non-existent user', async () => {
      await expect(changePassword(99999, 'password123', 'newpassword456'))
        .rejects.toThrow(/User not found/i);
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics for admin viewing any user', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;
      const targetUser = users.find(u => u.role === 'user')!;

      // Create test data for statistics
      const categories = await db.insert(categoriesTable).values([
        {
          name: 'Food',
          color: '#FF0000',
          is_active: true
        },
        {
          name: 'Transport',
          color: '#00FF00',
          is_active: true
        }
      ]).returning().execute();

      const teams = await db.insert(teamsTable).values({
        name: 'Test Team',
        manager_id: adminUser.id
      }).returning().execute();

      // Add user to team
      await db.insert(teamMembersTable).values({
        team_id: teams[0].id,
        user_id: targetUser.id
      }).execute();

      // Create expenses
      const today = new Date().toISOString().split('T')[0];
      await db.insert(expensesTable).values({
        user_id: targetUser.id,
        category_id: categories[0].id,
        amount: '100.50',
        description: 'Lunch',
        expense_date: today,
        tags: [],
        status: 'approved'
      }).execute();
      
      await db.insert(expensesTable).values({
        user_id: targetUser.id,
        category_id: categories[1].id,
        amount: '50.25',
        description: 'Bus fare',
        expense_date: today,
        tags: [],
        status: 'approved'
      }).execute();

      // Create budget
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      await db.insert(budgetsTable).values({
        user_id: targetUser.id,
        category_id: categories[0].id,
        amount: '500.00',
        period: 'monthly',
        start_date: today,
        end_date: endDate.toISOString().split('T')[0],
        alert_threshold: '80.00',
        is_active: true
      }).execute();

      const result = await getUserStats(targetUser.id, adminUser.id);

      expect(result.total_expenses).toBe(2);
      expect(result.total_amount).toBe(150.75);
      expect(result.avg_monthly_spending).toBeGreaterThan(0);
      expect(result.active_budgets).toBe(1);
      expect(result.team_memberships).toBe(1);
      expect(result.account_age_days).toBeGreaterThanOrEqual(0);
      expect(result.last_login).toBeNull();
      expect(result.expense_categories).toBe(2);
    });

    it('should return user statistics for self-request', async () => {
      const users = await createTestUsers();
      const user = users.find(u => u.role === 'user')!;

      const result = await getUserStats(user.id, user.id);

      expect(result.total_expenses).toBe(0);
      expect(result.total_amount).toBe(0);
      expect(result.avg_monthly_spending).toBe(0);
      expect(result.active_budgets).toBe(0);
      expect(result.team_memberships).toBe(0);
      expect(result.account_age_days).toBeGreaterThanOrEqual(0);
      expect(result.expense_categories).toBe(0);
    });

    it('should throw error for user requesting other user stats', async () => {
      const users = await createTestUsers();
      const user1 = users[2];
      const user2 = users[3];

      await expect(getUserStats(user2.id, user1.id))
        .rejects.toThrow(/Unauthorized.*Users can only view their own statistics/i);
    });

    it('should throw error for non-existent requester', async () => {
      const users = await createTestUsers();
      const targetUser = users.find(u => u.role === 'user')!;

      await expect(getUserStats(targetUser.id, 99999))
        .rejects.toThrow(/Requester not found/i);
    });

    it('should throw error for non-existent target user', async () => {
      const users = await createTestUsers();
      const adminUser = users.find(u => u.role === 'admin')!;

      await expect(getUserStats(99999, adminUser.id))
        .rejects.toThrow(/User not found/i);
    });

    it('should calculate account age correctly', async () => {
      const users = await createTestUsers();
      const user = users.find(u => u.role === 'user')!;

      // Wait a moment to ensure the user was created in the past
      const result = await getUserStats(user.id, user.id);

      expect(result.account_age_days).toBeGreaterThanOrEqual(0);
      expect(typeof result.account_age_days).toBe('number');
    });
  });
});