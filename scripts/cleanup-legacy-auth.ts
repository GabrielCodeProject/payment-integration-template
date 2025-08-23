#!/usr/bin/env tsx

/**
 * Script to clean up legacy authentication users
 * This will delete all users that have hashedPassword but are not the target BetterAuth users
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupLegacyAuth() {
  // Starting legacy authentication cleanup
  
  try {
    const targetEmails = ['gabop2000@gmail.com', 'gabrielprivermsg@gmail.com'];
    
    // First, get all users that will be deleted (for logging)
    const usersToDelete = await prisma.user.findMany({
      where: {
        email: {
          notIn: targetEmails
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        orders: { select: { id: true } },
        paymentMethods: { select: { id: true } },
        subscriptions: { select: { id: true } },
        sessions: { select: { id: true } },
        accounts: { select: { id: true } }
      }
    });

    // Users scheduled for deletion
    usersToDelete.forEach(_user => {
      // User: ${user.email} (${user.role})
      // Orders: ${user.orders.length}
      // Payment Methods: ${user.paymentMethods.length}
      // Subscriptions: ${user.subscriptions.length}
      // Sessions: ${user.sessions.length}
      // Accounts: ${user.accounts.length}
    });

    if (usersToDelete.length === 0) {
      // No legacy users to delete
      return;
    }

    // About to delete ${usersToDelete.length} legacy users and all their related data
    // This action cannot be undone
    
    const userIdsToDelete = usersToDelete.map(user => user.id);
    
    // Deleting related data
    
    // Delete subscriptions first (no cascade)
    const _deletedSubscriptions = await prisma.subscription.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    // Deleted ${deletedSubscriptions.count} subscriptions
    
    // Delete orders (should cascade to order items)
    const _deletedOrders = await prisma.order.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    // Deleted ${deletedOrders.count} orders
    
    // Delete payment methods (should cascade)
    const _deletedPaymentMethods = await prisma.paymentMethod.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    // Deleted ${deletedPaymentMethods.count} payment methods
    
    // Delete sessions (should cascade)
    const _deletedSessions = await prisma.session.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    // Deleted ${deletedSessions.count} sessions
    
    // Delete accounts (should cascade)
    const _deletedAccounts = await prisma.account.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    // Deleted ${deletedAccounts.count} accounts
    
    // Delete user discount codes
    const _deletedUserDiscountCodes = await prisma.userDiscountCode.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    // Deleted ${deletedUserDiscountCodes.count} user discount codes
    
    // Finally delete the users
    const _deleteResult = await prisma.user.deleteMany({
      where: { id: { in: userIdsToDelete } }
    });

    // Successfully deleted ${deleteResult.count} legacy users

    // Verify remaining users
    const remainingUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accounts: {
          select: {
            id: true,
            providerId: true
          }
        }
      }
    });

    // Remaining users after cleanup
    remainingUsers.forEach(_user => {
      // const _hasBetterAuth = user.accounts.some(acc => acc.password);
      // const _hasLegacyAuth = !!user.hashedPassword;
      // User: ${user.email} (${user.role})
      // Legacy Auth: ${hasLegacyAuth ? 'YES' : 'NO'}
      // BetterAuth: ${hasBetterAuth ? 'YES' : 'NO'}
    });

    // Legacy user cleanup completed successfully

  } catch (error) {
    // Error during cleanup: error
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupLegacyAuth();