import { db } from '../db';
import { notificationsTable } from '../db/schema';
import { type CreateNotificationInput, type Notification } from '../schema';
import { eq, and, desc, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  try {
    const result = await db.insert(notificationsTable)
      .values({
        user_id: input.user_id,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata || null
      })
      .returning()
      .execute();

    const notification = result[0];
    return {
      ...notification,
      metadata: notification.metadata as Record<string, any> | null
    };
  } catch (error) {
    console.error('Notification creation failed:', error);
    throw error;
  }
}

export async function getNotifications(userId: number, unreadOnly: boolean = false): Promise<Notification[]> {
  try {
    const conditions: SQL<unknown>[] = [eq(notificationsTable.user_id, userId)];

    if (unreadOnly) {
      conditions.push(eq(notificationsTable.is_read, false));
    }

    const results = await db.select()
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.created_at))
      .execute();

    return results.map(notification => ({
      ...notification,
      metadata: notification.metadata as Record<string, any> | null
    }));
  } catch (error) {
    console.error('Get notifications failed:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: number, userId: number): Promise<{ success: boolean }> {
  try {
    const result = await db.update(notificationsTable)
      .set({ is_read: true })
      .where(and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.user_id, userId)
      ))
      .returning({ id: notificationsTable.id })
      .execute();

    return { success: result.length > 0 };
  } catch (error) {
    console.error('Mark notification as read failed:', error);
    throw error;
  }
}

export async function markAllNotificationsAsRead(userId: number): Promise<{ success: boolean; count: number }> {
  try {
    const result = await db.update(notificationsTable)
      .set({ is_read: true })
      .where(and(
        eq(notificationsTable.user_id, userId),
        eq(notificationsTable.is_read, false)
      ))
      .returning({ id: notificationsTable.id })
      .execute();

    return { success: true, count: result.length };
  } catch (error) {
    console.error('Mark all notifications as read failed:', error);
    throw error;
  }
}

export async function deleteNotification(notificationId: number, userId: number): Promise<{ success: boolean }> {
  try {
    const result = await db.delete(notificationsTable)
      .where(and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.user_id, userId)
      ))
      .returning({ id: notificationsTable.id })
      .execute();

    return { success: result.length > 0 };
  } catch (error) {
    console.error('Delete notification failed:', error);
    throw error;
  }
}

export async function getUnreadCount(userId: number): Promise<{ count: number }> {
  try {
    const result = await db.select({ count: count() })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.user_id, userId),
        eq(notificationsTable.is_read, false)
      ))
      .execute();

    return { count: result[0].count };
  } catch (error) {
    console.error('Get unread count failed:', error);
    throw error;
  }
}

export async function sendBudgetAlert(userId: number, budgetId: number, utilizationPercentage: number): Promise<void> {
  try {
    const title = 'Budget Alert';
    const message = `Your budget is ${utilizationPercentage}% utilized. Consider reviewing your spending.`;
    const metadata = {
      budget_id: budgetId,
      utilization_percentage: utilizationPercentage,
      alert_type: 'budget_threshold'
    };

    await createNotification({
      user_id: userId,
      type: 'budget_alert',
      title,
      message,
      metadata
    });
  } catch (error) {
    console.error('Send budget alert failed:', error);
    throw error;
  }
}

export async function sendApprovalRequest(expenseId: number, managerId: number, submitterName: string, amount: number): Promise<void> {
  try {
    const title = 'Expense Approval Request';
    const message = `${submitterName} has submitted an expense of $${amount.toFixed(2)} for approval.`;
    const metadata = {
      expense_id: expenseId,
      submitter_name: submitterName,
      amount,
      action_type: 'approval_request'
    };

    await createNotification({
      user_id: managerId,
      type: 'approval_request',
      title,
      message,
      metadata
    });
  } catch (error) {
    console.error('Send approval request failed:', error);
    throw error;
  }
}

export async function sendApprovalResult(expenseId: number, userId: number, status: 'approved' | 'rejected', approverName: string, notes?: string): Promise<void> {
  try {
    const title = `Expense ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    let message = `Your expense has been ${status} by ${approverName}.`;
    if (notes) {
      message += ` Notes: ${notes}`;
    }

    const metadata = {
      expense_id: expenseId,
      status,
      approver_name: approverName,
      notes: notes || null,
      action_type: 'approval_result'
    };

    await createNotification({
      user_id: userId,
      type: status === 'approved' ? 'expense_approved' : 'expense_rejected',
      title,
      message,
      metadata
    });
  } catch (error) {
    console.error('Send approval result failed:', error);
    throw error;
  }
}

export async function sendSystemUpdate(userIds: number[], title: string, message: string, metadata?: any): Promise<void> {
  try {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type: 'system_update' as const,
      title,
      message,
      metadata: metadata || null
    }));

    await db.insert(notificationsTable)
      .values(notifications)
      .execute();
  } catch (error) {
    console.error('Send system update failed:', error);
    throw error;
  }
}