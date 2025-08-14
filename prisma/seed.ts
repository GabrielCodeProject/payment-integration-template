import { PrismaClient } from "@prisma/client";
import { enhancedDatabaseSeed, seedDevelopment, seedTest, seedStaging, seedMinimal } from './seeds/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting enhanced database seeding...");
  
  // Determine seeding strategy based on environment
  const environment = process.env.NODE_ENV || 'development';
  const seedingMode = process.env.SEED_MODE; // Can be: 'minimal', 'test', 'staging', 'development'
  
  console.log(`🔧 Environment: ${environment}`);
  console.log(`📦 Seeding mode: ${seedingMode || 'auto'}`);
  
  try {
    switch (seedingMode) {
      case 'minimal':
        console.log('🏃‍♂️ Running minimal seeding for CI/CD...');
        await seedMinimal();
        break;
      case 'test':
        console.log('🧪 Running test environment seeding...');
        await seedTest();
        break;
      case 'staging':
        console.log('🎭 Running staging environment seeding...');
        await seedStaging();
        break;
      case 'development':
        console.log('💻 Running development environment seeding...');
        await seedDevelopment();
        break;
      default:
        // Auto-detect based on NODE_ENV
        if (environment === 'test') {
          console.log('🧪 Auto-detected test environment...');
          await seedTest();
        } else if (environment === 'staging') {
          console.log('🎭 Auto-detected staging environment...');
          await seedStaging();
        } else {
          console.log('💻 Auto-detected development environment...');
          await seedDevelopment();
        }
        break;
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }

}

main()
  .catch((e) => {
    console.error("❌ Error during enhanced seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
