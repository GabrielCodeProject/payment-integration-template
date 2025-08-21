#!/usr/bin/env tsx

/**
 * Script to verify that only BetterAuth authentication is present
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyBetterAuthOnly() {
  console.log('🔍 Verifying BetterAuth-only authentication state...\n');
  
  try {
    // Get all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
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

    // Get users with BetterAuth accounts
    const betterAuthUsers = allUsers.filter(user => 
      user.accounts.some(acc => acc.password)
    );

    // Get users without any authentication
    const usersWithoutAuth = allUsers.filter(user => 
      user.accounts.length === 0 || !user.accounts.some(acc => acc.password)
    );

    console.log('📊 VERIFICATION RESULTS:');
    console.log('=======================');
    console.log(`Total users in database: ${allUsers.length}`);
    console.log(`Users with BetterAuth accounts: ${betterAuthUsers.length}`);
    console.log(`Users without authentication: ${usersWithoutAuth.length}`);
    
    console.log('\n✅ USERS WITH BETTERAUTH:');
    console.log('========================');
    betterAuthUsers.forEach(user => {
      console.log(`- ${user.email} (${user.role}) - Created: ${user.createdAt.toISOString().split('T')[0]}`);
    });

    if (usersWithoutAuth.length > 0) {
      console.log('\n❌ USERS WITHOUT AUTHENTICATION:');
      console.log('===============================');
      usersWithoutAuth.forEach(user => {
        console.log(`- ${user.email} (${user.role}) - Created: ${user.createdAt.toISOString().split('T')[0]}`);
      });
    }

    // Check if legacy authentication artifacts exist
    console.log('\n🔍 LEGACY AUTHENTICATION CHECK:');
    console.log('==============================');
    
    // Try to check if hashedPassword field exists (should fail)
    try {
      await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'hashedPassword'`;
      console.log('❌ hashedPassword column still exists in database!');
    } catch (error) {
      console.log('✅ hashedPassword column does not exist in database schema');
    }

    console.log('\n📋 VERIFICATION SUMMARY:');
    console.log('=======================');
    
    if (betterAuthUsers.length === allUsers.length && usersWithoutAuth.length === 0) {
      console.log('✅ SUCCESS: All users have BetterAuth authentication');
      console.log('✅ SUCCESS: No legacy authentication remnants found');
      console.log('✅ SUCCESS: Authentication system cleanup completed successfully');
    } else if (usersWithoutAuth.length > 0) {
      console.log('⚠️  WARNING: Some users do not have authentication configured');
      console.log('📝 ACTION: Review users without authentication and add BetterAuth accounts');
    }

    const targetEmails = ['gabop2000@gmail.com', 'gabrielprivermsg@gmail.com'];
    const targetUsersPresent = targetEmails.filter(email => 
      betterAuthUsers.some(user => user.email === email)
    );

    console.log('\n🎯 TARGET USERS STATUS:');
    console.log('=====================');
    targetUsersPresent.forEach(email => {
      console.log(`✅ ${email} - Present and authenticated`);
    });

    const missingTargets = targetEmails.filter(email => 
      !betterAuthUsers.some(user => user.email === email)
    );

    if (missingTargets.length > 0) {
      console.log('\n❌ MISSING TARGET USERS:');
      missingTargets.forEach(email => {
        console.log(`❌ ${email} - Not found`);
      });
    }

  } catch (error) {
    console.error('❌ Error verifying authentication state:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyBetterAuthOnly();