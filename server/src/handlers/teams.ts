import { db } from '../db';
import { teamsTable, teamMembersTable, usersTable, expensesTable } from '../db/schema';
import { type CreateTeamInput, type Team, type TeamMember } from '../schema';
import { eq, and, or, sql, desc, gte, SQL } from 'drizzle-orm';

export async function createTeam(input: CreateTeamInput): Promise<Team> {
  try {
    // Verify manager exists and has appropriate role
    const manager = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.manager_id))
      .execute();

    if (manager.length === 0) {
      throw new Error('Manager not found');
    }

    if (manager[0].role !== 'manager' && manager[0].role !== 'admin') {
      throw new Error('User must be a manager or admin to manage teams');
    }

    // Create team
    const result = await db.insert(teamsTable)
      .values({
        name: input.name,
        description: input.description || null,
        manager_id: input.manager_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Team creation failed:', error);
    throw error;
  }
}

export async function getTeams(userId: number, userRole: string): Promise<Team[]> {
  try {
    let query = db.select().from(teamsTable);

    if (userRole === 'admin') {
      // Admins see all teams
      const results = await query.execute();
      return results;
    } else if (userRole === 'manager') {
      // Managers see teams they manage
      const results = await query
        .where(eq(teamsTable.manager_id, userId))
        .execute();
      return results;
    } else {
      // Regular users see teams they belong to
      const results = await db.select({
        id: teamsTable.id,
        name: teamsTable.name,
        description: teamsTable.description,
        manager_id: teamsTable.manager_id,
        created_at: teamsTable.created_at,
        updated_at: teamsTable.updated_at
      })
      .from(teamsTable)
      .innerJoin(teamMembersTable, eq(teamsTable.id, teamMembersTable.team_id))
      .where(eq(teamMembersTable.user_id, userId))
      .execute();

      return results;
    }
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    throw error;
  }
}

export async function getTeamById(teamId: number, userId: number): Promise<Team | null> {
  try {
    // First get the team
    const teams = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .execute();

    if (teams.length === 0) {
      return null;
    }

    const team = teams[0];

    // Check access rights
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const userRole = user[0].role;

    // Access control
    if (userRole !== 'admin' && team.manager_id !== userId) {
      // Check if user is a team member
      const membership = await db.select()
        .from(teamMembersTable)
        .where(and(
          eq(teamMembersTable.team_id, teamId),
          eq(teamMembersTable.user_id, userId)
        ))
        .execute();

      if (membership.length === 0) {
        throw new Error('Access denied: You are not authorized to view this team');
      }
    }

    return team;
  } catch (error) {
    console.error('Failed to fetch team:', error);
    throw error;
  }
}

export async function updateTeam(teamId: number, input: Partial<CreateTeamInput>, userId: number): Promise<Team> {
  try {
    // Verify team exists and user has permission
    const teams = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .execute();

    if (teams.length === 0) {
      throw new Error('Team not found');
    }

    const team = teams[0];

    // Check user permissions
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const userRole = user[0].role;

    if (userRole !== 'admin' && team.manager_id !== userId) {
      throw new Error('Access denied: Only team managers or admins can update teams');
    }

    // If changing manager, verify new manager exists and has proper role
    if (input.manager_id && input.manager_id !== team.manager_id) {
      const newManager = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, input.manager_id))
        .execute();

      if (newManager.length === 0) {
        throw new Error('New manager not found');
      }

      if (newManager[0].role !== 'manager' && newManager[0].role !== 'admin') {
        throw new Error('New manager must have manager or admin role');
      }
    }

    // Update team
    const updateData: any = { updated_at: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.manager_id !== undefined) updateData.manager_id = input.manager_id;

    const result = await db.update(teamsTable)
      .set(updateData)
      .where(eq(teamsTable.id, teamId))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Team update failed:', error);
    throw error;
  }
}

