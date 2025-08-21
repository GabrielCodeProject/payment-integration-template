#!/usr/bin/env tsx

/**
 * Script to analyze current authentication state
 * This will help us understand which users to keep vs delete
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeAuthState() {
  console.log('🔍 Analyzing current authentication state...\n');
  
  try {
    // Get all users with hashedPassword (legacy auth)
    const legacyUsers = await prisma.user.findMany({
      where: {
        hashedPassword: {
          not: null
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hashedPassword: true,
        createdAt: true,
        accounts: {
          select: {
            id: true,
            providerId: true,
            password: true
          }
        }
      }
    });

    // Get all users with BetterAuth accounts
    const betterAuthUsers = await prisma.user.findMany({
      where: {
        accounts: {
          some: {
            password: {
              not: null
            }
          }
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hashedPassword: true,
        createdAt: true,
        accounts: {
          select: {
            id: true,
            providerId: true,
            password: true
          }
        }
      }
    });

    // Get all users (total count)
    const totalUsers = await prisma.user.count();

    console.log('📊 ANALYSIS RESULTS:');
    console.log('===================');
    console.log(`Total users in database: ${totalUsers}`);
    console.log(`Users with legacy auth (hashedPassword): ${legacyUsers.length}`);
    console.log(`Users with BetterAuth accounts: ${betterAuthUsers.length}`);
    
    console.log('\n🔑 LEGACY USERS (will be DELETED):');
    console.log('================================');
    legacyUsers.forEach(user => {
      const hasBetterAuth = user.accounts.some(acc => acc.password);
      console.log(`- ${user.email} (${user.role}) - Created: ${user.createdAt.toISOString().split('T')[0]} - BetterAuth: ${hasBetterAuth ? 'YES' : 'NO'}`);
    });

    console.log('\n✅ BETTERAUTH USERS (will be KEPT):');
    console.log('=================================');
    betterAuthUsers.forEach(user => {
      console.log(`- ${user.email} (${user.role}) - Created: ${user.createdAt.toISOString().split('T')[0]} - Legacy Hash: ${user.hashedPassword ? 'YES' : 'NO'}`);
    });

    // Check for users with both auth methods
    const hybridUsers = legacyUsers.filter(user => 
      user.accounts.some(acc => acc.password)
    );

    if (hybridUsers.length > 0) {
      console.log('\n⚠️  HYBRID USERS (have both auth methods):');
      console.log('=========================================');
      hybridUsers.forEach(user => {
        console.log(`- ${user.email} (${user.role})`);
      });
    }

    // Target users to keep
    const targetEmails = ['gabop2000@gmail.com', 'gabrielprivermsg@gmail.com'];
    const targetUsers = betterAuthUsers.filter(user => 
      targetEmails.includes(user.email)
    );

    console.log('\n🎯 TARGET USERS TO KEEP:');
    console.log('=======================');
    targetUsers.forEach(user => {
      console.log(`- ${user.email} (${user.role}) - Found: YES`);
    });

    const missingTargets = targetEmails.filter(email => 
      !betterAuthUsers.some(user => user.email === email)
    );

    if (missingTargets.length > 0) {
      console.log('\n❌ MISSING TARGET USERS:');
      console.log('=======================');
      missingTargets.forEach(email => {
        console.log(`- ${email} - NOT FOUND IN DATABASE`);
      });
    }

    console.log('\n📋 CLEANUP PLAN:');
    console.log('===============');
    console.log(`1. Keep ${targetUsers.length} BetterAuth users`);
    console.log(`2. Delete ${legacyUsers.filter(u => !targetEmails.includes(u.email)).length} legacy users`);
    console.log(`3. Remove hashedPassword column from schema`);
    console.log(`4. Clean up code references`);

  } catch (error) {
    console.error('❌ Error analyzing auth state:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeAuthState();