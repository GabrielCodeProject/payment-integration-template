/**
 * Product seeding module - Creates diverse product catalog with different types and pricing tiers
 */

import { PrismaClient } from '@prisma/client';
import { ProductSeedData, SeedConfig } from './types.js';
import { generateSKU, generateSlug, generateStripeId, createAuditLog, randomBetween } from './utils.js';

/**
 * Product templates with comprehensive variety
 */
const PRODUCT_TEMPLATES: ProductSeedData[] = [
  // Physical Products - Clothing
  {
    id: 'product-tshirt-001',
    name: 'Premium Developer T-Shirt',
    description: 'High-quality cotton t-shirt with witty developer quotes. Perfect for coding sessions and tech meetups. Made from 100% organic cotton with excellent durability and comfort.',
    shortDescription: 'Comfortable cotton t-shirt for developers',
    price: 29.99,
    currency: 'usd',
    compareAtPrice: 39.99,
    sku: generateSKU('APPAREL', 'DEVELOPER TSHIRT', 'PREMIUM'),
    type: 'ONE_TIME',
    isDigital: false,
    requiresShipping: true,
    stockQuantity: 100,
    isActive: true,
    tags: ['clothing', 'developer', 'cotton', 'comfortable', 'premium'],
    images: [
      'https://example.com/images/tshirt-front.jpg',
      'https://example.com/images/tshirt-back.jpg',
      'https://example.com/images/tshirt-detail.jpg'
    ],
    stripePriceId: generateStripeId('price', 'tshirt_premium_001'),
    stripeProductId: generateStripeId('prod', 'tshirt_001')
  },
  {
    id: 'product-hoodie-001',
    name: 'Code in Comfort Hoodie',
    description: 'Warm and cozy hoodie perfect for those late-night coding sessions. Features a kangaroo pocket and adjustable hood. Available in multiple colors.',
    shortDescription: 'Warm hoodie for coding comfort',
    price: 59.99,
    currency: 'usd',
    compareAtPrice: 79.99,
    sku: generateSKU('APPAREL', 'HOODIE COMFORT'),
    type: 'ONE_TIME',
    isDigital: false,
    requiresShipping: true,
    stockQuantity: 75,
    isActive: true,
    tags: ['clothing', 'hoodie', 'comfort', 'warm', 'coding'],
    images: [
      'https://example.com/images/hoodie-front.jpg',
      'https://example.com/images/hoodie-back.jpg'
    ],
    stripePriceId: generateStripeId('price', 'hoodie_comfort_001'),
    stripeProductId: generateStripeId('prod', 'hoodie_001')
  },
  {
    id: 'product-mug-001',
    name: 'Caffeine-Driven Developer Mug',
    description: 'High-quality ceramic mug with funny programming quotes. Microwave and dishwasher safe. Perfect size for your morning coffee or tea.',
    shortDescription: 'Ceramic mug for caffeine-driven developers',
    price: 14.99,
    currency: 'usd',
    sku: generateSKU('HOME', 'DEVELOPER MUG'),
    type: 'ONE_TIME',
    isDigital: false,
    requiresShipping: true,
    stockQuantity: 200,
    isActive: true,
    tags: ['mug', 'coffee', 'ceramic', 'developer', 'caffeine'],
    images: ['https://example.com/images/mug-developer.jpg'],
    stripePriceId: generateStripeId('price', 'mug_developer_001'),
    stripeProductId: generateStripeId('prod', 'mug_001')
  },

  // Digital Products - eBooks
  {
    id: 'product-ebook-fullstack-001',
    name: 'Complete Guide to Full-Stack Development',
    description: 'A comprehensive 300-page guide covering modern full-stack development with React, Node.js, and PostgreSQL. Includes practical projects, real-world examples, and best practices from industry experts.',
    shortDescription: 'Complete full-stack development guide',
    price: 49.99,
    currency: 'usd',
    compareAtPrice: 79.99,
    sku: generateSKU('EBOOK', 'FULLSTACK GUIDE'),
    type: 'ONE_TIME',
    isDigital: true,
    requiresShipping: false,
    isActive: true,
    tags: ['ebook', 'development', 'react', 'nodejs', 'programming', 'fullstack'],
    images: ['https://example.com/images/ebook-fullstack-cover.jpg'],
    stripePriceId: generateStripeId('price', 'ebook_fullstack_001'),
    stripeProductId: generateStripeId('prod', 'ebook_fullstack_001')
  },
  {
    id: 'product-ebook-database-001',
    name: 'Database Design Mastery',
    description: 'Master database design with this comprehensive guide covering SQL, NoSQL, indexing strategies, and performance optimization. Perfect for developers and DBAs.',
    shortDescription: 'Comprehensive database design guide',
    price: 39.99,
    currency: 'usd',
    sku: generateSKU('EBOOK', 'DATABASE MASTERY'),
    type: 'ONE_TIME',
    isDigital: true,
    requiresShipping: false,
    isActive: true,
    tags: ['ebook', 'database', 'sql', 'nosql', 'design', 'optimization'],
    images: ['https://example.com/images/ebook-database-cover.jpg'],
    stripePriceId: generateStripeId('price', 'ebook_database_001'),
    stripeProductId: generateStripeId('prod', 'ebook_database_001')
  },
  {
    id: 'product-course-api-001',
    name: 'RESTful API Development Course',
    description: 'Learn to build scalable RESTful APIs with Node.js, Express, and MongoDB. Includes video tutorials, code examples, and hands-on projects.',
    shortDescription: 'Complete API development course',
    price: 89.99,
    currency: 'usd',
    compareAtPrice: 129.99,
    sku: generateSKU('COURSE', 'API DEVELOPMENT'),
    type: 'ONE_TIME',
    isDigital: true,
    requiresShipping: false,
    isActive: true,
    tags: ['course', 'api', 'restful', 'nodejs', 'express', 'mongodb'],
    images: ['https://example.com/images/course-api-thumbnail.jpg'],
    stripePriceId: generateStripeId('price', 'course_api_001'),
    stripeProductId: generateStripeId('prod', 'course_api_001')
  },

  // Subscription Products - SaaS Plans
  {
    id: 'product-plan-basic-001',
    name: 'Basic Plan',
    description: 'Essential features for individual developers and small teams. Includes project management, basic analytics, email support, and up to 5 projects.',
    shortDescription: 'Basic tier with essential features',
    price: 9.99,
    currency: 'usd',
    sku: generateSKU('PLAN', 'BASIC MONTHLY'),
    type: 'SUBSCRIPTION',
    billingInterval: 'MONTH',
    isDigital: true,
    requiresShipping: false,
    isActive: true,
    tags: ['subscription', 'basic', 'monthly', 'starter', 'individual'],
    images: ['https://example.com/images/plan-basic.jpg'],
    stripePriceId: generateStripeId('price', 'basic_monthly_001'),
    stripeProductId: generateStripeId('prod', 'plan_basic_001')
  },
  {
    id: 'product-plan-pro-001',
    name: 'Pro Plan',
    description: 'Advanced features for professional developers and growing teams. Includes unlimited projects, detailed analytics, priority support, team collaboration tools, and advanced integrations.',
    shortDescription: 'Professional tier with advanced features',
    price: 29.99,
    currency: 'usd',
    compareAtPrice: 39.99,
    sku: generateSKU('PLAN', 'PRO MONTHLY'),
    type: 'SUBSCRIPTION',
    billingInterval: 'MONTH',
    isDigital: true,
    requiresShipping: false,
    isActive: true,
    tags: ['subscription', 'pro', 'monthly', 'advanced', 'professional'],
    images: ['https://example.com/images/plan-pro.jpg'],
    stripePriceId: generateStripeId('price', 'pro_monthly_001'),
    stripeProductId: generateStripeId('prod', 'plan_pro_001')
  },
  {
    id: 'product-plan-enterprise-001',
    name: 'Enterprise Plan',
    description: 'Enterprise-grade features for large organizations. Includes custom integrations, dedicated support, SLA guarantees, advanced security features, and white-label options.',
    shortDescription: 'Enterprise tier with premium features',
    price: 99.99,
    currency: 'usd',
    sku: generateSKU('PLAN', 'ENTERPRISE MONTHLY'),
    type: 'SUBSCRIPTION',
    billingInterval: 'MONTH',
    isDigital: true,
    requiresShipping: false,
    isActive: true,
    tags: ['subscription', 'enterprise', 'monthly', 'premium', 'organization'],
    images: ['https://example.com/images/plan-enterprise.jpg'],
    stripePriceId: generateStripeId('price', 'enterprise_monthly_001'),
    stripeProductId: generateStripeId('prod', 'plan_enterprise_001')
  },
  {
    id: 'product-plan-pro-annual-001',
    name: 'Pro Plan (Annual)',
    description: 'Pro plan with annual billing - save 20%! All Pro features with 12 months of service at a discounted rate.',
    shortDescription: 'Pro plan with annual discount',
    price: 299.99,
    currency: 'usd',
    compareAtPrice: 359.88,
    sku: generateSKU('PLAN', 'PRO ANNUAL'),
    type: 'SUBSCRIPTION',
    billingInterval: 'YEAR',
    isDigital: true,
    requiresShipping: false,
    isActive: true,
    tags: ['subscription', 'pro', 'annual', 'discount', 'professional'],
    images: ['https://example.com/images/plan-pro-annual.jpg'],
    stripePriceId: generateStripeId('price', 'pro_annual_001'),
    stripeProductId: generateStripeId('prod', 'plan_pro_annual_001')
  },

  // Hardware & Accessories
  {
    id: 'product-keyboard-001',
    name: 'Mechanical Gaming Keyboard',
    description: 'Professional mechanical keyboard with RGB backlighting, customizable keys, and ergonomic design. Perfect for developers and gamers alike.',
    shortDescription: 'RGB mechanical keyboard for coding',
    price: 149.99,
    currency: 'usd',
    compareAtPrice: 199.99,
    sku: generateSKU('HARDWARE', 'KEYBOARD MECHANICAL'),
    type: 'ONE_TIME',
    isDigital: false,
    requiresShipping: true,
    stockQuantity: 25,
    isActive: true,
    tags: ['hardware', 'keyboard', 'mechanical', 'rgb', 'gaming', 'ergonomic'],
    images: [
      'https://example.com/images/keyboard-front.jpg',
      'https://example.com/images/keyboard-side.jpg'
    ],
    stripePriceId: generateStripeId('price', 'keyboard_mechanical_001'),
    stripeProductId: generateStripeId('prod', 'keyboard_001')
  },
  {
    id: 'product-mouse-001',
    name: 'Precision Wireless Mouse',
    description: 'High-precision wireless mouse with ergonomic design and long battery life. Perfect for design work and development.',
    shortDescription: 'Wireless precision mouse',
    price: 79.99,
    currency: 'usd',
    sku: generateSKU('HARDWARE', 'MOUSE WIRELESS'),
    type: 'ONE_TIME',
    isDigital: false,
    requiresShipping: true,
    stockQuantity: 50,
    isActive: true,
    tags: ['hardware', 'mouse', 'wireless', 'precision', 'ergonomic'],
    images: ['https://example.com/images/mouse-wireless.jpg'],
    stripePriceId: generateStripeId('price', 'mouse_wireless_001'),
    stripeProductId: generateStripeId('prod', 'mouse_001')
  },

  // Software & Tools
  {
    id: 'product-license-ide-001',
    name: 'Premium IDE License',
    description: 'One-year license for our premium integrated development environment with advanced features, plugins, and priority support.',
    shortDescription: 'Premium IDE annual license',
    price: 199.99,
    currency: 'usd',
    sku: generateSKU('SOFTWARE', 'IDE LICENSE'),
    type: 'ONE_TIME',
    isDigital: true,
    requiresShipping: false,
    isActive: true,
    tags: ['software', 'ide', 'license', 'development', 'tools'],
    images: ['https://example.com/images/ide-license.jpg'],
    stripePriceId: generateStripeId('price', 'ide_license_001'),
    stripeProductId: generateStripeId('prod', 'ide_001')
  },

  // Limited Edition & Seasonal
  {
    id: 'product-limited-sticker-001',
    name: 'Limited Edition Sticker Pack',
    description: 'Exclusive collection of developer-themed stickers. Limited quantity available! Perfect for laptops, water bottles, and more.',
    shortDescription: 'Limited edition developer stickers',
    price: 9.99,
    currency: 'usd',
    sku: generateSKU('COLLECTIBLE', 'STICKER PACK LIMITED'),
    type: 'ONE_TIME',
    isDigital: false,
    requiresShipping: true,
    stockQuantity: 5, // Low stock for urgency
    isActive: true,
    tags: ['stickers', 'limited', 'collectible', 'developer', 'exclusive'],
    images: ['https://example.com/images/sticker-pack-limited.jpg'],
    stripePriceId: generateStripeId('price', 'sticker_limited_001'),
    stripeProductId: generateStripeId('prod', 'sticker_limited_001')
  }
];

/**
 * Additional product templates for larger catalogs
 */
const ADDITIONAL_PRODUCTS: Omit<ProductSeedData, 'id' | 'stripePriceId' | 'stripeProductId'>[] = [
  {
    name: 'Advanced React Patterns Course',
    description: 'Deep dive into advanced React patterns including hooks, context, and performance optimization.',
    shortDescription: 'Advanced React development patterns',
    price: 79.99,
    currency: 'usd',
    sku: generateSKU('COURSE', 'REACT ADVANCED'),
    type: 'ONE_TIME',
    isDigital: true,
    requiresShipping: false,
    isActive: true,
    tags: ['course', 'react', 'advanced', 'patterns', 'hooks'],
    images: ['https://example.com/images/course-react-advanced.jpg']
  },
  {
    name: 'Docker for Developers Handbook',
    description: 'Complete guide to containerization with Docker, including best practices and real-world examples.',
    shortDescription: 'Docker development handbook',
    price: 34.99,
    currency: 'usd',
    sku: generateSKU('EBOOK', 'DOCKER HANDBOOK'),
    type: 'ONE_TIME',
    isDigital: true,
    requiresShipping: false,
    isActive: true,
    tags: ['ebook', 'docker', 'containerization', 'devops'],
    images: ['https://example.com/images/ebook-docker.jpg']
  },
  {
    name: 'Python Data Science Bundle',
    description: 'Comprehensive bundle including books, courses, and datasets for Python data science.',
    shortDescription: 'Python data science learning bundle',
    price: 149.99,
    currency: 'usd',
    compareAtPrice: 199.99,
    sku: generateSKU('BUNDLE', 'PYTHON DATASCIENCE'),
    type: 'ONE_TIME',
    isDigital: true,
    requiresShipping: false,
    isActive: true,
    tags: ['bundle', 'python', 'data-science', 'machine-learning'],
    images: ['https://example.com/images/bundle-python-ds.jpg']
  }
];

/**
 * Seed products based on configuration
 */
export async function seedProducts(prisma: PrismaClient, config: SeedConfig): Promise<string[]> {
  console.log('🛍️ Creating products...');
  
  const productIds: string[] = [];
  const productsToCreate = Math.min(config.productCount, PRODUCT_TEMPLATES.length + ADDITIONAL_PRODUCTS.length);
  
  // Create base template products
  const baseProducts = PRODUCT_TEMPLATES.slice(0, productsToCreate);
  
  for (const productData of baseProducts) {
    const product = await prisma.product.create({
      data: {
        id: productData.id,
        name: productData.name,
        description: productData.description,
        shortDescription: productData.shortDescription,
        price: productData.price,
        currency: productData.currency,
        compareAtPrice: productData.compareAtPrice,
        sku: productData.sku,
        isActive: productData.isActive,
        isDigital: productData.isDigital,
        requiresShipping: productData.requiresShipping,
        stockQuantity: productData.stockQuantity,
        lowStockThreshold: productData.stockQuantity ? Math.max(5, Math.floor(productData.stockQuantity * 0.1)) : undefined,
        slug: generateSlug(productData.name),
        metaTitle: `${productData.name} - ${productData.shortDescription}`,
        metaDescription: productData.description.substring(0, 160),
        tags: productData.tags,
        images: productData.images,
        thumbnail: productData.images[0],
        stripePriceId: productData.stripePriceId,
        stripeProductId: productData.stripeProductId,
        type: productData.type,
        billingInterval: productData.billingInterval
      }
    });
    
    productIds.push(product.id);
    
    // Create audit log for product creation
    if (!config.skipAuditLogs) {
      await createAuditLog(
        prisma,
        'CREATE',
        'products',
        product.id,
        undefined,
        {
          name: productData.name,
          type: productData.type,
          price: productData.price,
          currency: productData.currency,
          source: 'database_seeding'
        }
      );
    }
  }
  
  // Create additional products if needed
  const remainingCount = productsToCreate - baseProducts.length;
  if (remainingCount > 0) {
    const additionalProducts = ADDITIONAL_PRODUCTS.slice(0, remainingCount);
    
    for (let i = 0; i < additionalProducts.length; i++) {
      const productData = additionalProducts[i];
      const index = baseProducts.length + i + 1;
      const id = `product-additional-${String(index).padStart(3, '0')}`;
      const stripePriceId = generateStripeId('price', `additional_${String(index).padStart(3, '0')}`);
      const stripeProductId = generateStripeId('prod', `additional_${String(index).padStart(3, '0')}`);
      
      const product = await prisma.product.create({
        data: {
          id,
          name: productData.name,
          description: productData.description,
          shortDescription: productData.shortDescription,
          price: productData.price,
          currency: productData.currency,
          compareAtPrice: productData.compareAtPrice,
          sku: productData.sku,
          isActive: productData.isActive,
          isDigital: productData.isDigital,
          requiresShipping: productData.requiresShipping,
          stockQuantity: productData.stockQuantity,
          lowStockThreshold: productData.stockQuantity ? Math.max(5, Math.floor(productData.stockQuantity * 0.1)) : undefined,
          slug: generateSlug(productData.name),
          metaTitle: `${productData.name} - ${productData.shortDescription}`,
          metaDescription: productData.description.substring(0, 160),
          tags: productData.tags,
          images: productData.images,
          thumbnail: productData.images[0],
          stripePriceId,
          stripeProductId,
          type: productData.type,
          billingInterval: productData.billingInterval
        }
      });
      
      productIds.push(product.id);
      
      // Create audit log for product creation
      if (!config.skipAuditLogs) {
        await createAuditLog(
          prisma,
          'CREATE',
          'products',
          product.id,
          undefined,
          {
            name: productData.name,
            type: productData.type,
            price: productData.price,
            currency: productData.currency,
            source: 'database_seeding'
          }
        );
      }
    }
  }
  
  console.log(`✅ Created ${productIds.length} products`);
  return productIds;
}

/**
 * Get product IDs by type
 */
export async function getProductIdsByType(prisma: PrismaClient, type: 'ONE_TIME' | 'SUBSCRIPTION' | 'USAGE_BASED'): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { type, isActive: true },
    select: { id: true }
  });
  
  return products.map(product => product.id);
}

/**
 * Get digital product IDs
 */
export async function getDigitalProductIds(prisma: PrismaClient): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { isDigital: true, isActive: true },
    select: { id: true }
  });
  
  return products.map(product => product.id);
}

/**
 * Get physical product IDs  
 */
export async function getPhysicalProductIds(prisma: PrismaClient): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { isDigital: false, isActive: true },
    select: { id: true }
  });
  
  return products.map(product => product.id);
}