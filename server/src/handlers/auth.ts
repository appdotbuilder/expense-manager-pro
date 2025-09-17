import { db } from '../db';
import { usersTable, passwordResetTokensTable, emailVerificationTokensTable } from '../db/schema';
import { type CreateUserInput, type LoginInput, type ResetPasswordInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export const registerUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Check if user already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUser.length > 0) {
      throw new Error('User already exists with this email');
    }

    // Hash password using crypto
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.pbkdf2Sync(input.password, salt, 100000, 64, 'sha512').toString('hex') + ':' + salt;

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        first_name: input.first_name,
        last_name: input.last_name,
        role: input.role
      })
      .returning()
      .execute();

    const user = result[0];

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    await db.insert(emailVerificationTokensTable)
      .values({
        user_id: user.id,
        token: verificationToken,
        expires_at: expiresAt
      })
      .execute();

    return user;
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
};

export const loginUser = async (input: LoginInput): Promise<{ user: User; token: string }> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const [hash, salt] = user.password_hash.split(':');
    const inputHash = crypto.pbkdf2Sync(input.password, salt, 100000, 64, 'sha512').toString('hex');
    
    if (inputHash !== hash) {
      throw new Error('Invalid email or password');
    }

    // Generate session token (simplified - in production use JWT with proper signing)
    const sessionToken = crypto.randomBytes(32).toString('hex');

    return {
      user,
      token: sessionToken
    };
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
};

export const resetPassword = async (input: ResetPasswordInput): Promise<{ success: boolean; message: string }> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      // Don't reveal whether email exists or not for security
      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      };
    }

    const user = users[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Insert reset token
    await db.insert(passwordResetTokensTable)
      .values({
        user_id: user.id,
        token: resetToken,
        expires_at: expiresAt
      })
      .execute();

    return {
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    };
  } catch (error) {
    console.error('Password reset failed:', error);
    throw error;
  }
};

export const verifyEmail = async (token: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Find verification token
    const tokens = await db.select()
      .from(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.token, token))
      .execute();

    if (tokens.length === 0) {
      return {
        success: false,
        message: 'Invalid or expired verification token'
      };
    }

    const tokenRecord = tokens[0];

    // Check if token is already used
    if (tokenRecord.used) {
      return {
        success: false,
        message: 'Verification token has already been used'
      };
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expires_at) {
      return {
        success: false,
        message: 'Verification token has expired'
      };
    }

    // Mark user as verified and token as used
    await db.update(usersTable)
      .set({ email_verified: true })
      .where(eq(usersTable.id, tokenRecord.user_id))
      .execute();

    await db.update(emailVerificationTokensTable)
      .set({ used: true })
      .where(eq(emailVerificationTokensTable.id, tokenRecord.id))
      .execute();

    return {
      success: true,
      message: 'Email verified successfully'
    };
  } catch (error) {
    console.error('Email verification failed:', error);
    throw error;
  }
};

export const getCurrentUser = async (userId: number): Promise<User> => {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    return user;
  } catch (error) {
    console.error('Get current user failed:', error);
    throw error;
  }
};