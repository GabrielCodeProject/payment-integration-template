#!/usr/bin/env tsx

/**
 * Script to manually create the target BetterAuth users
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createBetterAuthUsers() {
  // console.log('👤 Creating BetterAuth users...\n');
  
  try {
    const targetUsers = [
      {
        email: 'gabop2000@gmail.com',
        name: 'Gabriel Admin',
        role: 'ADMIN',
        password: 'admin123!'
      },
      {
        email: 'gabrielprivermsg@gmail.com', 
        name: 'Gabriel Private',
        role: 'ADMIN',
        password: 'admin123!'
      }
    ];

    for (const userData of targetUsers) {
      // console.log(`Creating user: ${userData.email}`);
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        // console.log(`  - User already exists, skipping...`);
        continue;
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          role: userData.role,
          emailVerified: true,
          isActive: true,
          timezone: 'UTC',
          preferredCurrency: 'usd',
          twoFactorEnabled: false
        }
      });

      // console.log(`  - Created user: ${user.id}`);

      // Create BetterAuth account
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      const account = await prisma.account.create({
        data: {
          userId: user.id,
          accountId: userData.email,
          providerId: 'credential',
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // console.log(`  - Created BetterAuth account: ${account.id}`);
    }

    // Verify final state
    const allUsers = await prisma.user.findMany({
      include: {
        accounts: {
          select: {
            id: true,
            providerId: true,
            password: true
          }
        }
      }
    });

    // console.log('\n📊 Final user state:');
    // console.log('==================');
    allUsers.forEach(user => {
      const hasBetterAuth = user.accounts.some(acc => acc.password);
      // console.log(`- ${user.email} (${user.role}) - BetterAuth: ${hasBetterAuth ? 'YES' : 'NO'}`);
    });

    // console.log('\n✅ BetterAuth users created successfully!');

  } catch (error) {
    // console.error('❌ Error creating BetterAuth users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createBetterAuthUsers();