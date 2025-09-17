import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, teamsTable, teamMembersTable, expensesTable, categoriesTable } from '../db/schema';
import { type CreateTeamInput } from '../schema';
import { eq, and } from 'drizzle-orm';
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
} from '../handlers/teams';

// Test data
const testAdmin = {
  email: 'admin@test.com',
  password_hash: 'hashed_password',
  first_name: 'Admin',
  last_name: 'User',
  role: 'admin' as const
};

const testManager = {
  email: 'manager@test.com',
  password_hash: 'hashed_password',
  first_name: 'Manager',
  last_name: 'User',
  role: 'manager' as const
};

const testUser = {
  email: 'user@test.com',
  password_hash: 'hashed_password',
  first_name: 'Regular',
  last_name: 'User',
  role: 'user' as const
};

const testCategory = {
  name: 'Test Category',
  color: '#8B5CF6'
};

const testTeamInput: CreateTeamInput = {
  name: 'Engineering Team',
  description: 'Software development team',
  manager_id: 2 // Will be set to manager's ID in tests
};

describe('Teams Handler', () => {
  let adminId: number;
  let managerId: number;
  let userId: number;
  let categoryId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test users
    const adminResult = await db.insert(usersTable).values(testAdmin).returning().execute();
    adminId = adminResult[0].id;
    
    const managerResult = await db.insert(usersTable).values(testManager).returning().execute();
    managerId = managerResult[0].id;
    
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    userId = userResult[0].id;

    // Create test category
    const categoryResult = await db.insert(categoriesTable).values(testCategory).returning().execute();
    categoryId = categoryResult[0].id;
  });

  afterEach(resetDB);

  describe('createTeam', () => {
    it('should create a team with manager', async () => {
      const input = { ...testTeamInput, manager_id: managerId };
      const result = await createTeam(input);

      expect(result.name).toEqual('Engineering Team');
      expect(result.description).toEqual('Software development team');
      expect(result.manager_id).toEqual(managerId);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create a team with admin as manager', async () => {
      const input = { ...testTeamInput, manager_id: adminId };
      const result = await createTeam(input);

      expect(result.manager_id).toEqual(adminId);
      expect(result.name).toEqual('Engineering Team');
    });

    it('should save team to database', async () => {
      const input = { ...testTeamInput, manager_id: managerId };
      const result = await createTeam(input);

      const teams = await db.select()
        .from(teamsTable)
        .where(eq(teamsTable.id, result.id))
        .execute();

      expect(teams).toHaveLength(1);
      expect(teams[0].name).toEqual('Engineering Team');
      expect(teams[0].manager_id).toEqual(managerId);
    });

    it('should throw error for non-existent manager', async () => {
      const input = { ...testTeamInput, manager_id: 999 };
      
      await expect(createTeam(input)).rejects.toThrow(/manager not found/i);
    });

    it('should throw error for regular user as manager', async () => {
      const input = { ...testTeamInput, manager_id: userId };
      
      await expect(createTeam(input)).rejects.toThrow(/must be a manager or admin/i);
    });
  });

  describe('getTeams', () => {
    let teamId: number;

    beforeEach(async () => {
      // Create test team
      const teamResult = await db.insert(teamsTable)
        .values({
          name: 'Test Team',
          description: 'A test team',
          manager_id: managerId
        })
        .returning()
        .execute();
      teamId = teamResult[0].id;

      // Add user as team member
      await db.insert(teamMembersTable)
        .values({
          team_id: teamId,
          user_id: userId
        })
        .execute();
    });

    it('should return all teams for admin', async () => {
      const teams = await getTeams(adminId, 'admin');

      expect(teams).toHaveLength(1);
      expect(teams[0].name).toEqual('Test Team');
      expect(teams[0].manager_id).toEqual(managerId);
    });

    it('should return managed teams for manager', async () => {
      const teams = await getTeams(managerId, 'manager');

      expect(teams).toHaveLength(1);
      expect(teams[0].name).toEqual('Test Team');
      expect(teams[0].manager_id).toEqual(managerId);
    });

    it('should return member teams for regular user', async () => {
      const teams = await getTeams(userId, 'user');

      expect(teams).toHaveLength(1);
      expect(teams[0].name).toEqual('Test Team');
    });

    it('should return empty array for user with no teams', async () => {
      // Create another user not in any team
      const newUser = await db.insert(usersTable)
        .values({
          email: 'newuser@test.com',
          password_hash: 'hash',
          first_name: 'New',
          last_name: 'User',
          role: 'user'
        })
        .returning()
        .execute();

      const teams = await getTeams(newUser[0].id, 'user');

      expect(teams).toHaveLength(0);
    });
  });

  describe('getTeamById', () => {
    let teamId: number;

    beforeEach(async () => {
      // Create test team
      const teamResult = await db.insert(teamsTable)
        .values({
          name: 'Test Team',
          description: 'A test team',
          manager_id: managerId
        })
        .returning()
        .execute();
      teamId = teamResult[0].id;

      // Add user as team member
      await db.insert(teamMembersTable)
        .values({
          team_id: teamId,
          user_id: userId
        })
        .execute();
    });

    it('should return team for admin', async () => {
      const team = await getTeamById(teamId, adminId);

      expect(team).not.toBeNull();
      expect(team!.name).toEqual('Test Team');
      expect(team!.manager_id).toEqual(managerId);
    });

    it('should return team for manager', async () => {
      const team = await getTeamById(teamId, managerId);

      expect(team).not.toBeNull();
      expect(team!.name).toEqual('Test Team');
    });

    it('should return team for team member', async () => {
      const team = await getTeamById(teamId, userId);

      expect(team).not.toBeNull();
      expect(team!.name).toEqual('Test Team');
    });

    it('should return null for non-existent team', async () => {
      const team = await getTeamById(999, adminId);

      expect(team).toBeNull();
    });

    it('should throw error for unauthorized access', async () => {
      // Create another user not in team
      const newUser = await db.insert(usersTable)
        .values({
          email: 'newuser@test.com',
          password_hash: 'hash',
          first_name: 'New',
          last_name: 'User',
          role: 'user'
        })
        .returning()
        .execute();

      await expect(getTeamById(teamId, newUser[0].id)).rejects.toThrow(/access denied/i);
    });
  });

  describe('updateTeam', () => {
    let teamId: number;

    beforeEach(async () => {
      // Create test team
      const teamResult = await db.insert(teamsTable)
        .values({
          name: 'Test Team',
          description: 'A test team',
          manager_id: managerId
        })
        .returning()
        .execute();
      teamId = teamResult[0].id;
    });

    it('should update team as manager', async () => {
      const updateData = {
        name: 'Updated Team',
        description: 'Updated description'
      };

      const result = await updateTeam(teamId, updateData, managerId);

      expect(result.name).toEqual('Updated Team');
      expect(result.description).toEqual('Updated description');
      expect(result.manager_id).toEqual(managerId);
    });

    it('should update team as admin', async () => {
      const updateData = {
        name: 'Admin Updated Team'
      };

      const result = await updateTeam(teamId, updateData, adminId);

      expect(result.name).toEqual('Admin Updated Team');
    });

    it('should change manager', async () => {
      const updateData = {
        manager_id: adminId
      };

      const result = await updateTeam(teamId, updateData, managerId);

      expect(result.manager_id).toEqual(adminId);
    });

    it('should throw error for non-existent team', async () => {
      const updateData = { name: 'Updated' };
      
      await expect(updateTeam(999, updateData, managerId)).rejects.toThrow(/team not found/i);
    });

    it('should throw error for unauthorized user', async () => {
      const updateData = { name: 'Updated' };
      
      await expect(updateTeam(teamId, updateData, userId)).rejects.toThrow(/access denied/i);
    });

    it('should throw error for invalid new manager', async () => {
      const updateData = { manager_id: userId }; // Regular user can't be manager
      
      await expect(updateTeam(teamId, updateData, managerId)).rejects.toThrow(/must have manager or admin role/i);
    });
  });

  describe('deleteTeam', () => {
    let teamId: number;

    beforeEach(async () => {
      // Create test team
      const teamResult = await db.insert(teamsTable)
        .values({
          name: 'Test Team',
          description: 'A test team',
          manager_id: managerId
        })
        .returning()
        .execute();
      teamId = teamResult[0].id;

      // Add team members
      await db.insert(teamMembersTable)
        .values({
          team_id: teamId,
          user_id: userId
        })
        .execute();

      // Add team expense
      await db.insert(expensesTable)
        .values({
          user_id: userId,
          category_id: categoryId,
          amount: '100.00',
          description: 'Test expense',
          expense_date: '2024-01-01',
          tags: JSON.stringify([]),
          team_id: teamId
        })
        .execute();
    });

    it('should delete team as manager', async () => {
      const result = await deleteTeam(teamId, managerId);

      expect(result.success).toBe(true);

      // Verify team is deleted
      const teams = await db.select()
        .from(teamsTable)
        .where(eq(teamsTable.id, teamId))
        .execute();

      expect(teams).toHaveLength(0);
    });

    it('should delete team as admin', async () => {
      const result = await deleteTeam(teamId, adminId);

      expect(result.success).toBe(true);
    });

    it('should remove team assignment from expenses', async () => {
      await deleteTeam(teamId, managerId);

      // Check that expense team_id is set to null
      const expenses = await db.select()
        .from(expensesTable)
        .where(eq(expensesTable.user_id, userId))
        .execute();

      expect(expenses).toHaveLength(1);
      expect(expenses[0].team_id).toBeNull();
    });

    it('should delete team members', async () => {
      await deleteTeam(teamId, managerId);

      // Check that team members are deleted
      const members = await db.select()
        .from(teamMembersTable)
        .where(eq(teamMembersTable.team_id, teamId))
        .execute();

      expect(members).toHaveLength(0);
    });

    it('should throw error for non-existent team', async () => {
      await expect(deleteTeam(999, managerId)).rejects.toThrow(/team not found/i);
    });

    it('should throw error for unauthorized user', async () => {
      await expect(deleteTeam(teamId, userId)).rejects.toThrow(/access denied/i);
    });
  });

  describe('addTeamMember', () => {
    let teamId: number;

    beforeEach(async () => {
      // Create test team
      const teamResult = await db.insert(teamsTable)
        .values({
          name: 'Test Team',
          description: 'A test team',
          manager_id: managerId
        })
        .returning()
        .execute();
      teamId = teamResult[0].id;
    });

    it('should add team member as manager', async () => {
      const result = await addTeamMember(teamId, userId, managerId);

      expect(result.team_id).toEqual(teamId);
      expect(result.user_id).toEqual(userId);
      expect(result.joined_at).toBeInstanceOf(Date);
    });

    it('should add team member as admin', async () => {
      const result = await addTeamMember(teamId, userId, adminId);

      expect(result.team_id).toEqual(teamId);
      expect(result.user_id).toEqual(userId);
    });

    it('should save membership to database', async () => {
      await addTeamMember(teamId, userId, managerId);

      const memberships = await db.select()
        .from(teamMembersTable)
        .where(and(
          eq(teamMembersTable.team_id, teamId),
          eq(teamMembersTable.user_id, userId)
        ))
        .execute();

      expect(memberships).toHaveLength(1);
    });

    it('should throw error for non-existent team', async () => {
      await expect(addTeamMember(999, userId, managerId)).rejects.toThrow(/team not found/i);
    });

    it('should throw error for unauthorized manager', async () => {
      await expect(addTeamMember(teamId, userId, userId)).rejects.toThrow(/access denied/i);
    });

    it('should throw error for non-existent user', async () => {
      await expect(addTeamMember(teamId, 999, managerId)).rejects.toThrow(/user not found/i);
    });

    it('should throw error for duplicate membership', async () => {
      await addTeamMember(teamId, userId, managerId);
      
      await expect(addTeamMember(teamId, userId, managerId)).rejects.toThrow(/already a member/i);
    });
  });

  describe('removeTeamMember', () => {
    let teamId: number;

    beforeEach(async () => {
      // Create test team
      const teamResult = await db.insert(teamsTable)
        .values({
          name: 'Test Team',
          description: 'A test team',
          manager_id: managerId
        })
        .returning()
        .execute();
      teamId = teamResult[0].id;

      // Add team member
      await db.insert(teamMembersTable)
        .values({
          team_id: teamId,
          user_id: userId
        })
        .execute();

      // Add pending expense for member
      await db.insert(expensesTable)
        .values({
          user_id: userId,
          category_id: categoryId,
          amount: '100.00',
          description: 'Pending expense',
          expense_date: '2024-01-01',
          tags: JSON.stringify([]),
          team_id: teamId,
          status: 'pending'
        })
        .execute();
    });

    it('should remove team member as manager', async () => {
      const result = await removeTeamMember(teamId, userId, managerId);

      expect(result.success).toBe(true);

      // Verify membership is removed
      const memberships = await db.select()
        .from(teamMembersTable)
        .where(and(
          eq(teamMembersTable.team_id, teamId),
          eq(teamMembersTable.user_id, userId)
        ))
        .execute();

      expect(memberships).toHaveLength(0);
    });

    it('should remove team member as admin', async () => {
      const result = await removeTeamMember(teamId, userId, adminId);

      expect(result.success).toBe(true);
    });

    it('should update pending expenses to remove team assignment', async () => {
      await removeTeamMember(teamId, userId, managerId);

      // Check that pending expense team_id is set to null
      const expenses = await db.select()
        .from(expensesTable)
        .where(and(
          eq(expensesTable.user_id, userId),
          eq(expensesTable.status, 'pending')
        ))
        .execute();

      expect(expenses).toHaveLength(1);
      expect(expenses[0].team_id).toBeNull();
    });

    it('should throw error for non-existent team', async () => {
      await expect(removeTeamMember(999, userId, managerId)).rejects.toThrow(/team not found/i);
    });

    it('should throw error for unauthorized manager', async () => {
      await expect(removeTeamMember(teamId, userId, userId)).rejects.toThrow(/access denied/i);
    });

    it('should throw error for non-member user', async () => {
      // Create another user not in team
      const newUser = await db.insert(usersTable)
        .values({
          email: 'newuser@test.com',
          password_hash: 'hash',
          first_name: 'New',
          last_name: 'User',
          role: 'user'
        })
        .returning()
        .execute();

      await expect(removeTeamMember(teamId, newUser[0].id, managerId)).rejects.toThrow(/not a member/i);
    });
  });

  describe('getTeamMembers', () => {
    let teamId: number;

    beforeEach(async () => {
      // Create test team
      const teamResult = await db.insert(teamsTable)
        .values({
          name: 'Test Team',
          description: 'A test team',
          manager_id: managerId
        })
        .returning()
        .execute();
      teamId = teamResult[0].id;

      // Add team members
      await db.insert(teamMembersTable)
        .values({
          team_id: teamId,
          user_id: userId
        })
        .execute();
    });

    it('should return team members for admin', async () => {
      const members = await getTeamMembers(teamId, adminId);

      expect(members).toHaveLength(1);
      expect(members[0].user_id).toEqual(userId);
      expect(members[0].team_id).toEqual(teamId);
    });

    it('should return team members for team manager', async () => {
      const members = await getTeamMembers(teamId, managerId);

      expect(members).toHaveLength(1);
      expect(members[0].user_id).toEqual(userId);
    });

    it('should return team members for team member', async () => {
      const members = await getTeamMembers(teamId, userId);

      expect(members).toHaveLength(1);
      expect(members[0].user_id).toEqual(userId);
    });

    it('should throw error for non-existent team', async () => {
      await expect(getTeamMembers(999, managerId)).rejects.toThrow(/team not found/i);
    });

    it('should throw error for unauthorized access', async () => {
      // Create another user not in team
      const newUser = await db.insert(usersTable)
        .values({
          email: 'newuser@test.com',
          password_hash: 'hash',
          first_name: 'New',
          last_name: 'User',
          role: 'user'
        })
        .returning()
        .execute();

      await expect(getTeamMembers(teamId, newUser[0].id)).rejects.toThrow(/access denied/i);
    });
  });

  describe('getTeamExpenses', () => {
    let teamId: number;

    beforeEach(async () => {
      // Create test team
      const teamResult = await db.insert(teamsTable)
        .values({
          name: 'Test Team',
          description: 'A test team',
          manager_id: managerId
        })
        .returning()
        .execute();
      teamId = teamResult[0].id;

      // Add team member
      await db.insert(teamMembersTable)
        .values({
          team_id: teamId,
          user_id: userId
        })
        .execute();

      // Add team expenses
      await db.insert(expensesTable)
        .values([
          {
            user_id: userId,
            category_id: categoryId,
            amount: '150.50',
            description: 'Approved expense',
            expense_date: '2024-01-15',
            tags: JSON.stringify([]),
            team_id: teamId,
            status: 'approved'
          },
          {
            user_id: userId,
            category_id: categoryId,
            amount: '75.25',
            description: 'Pending expense',
            expense_date: '2024-01-20',
            tags: JSON.stringify([]),
            team_id: teamId,
            status: 'pending'
          }
        ])
        .execute();
    });

    it('should return team expense analytics for manager', async () => {
      const analytics = await getTeamExpenses(teamId, managerId);

      expect(analytics.total_expenses).toEqual(225.75);
      expect(analytics.pending_approvals).toEqual(1);
      expect(analytics.monthly_trend).toEqual([
        { month: '2024-01', amount: 225.75 }
      ]);
      expect(analytics.member_breakdown).toHaveLength(1);
      expect(analytics.member_breakdown[0].user_name).toEqual('Regular User');
      expect(analytics.member_breakdown[0].amount).toEqual(225.75);
      expect(analytics.member_breakdown[0].expense_count).toEqual(2);
    });

    it('should return team expense analytics for admin', async () => {
      const analytics = await getTeamExpenses(teamId, adminId);

      expect(analytics.total_expenses).toEqual(225.75);
      expect(analytics.pending_approvals).toEqual(1);
    });

    it('should handle team with no expenses', async () => {
      // Create new team with no expenses
      const newTeam = await db.insert(teamsTable)
        .values({
          name: 'Empty Team',
          manager_id: managerId
        })
        .returning()
        .execute();

      const analytics = await getTeamExpenses(newTeam[0].id, managerId);

      expect(analytics.total_expenses).toEqual(0);
      expect(analytics.pending_approvals).toEqual(0);
      expect(analytics.monthly_trend).toHaveLength(0);
      expect(analytics.member_breakdown).toHaveLength(0);
    });

    it('should throw error for non-existent team', async () => {
      await expect(getTeamExpenses(999, managerId)).rejects.toThrow(/team not found/i);
    });

    it('should throw error for unauthorized access', async () => {
      await expect(getTeamExpenses(teamId, userId)).rejects.toThrow(/access denied/i);
    });
  });
});