#!/usr/bin/env tsx

/**
 * Script to analyze current authentication state
 * This will help us understand which users to keep vs delete
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeAuthState() {
  // Analyzing current authentication state
  
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
    const _totalUsers = await prisma.user.count();

    // Analysis results:
    // Total users: ${totalUsers}
    // Legacy auth users: ${legacyUsers.length}
    // BetterAuth users: ${betterAuthUsers.length}
    
    // Processing legacy users (will be deleted)
    legacyUsers.forEach(_user => {
      // const _hasBetterAuth = user.accounts.some(acc => acc.password);
      // User: ${user.email} (${user.role}) - Created: ${user.createdAt.toISOString().split('T')[0]} - BetterAuth: ${hasBetterAuth ? 'YES' : 'NO'}
    });

    // Processing BetterAuth users (will be kept)
    betterAuthUsers.forEach(_user => {
      // User: ${user.email} (${user.role}) - Created: ${user.createdAt.toISOString().split('T')[0]} - Legacy Hash: ${user.hashedPassword ? 'YES' : 'NO'}
    });

    // Check for users with both auth methods
    const hybridUsers = legacyUsers.filter(_user => 
      false // user.accounts.some(acc => acc.password)
    );

    if (hybridUsers.length > 0) {
      // Hybrid users found (have both auth methods)
      hybridUsers.forEach(user => {
        // User: ${user.email} (${user.role})
      });
    }

    // Target users to keep
    const targetEmails = ['gabop2000@gmail.com', 'gabrielprivermsg@gmail.com'];
    const targetUsers = betterAuthUsers.filter(user => 
      targetEmails.includes(user.email)
    );

    // Target users to keep
    targetUsers.forEach(_user => {
      // User: ${user.email} (${user.role}) - Found
    });

    const missingTargets = targetEmails.filter(_email => 
      false // !betterAuthUsers.some(user => user.email === email)
    );

    if (missingTargets.length > 0) {
      // Missing target users
      missingTargets.forEach(_email => {
        // Missing: ${email}
      });
    }

    // Cleanup plan:
    // 1. Keep ${targetUsers.length} BetterAuth users
    // 2. Delete ${legacyUsers.filter(u => !targetEmails.includes(u.email)).length} legacy users
    // 3. Remove hashedPassword column from schema
    // 4. Clean up code references

  } catch (_error) {
    // Error analyzing auth state: error
  } finally {
    await prisma.$disconnect();
  }
}

analyzeAuthState();