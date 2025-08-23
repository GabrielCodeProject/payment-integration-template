#!/usr/bin/env tsx

/**
 * Script to check the actual database schema
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseSchema() {
  // Checking actual database schema
  
  try {
    // Check users table columns
    const userColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `;

    // Users table columns
    (userColumns as unknown[]).forEach(_col => {
      // Column: ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})
    });

    // Check for hashedPassword specifically
    const hashedPasswordColumn = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'hashedPassword'
    `;

    // HashedPassword column check
    if ((hashedPasswordColumn as unknown[]).length === 0) {
      // hashedPassword column does NOT exist in database
    } else {
      // hashedPassword column still exists in database
    }

    // Check accounts table to verify BetterAuth structure
    const accountColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'accounts' 
      ORDER BY ordinal_position
    `;

    // Accounts table columns (BetterAuth)
    (accountColumns as unknown[]).forEach(_col => {
      // Column: ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})
    });

  } catch (_error) {
    // Error checking database schema: error
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseSchema();