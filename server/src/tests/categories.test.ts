import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { type CreateCategoryInput } from '../schema';
import { createCategory } from '../handlers/categories';
import { eq } from 'drizzle-orm';

// Test input with all required fields and defaults
const testInput: CreateCategoryInput = {
  name: 'Office Supplies',
  description: 'General office and administrative supplies',
  color: '#FF6B6B',
  icon: 'office',
  parent_id: null
};

describe('createCategory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a category with all fields', async () => {
    const result = await createCategory(testInput);

    // Basic field validation
    expect(result.name).toEqual('Office Supplies');
    expect(result.description).toEqual('General office and administrative supplies');
    expect(result.color).toEqual('#FF6B6B');
    expect(result.icon).toEqual('office');
    expect(result.parent_id).toBeNull();
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a category with minimal fields and defaults', async () => {
    const minimalInput: CreateCategoryInput = {
      name: 'Travel',
      color: '#8B5CF6' // Default color from schema
    };

    const result = await createCategory(minimalInput);

    expect(result.name).toEqual('Travel');
    expect(result.description).toBeNull();
    expect(result.color).toEqual('#8B5CF6');
    expect(result.icon).toBeNull();
    expect(result.parent_id).toBeNull();
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save category to database', async () => {
    const result = await createCategory(testInput);

    // Query database to verify category was saved
    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, result.id))
      .execute();

    expect(categories).toHaveLength(1);
    expect(categories[0].name).toEqual('Office Supplies');
    expect(categories[0].description).toEqual('General office and administrative supplies');
    expect(categories[0].color).toEqual('#FF6B6B');
    expect(categories[0].icon).toEqual('office');
    expect(categories[0].parent_id).toBeNull();
    expect(categories[0].is_active).toBe(true);
    expect(categories[0].created_at).toBeInstanceOf(Date);
  });

  it('should create a subcategory with valid parent', async () => {
    // Create parent category first
    const parentCategory = await createCategory({
      name: 'Transportation',
      color: '#4ECDC4'
    });

    // Create subcategory
    const subcategoryInput: CreateCategoryInput = {
      name: 'Taxi & Rideshare',
      description: 'Uber, Lyft, and taxi expenses',
      color: '#45B7D1',
      icon: 'car',
      parent_id: parentCategory.id
    };

    const result = await createCategory(subcategoryInput);

    expect(result.name).toEqual('Taxi & Rideshare');
    expect(result.parent_id).toEqual(parentCategory.id);
    expect(result.id).toBeDefined();
    expect(result.is_active).toBe(true);

    // Verify in database
    const subcategories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.parent_id, parentCategory.id))
      .execute();

    expect(subcategories).toHaveLength(1);
    expect(subcategories[0].name).toEqual('Taxi & Rideshare');
  });

  it('should reject creation with non-existent parent category', async () => {
    const invalidInput: CreateCategoryInput = {
      name: 'Invalid Subcategory',
      color: '#FF0000',
      parent_id: 99999 // Non-existent parent ID
    };

    await expect(createCategory(invalidInput)).rejects.toThrow(/parent category not found/i);
  });

  it('should reject creation with inactive parent category', async () => {
    // Create parent category
    const parentCategory = await createCategory({
      name: 'Inactive Parent',
      color: '#999999'
    });

    // Manually deactivate parent in database
    await db.update(categoriesTable)
      .set({ is_active: false })
      .where(eq(categoriesTable.id, parentCategory.id))
      .execute();

    const subcategoryInput: CreateCategoryInput = {
      name: 'Child of Inactive',
      color: '#FF0000',
      parent_id: parentCategory.id
    };

    await expect(createCategory(subcategoryInput)).rejects.toThrow(/cannot create subcategory under inactive parent/i);
  });

  it('should handle optional fields correctly', async () => {
    // Test with description but no icon
    const inputWithDescription: CreateCategoryInput = {
      name: 'Marketing',
      description: 'Advertising and promotional expenses',
      color: '#9B59B6'
    };

    const result1 = await createCategory(inputWithDescription);
    expect(result1.description).toEqual('Advertising and promotional expenses');
    expect(result1.icon).toBeNull();

    // Test with icon but no description
    const inputWithIcon: CreateCategoryInput = {
      name: 'Technology',
      color: '#3498DB',
      icon: 'laptop'
    };

    const result2 = await createCategory(inputWithIcon);
    expect(result2.description).toBeNull();
    expect(result2.icon).toEqual('laptop');
  });

  it('should create multiple categories with same parent', async () => {
    // Create parent category
    const parentCategory = await createCategory({
      name: 'Food & Dining',
      color: '#E67E22'
    });

    // Create multiple subcategories
    const subcategory1 = await createCategory({
      name: 'Restaurants',
      color: '#E74C3C',
      parent_id: parentCategory.id
    });

    const subcategory2 = await createCategory({
      name: 'Groceries',
      color: '#27AE60',
      parent_id: parentCategory.id
    });

    // Verify both subcategories exist
    const subcategories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.parent_id, parentCategory.id))
      .execute();

    expect(subcategories).toHaveLength(2);
    expect(subcategories.map(c => c.name)).toContain('Restaurants');
    expect(subcategories.map(c => c.name)).toContain('Groceries');
  });

  it('should handle special characters in category names', async () => {
    const specialInput: CreateCategoryInput = {
      name: 'R&D / Research & Development',
      description: 'Research, development & innovation costs',
      color: '#8E44AD'
    };

    const result = await createCategory(specialInput);

    expect(result.name).toEqual('R&D / Research & Development');
    expect(result.description).toEqual('Research, development & innovation costs');

    // Verify in database
    const saved = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, result.id))
      .execute();

    expect(saved[0].name).toEqual('R&D / Research & Development');
  });
});