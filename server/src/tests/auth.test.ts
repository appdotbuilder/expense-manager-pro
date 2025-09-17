import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, passwordResetTokensTable, emailVerificationTokensTable } from '../db/schema';
import { type CreateUserInput, type LoginInput, type ResetPasswordInput } from '../schema';
import { registerUser, loginUser, resetPassword, verifyEmail, getCurrentUser } from '../handlers/auth';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

// Test data
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'SecurePass123!',
  first_name: 'John',
  last_name: 'Doe',
  role: 'user'
};

const testManagerInput: CreateUserInput = {
  email: 'manager@example.com',
  password: 'ManagerPass456!',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'manager'
};

const loginInput: LoginInput = {
  email: 'test@example.com',
  password: 'SecurePass123!'
};

const resetPasswordInput: ResetPasswordInput = {
  email: 'test@example.com'
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user', async () => {
    const result = await registerUser(testUserInput);

    // Verify user fields
    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('user');
    expect(result.is_active).toEqual(true);
    expect(result.email_verified).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify password is hashed
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual(testUserInput.password);
    
    // Verify password hash is valid
    const [hash, salt] = result.password_hash.split(':');
    const expectedHash = crypto.pbkdf2Sync(testUserInput.password, salt, 100000, 64, 'sha512').toString('hex');
    expect(hash).toEqual(expectedHash);
  });

  it('should save user to database', async () => {
    const result = await registerUser(testUserInput);

    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].first_name).toEqual('John');
    expect(users[0].role).toEqual('user');
    expect(users[0].is_active).toEqual(true);
    expect(users[0].email_verified).toEqual(false);
  });

  it('should create email verification token', async () => {
    const result = await registerUser(testUserInput);

    const tokens = await db.select()
      .from(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.user_id, result.id))
      .execute();

    expect(tokens).toHaveLength(1);
    expect(tokens[0].token).toBeDefined();
    expect(tokens[0].used).toEqual(false);
    expect(tokens[0].expires_at).toBeInstanceOf(Date);
    expect(tokens[0].expires_at > new Date()).toBe(true);
  });

  it('should reject duplicate email', async () => {
    await registerUser(testUserInput);
    
    await expect(registerUser(testUserInput))
      .rejects.toThrow(/already exists/i);
  });

  it('should handle different user roles', async () => {
    const result = await registerUser(testManagerInput);
    
    expect(result.role).toEqual('manager');
  });
});

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should login with valid credentials', async () => {
    // Create user first
    const registeredUser = await registerUser(testUserInput);
    
    const result = await loginUser(loginInput);

    expect(result.user.id).toEqual(registeredUser.id);
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.first_name).toEqual('John');
    expect(result.user.role).toEqual('user');
    expect(result.token).toBeDefined();
    expect(typeof result.token).toEqual('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('should reject invalid email', async () => {
    await expect(loginUser({
      email: 'nonexistent@example.com',
      password: 'AnyPassword123!'
    })).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject invalid password', async () => {
    await registerUser(testUserInput);
    
    await expect(loginUser({
      email: 'test@example.com',
      password: 'WrongPassword123!'
    })).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject login for deactivated user', async () => {
    const registeredUser = await registerUser(testUserInput);
    
    // Deactivate user
    await db.update(usersTable)
      .set({ is_active: false })
      .where(eq(usersTable.id, registeredUser.id))
      .execute();

    await expect(loginUser(loginInput))
      .rejects.toThrow(/deactivated/i);
  });

  it('should generate unique tokens', async () => {
    await registerUser(testUserInput);
    
    const result1 = await loginUser(loginInput);
    const result2 = await loginUser(loginInput);

    expect(result1.token).not.toEqual(result2.token);
  });
});

describe('resetPassword', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create password reset token for existing user', async () => {
    const registeredUser = await registerUser(testUserInput);
    
    const result = await resetPassword(resetPasswordInput);

    expect(result.success).toEqual(true);
    expect(result.message).toContain('password reset link');

    const tokens = await db.select()
      .from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.user_id, registeredUser.id))
      .execute();

    expect(tokens).toHaveLength(1);
    expect(tokens[0].token).toBeDefined();
    expect(tokens[0].used).toEqual(false);
    expect(tokens[0].expires_at).toBeInstanceOf(Date);
    expect(tokens[0].expires_at > new Date()).toBe(true);
  });

  it('should not reveal whether email exists', async () => {
    const result = await resetPassword({
      email: 'nonexistent@example.com'
    });

    expect(result.success).toEqual(true);
    expect(result.message).toContain('If the email exists');
  });

  it('should create multiple reset tokens', async () => {
    const registeredUser = await registerUser(testUserInput);
    
    await resetPassword(resetPasswordInput);
    await resetPassword(resetPasswordInput);

    const tokens = await db.select()
      .from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.user_id, registeredUser.id))
      .orderBy(desc(passwordResetTokensTable.created_at))
      .execute();

    expect(tokens).toHaveLength(2);
    expect(tokens[0].token).not.toEqual(tokens[1].token);
  });
});

describe('verifyEmail', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should verify email with valid token', async () => {
    const registeredUser = await registerUser(testUserInput);
    
    // Get the verification token
    const tokens = await db.select()
      .from(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.user_id, registeredUser.id))
      .execute();

    const token = tokens[0].token;
    
    const result = await verifyEmail(token);

    expect(result.success).toEqual(true);
    expect(result.message).toContain('verified successfully');

    // Check user is marked as verified
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, registeredUser.id))
      .execute();

    expect(users[0].email_verified).toEqual(true);

    // Check token is marked as used
    const updatedTokens = await db.select()
      .from(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.token, token))
      .execute();

    expect(updatedTokens[0].used).toEqual(true);
  });

  it('should reject invalid token', async () => {
    const result = await verifyEmail('invalid-token-123');

    expect(result.success).toEqual(false);
    expect(result.message).toContain('Invalid or expired');
  });

  it('should reject already used token', async () => {
    const registeredUser = await registerUser(testUserInput);
    
    const tokens = await db.select()
      .from(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.user_id, registeredUser.id))
      .execute();

    const token = tokens[0].token;
    
    // Use token first time
    await verifyEmail(token);
    
    // Try to use again
    const result = await verifyEmail(token);

    expect(result.success).toEqual(false);
    expect(result.message).toContain('already been used');
  });

  it('should reject expired token', async () => {
    const registeredUser = await registerUser(testUserInput);
    
    const tokens = await db.select()
      .from(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.user_id, registeredUser.id))
      .execute();

    // Expire the token
    const expiredDate = new Date();
    expiredDate.setHours(expiredDate.getHours() - 1);

    await db.update(emailVerificationTokensTable)
      .set({ expires_at: expiredDate })
      .where(eq(emailVerificationTokensTable.id, tokens[0].id))
      .execute();

    const result = await verifyEmail(tokens[0].token);

    expect(result.success).toEqual(false);
    expect(result.message).toContain('expired');
  });
});

describe('getCurrentUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get current user data', async () => {
    const registeredUser = await registerUser(testUserInput);
    
    const result = await getCurrentUser(registeredUser.id);

    expect(result.id).toEqual(registeredUser.id);
    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('user');
    expect(result.is_active).toEqual(true);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should reject nonexistent user', async () => {
    await expect(getCurrentUser(99999))
      .rejects.toThrow(/not found/i);
  });

  it('should reject deactivated user', async () => {
    const registeredUser = await registerUser(testUserInput);
    
    // Deactivate user
    await db.update(usersTable)
      .set({ is_active: false })
      .where(eq(usersTable.id, registeredUser.id))
      .execute();

    await expect(getCurrentUser(registeredUser.id))
      .rejects.toThrow(/deactivated/i);
  });

  it('should get user with different roles', async () => {
    const managerUser = await registerUser(testManagerInput);
    
    const result = await getCurrentUser(managerUser.id);

    expect(result.role).toEqual('manager');
    expect(result.email).toEqual('manager@example.com');
    expect(result.first_name).toEqual('Jane');
  });
});