/**
 * User seeding module - Creates users with BetterAuth authentication
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UserSeedData, SeedConfig } from './types.js';
import { daysAgo, generateStripeId, createAuditLog, randomBoolean } from './utils.js';

/**
 * Base user data templates
 */
const USER_TEMPLATES: UserSeedData[] = [
  // Admin users
  {
    email: 'admin@example.com',
    name: 'System Administrator',
    role: 'ADMIN',
    password: 'admin123!',
    stripeCustomerId: generateStripeId('cus', 'admin_001'),
    timezone: 'America/New_York',
    preferredCurrency: 'usd',
    twoFactorEnabled: true,
    emailVerified: true,
    isActive: true
  },
  {
    email: 'admin.backup@example.com',
    name: 'Backup Administrator',
    role: 'ADMIN',
    password: 'backup123!',
    stripeCustomerId: generateStripeId('cus', 'admin_002'),
    timezone: 'America/Los_Angeles',
    preferredCurrency: 'usd',
    twoFactorEnabled: true,
    emailVerified: true,
    isActive: true
  },
  
  // Support users
  {
    email: 'support@example.com',
    name: 'Support Agent Primary',
    role: 'SUPPORT',
    password: 'support123!',
    timezone: 'America/Chicago',
    preferredCurrency: 'usd',
    emailVerified: true,
    isActive: true
  },
  {
    email: 'support.tier2@example.com',
    name: 'Sarah Johnson',
    role: 'SUPPORT',
    password: 'support456!',
    timezone: 'Europe/London',
    preferredCurrency: 'gbp',
    emailVerified: true,
    isActive: true
  },
  
  // Customer users with diverse profiles
  {
    email: 'john.doe@example.com',
    name: 'John Doe',
    role: 'CUSTOMER',
    password: 'customer123!',
    stripeCustomerId: generateStripeId('cus', 'customer_001'),
    phone: '+1-555-0101',
    timezone: 'America/Chicago',
    preferredCurrency: 'usd',
    twoFactorEnabled: false,
    emailVerified: true,
    isActive: true
  },
  {
    email: 'jane.smith@example.com',
    name: 'Jane Smith',
    role: 'CUSTOMER',
    password: 'customer456!',
    stripeCustomerId: generateStripeId('cus', 'customer_002'),
    phone: '+44-20-7946-0958',
    timezone: 'Europe/London',
    preferredCurrency: 'gbp',
    twoFactorEnabled: true,
    emailVerified: true,
    isActive: true
  },
  {
    email: 'mike.wilson@example.com',
    name: 'Mike Wilson',
    role: 'CUSTOMER',
    password: 'customer789!',
    stripeCustomerId: generateStripeId('cus', 'customer_003'),
    timezone: 'America/Los_Angeles',
    preferredCurrency: 'usd',
    emailVerified: false, // Unverified email scenario
    isActive: true
  },
  {
    email: 'emma.davis@example.com',
    name: 'Emma Davis',
    role: 'CUSTOMER',
    password: 'customer101!',
    stripeCustomerId: generateStripeId('cus', 'customer_004'),
    phone: '+1-555-0104',
    timezone: 'America/Denver',
    preferredCurrency: 'usd',
    twoFactorEnabled: false,
    emailVerified: true,
    isActive: true
  },
  {
    email: 'alex.chen@example.com',
    name: 'Alex Chen',
    role: 'CUSTOMER',
    password: 'customer202!',
    stripeCustomerId: generateStripeId('cus', 'customer_005'),
    phone: '+1-555-0105',
    timezone: 'America/Los_Angeles',
    preferredCurrency: 'usd',
    twoFactorEnabled: true,
    emailVerified: true,
    isActive: true
  },
  {
    email: 'maria.garcia@example.com',
    name: 'Maria Garcia',
    role: 'CUSTOMER',
    password: 'customer303!',
    stripeCustomerId: generateStripeId('cus', 'customer_006'),
    phone: '+34-91-123-4567',
    timezone: 'Europe/Madrid',
    preferredCurrency: 'eur',
    twoFactorEnabled: false,
    emailVerified: true,
    isActive: true
  },
  {
    email: 'inactive.user@example.com',
    name: 'Inactive User',
    role: 'CUSTOMER',
    password: 'inactive123!',
    stripeCustomerId: generateStripeId('cus', 'inactive_001'),
    timezone: 'America/New_York',
    preferredCurrency: 'usd',
    emailVerified: true,
    isActive: false // Inactive user scenario
  },
  {
    email: 'premium.user@example.com',
    name: 'Premium Customer',
    role: 'CUSTOMER',
    password: 'premium123!',
    stripeCustomerId: generateStripeId('cus', 'premium_001'),
    phone: '+1-555-0108',
    timezone: 'America/New_York',
    preferredCurrency: 'usd',
    twoFactorEnabled: true,
    emailVerified: true,
    isActive: true
  }
];

/**
 * Additional customer templates for larger datasets
 */
const ADDITIONAL_CUSTOMERS: Omit<UserSeedData, 'id' | 'email' | 'stripeCustomerId'>[] = [
  {
    name: 'David Brown',
    role: 'CUSTOMER',
    password: 'customer404!',
    phone: '+1-555-0109',
    timezone: 'America/Phoenix',
    preferredCurrency: 'usd',
    twoFactorEnabled: false,
    emailVerified: true,
    isActive: true
  },
  {
    name: 'Lisa Anderson',
    role: 'CUSTOMER',
    password: 'customer505!',
    phone: '+1-555-0110',
    timezone: 'America/Seattle',
    preferredCurrency: 'usd',
    twoFactorEnabled: true,
    emailVerified: true,
    isActive: true
  },
  {
    name: 'Thomas Mueller',
    role: 'CUSTOMER',
    password: 'customer606!',
    phone: '+49-30-12345678',
    timezone: 'Europe/Berlin',
    preferredCurrency: 'eur',
    twoFactorEnabled: false,
    emailVerified: true,
    isActive: true
  },
  {
    name: 'Sophie Dubois',
    role: 'CUSTOMER',
    password: 'customer707!',
    phone: '+33-1-23456789',
    timezone: 'Europe/Paris',
    preferredCurrency: 'eur',
    twoFactorEnabled: true,
    emailVerified: true,
    isActive: true
  },
  {
    name: 'Hiroshi Tanaka',
    role: 'CUSTOMER',
    password: 'customer808!',
    phone: '+81-3-1234-5678',
    timezone: 'Asia/Tokyo',
    preferredCurrency: 'jpy',
    twoFactorEnabled: false,
    emailVerified: true,
    isActive: true
  }
];

/**
 * Seed users based on configuration
 */
export async function seedUsers(prisma: PrismaClient, config: SeedConfig): Promise<string[]> {
  console.log('👥 Creating users...');
  
  const userIds: string[] = [];
  const usersToCreate = Math.min(config.userCount, USER_TEMPLATES.length + ADDITIONAL_CUSTOMERS.length);
  
  // Create base template users, ensuring we always get at least one of each role
  let baseUsers = USER_TEMPLATES.slice(0, usersToCreate);
  
  // For minimal seeding, ensure we have essential roles
  if (config.environment === 'test' && config.userCount <= 3) {
    baseUsers = [
      USER_TEMPLATES.find(u => u.role === 'ADMIN') || USER_TEMPLATES[0],
      USER_TEMPLATES.find(u => u.role === 'SUPPORT') || USER_TEMPLATES[1], 
      USER_TEMPLATES.find(u => u.role === 'CUSTOMER' && u.stripeCustomerId) || USER_TEMPLATES[4]
    ].slice(0, config.userCount);
  }
  
  for (const userData of baseUsers) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    // Create user without hashedPassword (using BetterAuth only)
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        stripeCustomerId: userData.stripeCustomerId,
        phone: userData.phone,
        timezone: userData.timezone,
        preferredCurrency: userData.preferredCurrency,
        twoFactorEnabled: userData.twoFactorEnabled || false,
        emailVerified: userData.emailVerified || false,
        isActive: userData.isActive !== false,
        lastLoginAt: userData.isActive ? daysAgo(Math.floor(Math.random() * 30)) : null
      }
    });
    
    // Create BetterAuth account for each user
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.email,
        providerId: 'credential',
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    userIds.push(user.id);
    
    // Create audit log for user creation
    if (!config.skipAuditLogs) {
      await createAuditLog(
        prisma,
        'CREATE',
        'users',
        user.id,
        undefined,
        {
          role: userData.role,
          email: userData.email,
          source: 'database_seeding'
        }
      );
    }
  }
  
  // Create additional customers if needed
  const remainingCount = usersToCreate - baseUsers.length;
  if (remainingCount > 0) {
    const additionalUsers = ADDITIONAL_CUSTOMERS.slice(0, remainingCount);
    
    for (let i = 0; i < additionalUsers.length; i++) {
      const userData = additionalUsers[i];
      const email = userData.name.toLowerCase().replace(/\s+/g, '.') + '@example.com';
      const stripeCustomerId = generateStripeId('cus', `customer_${String(baseUsers.length + i + 1).padStart(3, '0')}`);
      
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      // Create user without hashedPassword (using BetterAuth only)
      const user = await prisma.user.create({
        data: {
          email,
          name: userData.name,
          role: userData.role,
          stripeCustomerId,
          phone: userData.phone,
          timezone: userData.timezone,
          preferredCurrency: userData.preferredCurrency,
          twoFactorEnabled: userData.twoFactorEnabled || false,
          emailVerified: userData.emailVerified || false,
          isActive: userData.isActive !== false,
          lastLoginAt: userData.isActive ? daysAgo(Math.floor(Math.random() * 30)) : null
        }
      });
      
      // Create BetterAuth account for each user
      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: email,
          providerId: 'credential',
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      userIds.push(user.id);
      
      // Create audit log for user creation
      if (!config.skipAuditLogs) {
        await createAuditLog(
          prisma,
          'CREATE',
          'users',
          user.id,
          undefined,
          {
            role: userData.role,
            email: email,
            source: 'database_seeding'
          }
        );
      }
    }
  }
  
  console.log(`✅ Created ${userIds.length} users`);
  return userIds;
}

/**
 * Get customer user IDs from created users
 */
export async function getCustomerUserIds(prisma: PrismaClient): Promise<string[]> {
  const customers = await prisma.user.findMany({
    where: { role: 'CUSTOMER', isActive: true },
    select: { id: true }
  });
  
  return customers.map(customer => customer.id);
}

/**
 * Get admin user IDs from created users
 */
export async function getAdminUserIds(prisma: PrismaClient): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true }
  });
  
  return admins.map(admin => admin.id);
}

/**
 * Get support user IDs from created users
 */
export async function getSupportUserIds(prisma: PrismaClient): Promise<string[]> {
  const support = await prisma.user.findMany({
    where: { role: 'SUPPORT' },
    select: { id: true }
  });
  
  return support.map(s => s.id);
}

/**
 * Print user credentials for testing
 */
export function printUserCredentials(): void {
  console.log('\n🔑 Test login credentials:');
  console.log('Admin Users:');
  console.log('  admin@example.com / admin123!');
  console.log('  admin.backup@example.com / backup123!');
  console.log('\nSupport Users:');
  console.log('  support@example.com / support123!');
  console.log('  support.tier2@example.com / support456!');
  console.log('\nCustomer Users:');
  console.log('  john.doe@example.com / customer123!');
  console.log('  jane.smith@example.com / customer456!');
  console.log('  mike.wilson@example.com / customer789! (unverified email)');
  console.log('  emma.davis@example.com / customer101!');
  console.log('  alex.chen@example.com / customer202!');
  console.log('  maria.garcia@example.com / customer303!');
  console.log('  inactive.user@example.com / inactive123! (inactive)');
  console.log('  premium.user@example.com / premium123!');
}