export async function deleteTeam(teamId: number, userId: number): Promise<{ success: boolean }> {
  try {
    // Verify team exists and user has permission
    const teams = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .execute();

    if (teams.length === 0) {
      throw new Error('Team not found');
    }

    const team = teams[0];

    // Check user permissions
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const userRole = user[0].role;

    if (userRole !== 'admin' && team.manager_id !== userId) {
      throw new Error('Access denied: Only team managers or admins can delete teams');
    }

    // Update existing team expenses to remove team assignment (preserve historical data)
    await db.update(expensesTable)
      .set({ team_id: null })
      .where(eq(expensesTable.team_id, teamId))
      .execute();

    // Delete team members first (due to foreign key constraints)
    await db.delete(teamMembersTable)
      .where(eq(teamMembersTable.team_id, teamId))
      .execute();

    // Delete the team
    await db.delete(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Team deletion failed:', error);
    throw error;
  }
}

export async function addTeamMember(teamId: number, userId: number, managerId: number): Promise<TeamMember> {
  try {
    // Verify team exists and requester has permission
    const teams = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .execute();

    if (teams.length === 0) {
      throw new Error('Team not found');
    }

    const team = teams[0];

    // Check requester permissions
    const manager = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, managerId))
      .execute();

    if (manager.length === 0) {
      throw new Error('Manager not found');
    }

    const managerRole = manager[0].role;

    if (managerRole !== 'admin' && team.manager_id !== managerId) {
      throw new Error('Access denied: Only team managers or admins can add members');
    }

    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Check if user is already a member
    const existingMembership = await db.select()
      .from(teamMembersTable)
      .where(and(
        eq(teamMembersTable.team_id, teamId),
        eq(teamMembersTable.user_id, userId)
      ))
      .execute();

    if (existingMembership.length > 0) {
      throw new Error('User is already a member of this team');
    }

    // Add team member
    const result = await db.insert(teamMembersTable)
      .values({
        team_id: teamId,
        user_id: userId
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Failed to add team member:', error);
    throw error;
  }
}

export async function removeTeamMember(teamId: number, userId: number, managerId: number): Promise<{ success: boolean }> {
  try {
    // Verify team exists and requester has permission
    const teams = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .execute();

    if (teams.length === 0) {
      throw new Error('Team not found');
    }

    const team = teams[0];

    // Check requester permissions
    const manager = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, managerId))
      .execute();

    if (manager.length === 0) {
      throw new Error('Manager not found');
    }

    const managerRole = manager[0].role;

    if (managerRole !== 'admin' && team.manager_id !== managerId) {
      throw new Error('Access denied: Only team managers or admins can remove members');
    }

    // Verify membership exists
    const membership = await db.select()
      .from(teamMembersTable)
      .where(and(
        eq(teamMembersTable.team_id, teamId),
        eq(teamMembersTable.user_id, userId)
      ))
      .execute();

    if (membership.length === 0) {
      throw new Error('User is not a member of this team');
    }

    // Update pending team expenses to remove team assignment
    await db.update(expensesTable)
      .set({ team_id: null })
      .where(and(
        eq(expensesTable.team_id, teamId),
        eq(expensesTable.user_id, userId),
        eq(expensesTable.status, 'pending')
      ))
      .execute();

    // Remove team member
    await db.delete(teamMembersTable)
      .where(and(
        eq(teamMembersTable.team_id, teamId),
        eq(teamMembersTable.user_id, userId)
      ))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Failed to remove team member:', error);
    throw error;
  }
}

export async function getTeamMembers(teamId: number, requesterId: number): Promise<TeamMember[]> {
  try {
    // Verify team exists and requester has access
    const teams = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .execute();

    if (teams.length === 0) {
      throw new Error('Team not found');
    }

    const team = teams[0];

    // Check requester permissions
    const requester = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, requesterId))
      .execute();

    if (requester.length === 0) {
      throw new Error('Requester not found');
    }

    const requesterRole = requester[0].role;

    // Access control
    if (requesterRole !== 'admin' && team.manager_id !== requesterId) {
      // Check if requester is a team member
      const membership = await db.select()
        .from(teamMembersTable)
        .where(and(
          eq(teamMembersTable.team_id, teamId),
          eq(teamMembersTable.user_id, requesterId)
        ))
        .execute();

      if (membership.length === 0) {
        throw new Error('Access denied: You are not authorized to view team members');
      }
    }

    // Get team members
    const members = await db.select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.team_id, teamId))
      .execute();

    return members;
  } catch (error) {
    console.error('Failed to fetch team members:', error);
    throw error;
  }
}

export async function getTeamExpenses(teamId: number, managerId: number): Promise<{
  total_expenses: number;
  pending_approvals: number;
  monthly_trend: Array<{ month: string; amount: number }>;
  member_breakdown: Array<{ user_name: string; amount: number; expense_count: number }>;
}> {
  try {
    // Verify team exists and requester has permission
    const teams = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .execute();

    if (teams.length === 0) {
      throw new Error('Team not found');
    }

    const team = teams[0];

    // Check requester permissions
    const manager = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, managerId))
      .execute();

    if (manager.length === 0) {
      throw new Error('Manager not found');
    }

    const managerRole = manager[0].role;

    if (managerRole !== 'admin' && team.manager_id !== managerId) {
      throw new Error('Access denied: Only team managers or admins can view team expenses');
    }

    // Get total expenses
    const totalResult = await db.select({
      total: sql<string>`SUM(${expensesTable.amount})::text`
    })
    .from(expensesTable)
    .where(eq(expensesTable.team_id, teamId))
    .execute();

    const totalExpenses = totalResult[0]?.total ? parseFloat(totalResult[0].total) : 0;

    // Get pending approvals count
    const pendingResult = await db.select({
      count: sql<string>`COUNT(*)::text`
    })
    .from(expensesTable)
    .where(and(
      eq(expensesTable.team_id, teamId),
      eq(expensesTable.status, 'pending')
    ))
    .execute();

    const pendingApprovals = pendingResult[0]?.count ? parseInt(pendingResult[0].count) : 0;

    // Get monthly trend (all time for simplicity)
    const monthlyResult = await db.select({
      month: sql<string>`TO_CHAR(${expensesTable.expense_date}, 'YYYY-MM')`,
      amount: sql<string>`SUM(${expensesTable.amount})::text`
    })
    .from(expensesTable)
    .where(eq(expensesTable.team_id, teamId))
    .groupBy(sql`TO_CHAR(${expensesTable.expense_date}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${expensesTable.expense_date}, 'YYYY-MM')`)
    .execute();

    const monthlyTrend = monthlyResult.map(row => ({
      month: row.month,
      amount: parseFloat(row.amount)
    }));

    // Get member breakdown
    const memberResult = await db.select({
      user_name: sql<string>`${usersTable.first_name} || ' ' || ${usersTable.last_name}`,
      amount: sql<string>`COALESCE(SUM(${expensesTable.amount}), 0)::text`,
      expense_count: sql<string>`COUNT(${expensesTable.id})::text`
    })
    .from(teamMembersTable)
    .innerJoin(usersTable, eq(teamMembersTable.user_id, usersTable.id))
    .leftJoin(expensesTable, and(
      eq(expensesTable.user_id, usersTable.id),
      eq(expensesTable.team_id, teamId)
    ))
    .where(eq(teamMembersTable.team_id, teamId))
    .groupBy(usersTable.id, usersTable.first_name, usersTable.last_name)
    .execute();

    const memberBreakdown = memberResult.map(row => ({
      user_name: row.user_name,
      amount: parseFloat(row.amount),
      expense_count: parseInt(row.expense_count)
    }));

    return {
      total_expenses: totalExpenses,
      pending_approvals: pendingApprovals,
      monthly_trend: monthlyTrend,
      member_breakdown: memberBreakdown
    };
  } catch (error) {
    console.error('Failed to get team expenses:', error);
    throw error;
  }
}