#!/usr/bin/env tsx

/**
 * Script to check the actual database schema
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseSchema() {
  console.log('🔍 Checking actual database schema...\n');
  
  try {
    // Check users table columns
    const userColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `;

    console.log('📋 Users table columns:');
    console.log('======================');
    (userColumns as any[]).forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check for hashedPassword specifically
    const hashedPasswordColumn = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'hashedPassword'
    `;

    console.log('\n🔍 HashedPassword column check:');
    console.log('===============================');
    if ((hashedPasswordColumn as any[]).length === 0) {
      console.log('✅ hashedPassword column does NOT exist in database');
    } else {
      console.log('❌ hashedPassword column still exists in database');
    }

    // Check accounts table to verify BetterAuth structure
    const accountColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'accounts' 
      ORDER BY ordinal_position
    `;

    console.log('\n📋 Accounts table columns (BetterAuth):');
    console.log('=====================================');
    (accountColumns as any[]).forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

  } catch (error) {
    console.error('❌ Error checking database schema:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseSchema();