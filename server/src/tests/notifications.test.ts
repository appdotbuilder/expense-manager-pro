import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, notificationsTable } from '../db/schema';
import { type CreateNotificationInput } from '../schema';
import {
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
  sendBudgetAlert,
  sendApprovalRequest,
  sendApprovalResult,
  sendSystemUpdate
} from '../handlers/notifications';
import { eq } from 'drizzle-orm';

// Test data
let testUserId: number;
let testUser2Id: number;

const testNotificationInput: CreateNotificationInput = {
  user_id: 1, // Will be updated with actual user ID
  type: 'budget_alert',
  title: 'Test Notification',
  message: 'This is a test notification',
  metadata: { test_data: 'test_value' }
};

describe('Notifications', () => {
  beforeEach(async () => {
    await createDB();

    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'test@example.com',
          password_hash: 'hash1',
          first_name: 'Test',
          last_name: 'User',
          role: 'user'
        },
        {
          email: 'test2@example.com',
          password_hash: 'hash2',
          first_name: 'Test2',
          last_name: 'User2',
          role: 'manager'
        }
      ])
      .returning({ id: usersTable.id })
      .execute();

    testUserId = users[0].id;
    testUser2Id = users[1].id;
    testNotificationInput.user_id = testUserId;
  });

  afterEach(resetDB);

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      const result = await createNotification(testNotificationInput);

      expect(result.user_id).toEqual(testUserId);
      expect(result.type).toEqual('budget_alert');
      expect(result.title).toEqual('Test Notification');
      expect(result.message).toEqual('This is a test notification');
      expect(result.is_read).toEqual(false);
      expect(result.metadata).toEqual({ test_data: 'test_value' });
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save notification to database', async () => {
      const result = await createNotification(testNotificationInput);

      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, result.id))
        .execute();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].user_id).toEqual(testUserId);
      expect(notifications[0].type).toEqual('budget_alert');
      expect(notifications[0].title).toEqual('Test Notification');
      expect(notifications[0].is_read).toEqual(false);
    });

    it('should create notification without metadata', async () => {
      const inputWithoutMetadata = {
        ...testNotificationInput,
        metadata: undefined
      };

      const result = await createNotification(inputWithoutMetadata);

      expect(result.metadata).toBeNull();
    });
  });

  describe('getNotifications', () => {
    it('should get all user notifications', async () => {
      // Create multiple notifications
      await createNotification(testNotificationInput);
      await createNotification({
        ...testNotificationInput,
        title: 'Second Notification'
      });

      const notifications = await getNotifications(testUserId);

      expect(notifications).toHaveLength(2);
      expect(notifications[0].title).toEqual('Second Notification'); // Most recent first
      expect(notifications[1].title).toEqual('Test Notification');
    });

    it('should get only unread notifications when unreadOnly is true', async () => {
      // Create notifications
      const notification1 = await createNotification(testNotificationInput);
      await createNotification({
        ...testNotificationInput,
        title: 'Unread Notification'
      });

      // Mark one as read
      await db.update(notificationsTable)
        .set({ is_read: true })
        .where(eq(notificationsTable.id, notification1.id))
        .execute();

      const unreadNotifications = await getNotifications(testUserId, true);

      expect(unreadNotifications).toHaveLength(1);
      expect(unreadNotifications[0].title).toEqual('Unread Notification');
      expect(unreadNotifications[0].is_read).toEqual(false);
    });

    it('should return empty array for user with no notifications', async () => {
      const notifications = await getNotifications(testUser2Id);
      expect(notifications).toHaveLength(0);
    });

    it('should not return notifications for other users', async () => {
      // Create notification for user 1
      await createNotification(testNotificationInput);

      // Try to get notifications for user 2
      const notifications = await getNotifications(testUser2Id);
      expect(notifications).toHaveLength(0);
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read', async () => {
      const notification = await createNotification(testNotificationInput);

      const result = await markNotificationAsRead(notification.id, testUserId);

      expect(result.success).toBe(true);

      // Verify in database
      const updatedNotification = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, notification.id))
        .execute();

      expect(updatedNotification[0].is_read).toBe(true);
    });

    it('should return false for non-existent notification', async () => {
      const result = await markNotificationAsRead(999, testUserId);
      expect(result.success).toBe(false);
    });

    it('should return false when user tries to mark another users notification', async () => {
      const notification = await createNotification(testNotificationInput);

      const result = await markNotificationAsRead(notification.id, testUser2Id);
      expect(result.success).toBe(false);
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      // Create multiple unread notifications
      await createNotification(testNotificationInput);
      await createNotification({
        ...testNotificationInput,
        title: 'Second Notification'
      });

      const result = await markAllNotificationsAsRead(testUserId);

      expect(result.success).toBe(true);
      expect(result.count).toEqual(2);

      // Verify all are marked as read
      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.user_id, testUserId))
        .execute();

      expect(notifications.every(n => n.is_read)).toBe(true);
    });

    it('should return zero count when no unread notifications exist', async () => {
      const result = await markAllNotificationsAsRead(testUserId);

      expect(result.success).toBe(true);
      expect(result.count).toEqual(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      const notification = await createNotification(testNotificationInput);

      const result = await deleteNotification(notification.id, testUserId);

      expect(result.success).toBe(true);

      // Verify deletion
      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, notification.id))
        .execute();

      expect(notifications).toHaveLength(0);
    });

    it('should return false for non-existent notification', async () => {
      const result = await deleteNotification(999, testUserId);
      expect(result.success).toBe(false);
    });

    it('should return false when user tries to delete another users notification', async () => {
      const notification = await createNotification(testNotificationInput);

      const result = await deleteNotification(notification.id, testUser2Id);
      expect(result.success).toBe(false);
    });
  });

  describe('getUnreadCount', () => {
    it('should return correct unread count', async () => {
      // Create multiple notifications, some read, some unread
      const notification1 = await createNotification(testNotificationInput);
      await createNotification({
        ...testNotificationInput,
        title: 'Unread 1'
      });
      await createNotification({
        ...testNotificationInput,
        title: 'Unread 2'
      });

      // Mark one as read
      await db.update(notificationsTable)
        .set({ is_read: true })
        .where(eq(notificationsTable.id, notification1.id))
        .execute();

      const result = await getUnreadCount(testUserId);

      expect(result.count).toEqual(2);
    });

    it('should return zero for user with no notifications', async () => {
      const result = await getUnreadCount(testUser2Id);
      expect(result.count).toEqual(0);
    });
  });

  describe('sendBudgetAlert', () => {
    it('should create budget alert notification', async () => {
      await sendBudgetAlert(testUserId, 123, 85);

      const notifications = await getNotifications(testUserId);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toEqual('budget_alert');
      expect(notifications[0].title).toEqual('Budget Alert');
      expect(notifications[0].message).toContain('85% utilized');
      expect(notifications[0].metadata).toEqual({
        budget_id: 123,
        utilization_percentage: 85,
        alert_type: 'budget_threshold'
      });
    });
  });

  describe('sendApprovalRequest', () => {
    it('should create approval request notification', async () => {
      await sendApprovalRequest(456, testUser2Id, 'John Doe', 150.75);

      const notifications = await getNotifications(testUser2Id);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toEqual('approval_request');
      expect(notifications[0].title).toEqual('Expense Approval Request');
      expect(notifications[0].message).toContain('John Doe has submitted an expense of $150.75');
      expect(notifications[0].metadata).toEqual({
        expense_id: 456,
        submitter_name: 'John Doe',
        amount: 150.75,
        action_type: 'approval_request'
      });
    });
  });

  describe('sendApprovalResult', () => {
    it('should create approval result notification for approved expense', async () => {
      await sendApprovalResult(789, testUserId, 'approved', 'Jane Smith', 'Looks good!');

      const notifications = await getNotifications(testUserId);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toEqual('expense_approved');
      expect(notifications[0].title).toEqual('Expense Approved');
      expect(notifications[0].message).toContain('approved by Jane Smith');
      expect(notifications[0].message).toContain('Notes: Looks good!');
      expect(notifications[0].metadata).toEqual({
        expense_id: 789,
        status: 'approved',
        approver_name: 'Jane Smith',
        notes: 'Looks good!',
        action_type: 'approval_result'
      });
    });

    it('should create approval result notification for rejected expense', async () => {
      await sendApprovalResult(890, testUserId, 'rejected', 'Jane Smith');

      const notifications = await getNotifications(testUserId);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toEqual('expense_rejected');
      expect(notifications[0].title).toEqual('Expense Rejected');
      expect(notifications[0].message).toContain('rejected by Jane Smith');
      expect(notifications[0].metadata?.['notes']).toBeNull();
    });
  });

  describe('sendSystemUpdate', () => {
    it('should create system update notifications for multiple users', async () => {
      const userIds = [testUserId, testUser2Id];
      const title = 'System Maintenance';
      const message = 'Scheduled maintenance tonight';
      const metadata = { maintenance_window: '10:00 PM - 2:00 AM' };

      await sendSystemUpdate(userIds, title, message, metadata);

      // Check notifications for both users
      const user1Notifications = await getNotifications(testUserId);
      const user2Notifications = await getNotifications(testUser2Id);

      expect(user1Notifications).toHaveLength(1);
      expect(user2Notifications).toHaveLength(1);

      [user1Notifications[0], user2Notifications[0]].forEach(notification => {
        expect(notification.type).toEqual('system_update');
        expect(notification.title).toEqual('System Maintenance');
        expect(notification.message).toEqual('Scheduled maintenance tonight');
        expect(notification.metadata).toEqual({ maintenance_window: '10:00 PM - 2:00 AM' });
      });
    });

    it('should create system update notifications without metadata', async () => {
      await sendSystemUpdate([testUserId], 'Update', 'New features available');

      const notifications = await getNotifications(testUserId);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].metadata).toBeNull();
    });
  });
});