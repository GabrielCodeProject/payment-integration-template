#!/usr/bin/env tsx

/**
 * Script to clean up legacy authentication users
 * This will delete all users that have hashedPassword but are not the target BetterAuth users
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupLegacyAuth() {
  console.log('🧹 Starting legacy authentication cleanup...\n');
  
  try {
    const targetEmails = ['gabop2000@gmail.com', 'gabrielprivermsg@gmail.com'];
    
    // First, get all users that will be deleted (for logging)
    const usersToDelete = await prisma.user.findMany({
      where: {
        AND: [
          {
            hashedPassword: {
              not: null
            }
          },
          {
            email: {
              notIn: targetEmails
            }
          }
        ]
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

    console.log('📋 Users scheduled for deletion:');
    console.log('==============================');
    usersToDelete.forEach(user => {
      console.log(`- ${user.email} (${user.role})`);
      console.log(`  - Orders: ${user.orders.length}`);
      console.log(`  - Payment Methods: ${user.paymentMethods.length}`);
      console.log(`  - Subscriptions: ${user.subscriptions.length}`);
      console.log(`  - Sessions: ${user.sessions.length}`);
      console.log(`  - Accounts: ${user.accounts.length}`);
    });

    if (usersToDelete.length === 0) {
      console.log('✅ No legacy users to delete.');
      return;
    }

    console.log(`\n⚠️  About to delete ${usersToDelete.length} legacy users and all their related data.`);
    console.log('This action cannot be undone!');
    
    const userIdsToDelete = usersToDelete.map(user => user.id);
    
    console.log('\n🗑️  Deleting related data...');
    
    // Delete subscriptions first (no cascade)
    const deletedSubscriptions = await prisma.subscription.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    console.log(`  - Deleted ${deletedSubscriptions.count} subscriptions`);
    
    // Delete orders (should cascade to order items)
    const deletedOrders = await prisma.order.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    console.log(`  - Deleted ${deletedOrders.count} orders`);
    
    // Delete payment methods (should cascade)
    const deletedPaymentMethods = await prisma.paymentMethod.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    console.log(`  - Deleted ${deletedPaymentMethods.count} payment methods`);
    
    // Delete sessions (should cascade)
    const deletedSessions = await prisma.session.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    console.log(`  - Deleted ${deletedSessions.count} sessions`);
    
    // Delete accounts (should cascade)
    const deletedAccounts = await prisma.account.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    console.log(`  - Deleted ${deletedAccounts.count} accounts`);
    
    // Delete user discount codes
    const deletedUserDiscountCodes = await prisma.userDiscountCode.deleteMany({
      where: { userId: { in: userIdsToDelete } }
    });
    console.log(`  - Deleted ${deletedUserDiscountCodes.count} user discount codes`);
    
    // Finally delete the users
    const deleteResult = await prisma.user.deleteMany({
      where: { id: { in: userIdsToDelete } }
    });

    console.log(`\n✅ Successfully deleted ${deleteResult.count} legacy users.`);

    // Verify remaining users
    const remainingUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hashedPassword: true,
        accounts: {
          select: {
            id: true,
            providerId: true,
            password: true
          }
        }
      }
    });

    console.log('\n📊 Remaining users after cleanup:');
    console.log('================================');
    remainingUsers.forEach(user => {
      const hasBetterAuth = user.accounts.some(acc => acc.password);
      const hasLegacyAuth = !!user.hashedPassword;
      console.log(`- ${user.email} (${user.role})`);
      console.log(`  - Legacy Auth: ${hasLegacyAuth ? 'YES' : 'NO'}`);
      console.log(`  - BetterAuth: ${hasBetterAuth ? 'YES' : 'NO'}`);
    });

    console.log('\n🎉 Legacy user cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupLegacyAuth();