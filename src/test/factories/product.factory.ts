import { faker } from '@faker-js/faker';
import { PrismaClient, Product, ProductType, BillingInterval, Prisma } from '@prisma/client';
import type { CreateProduct } from '@/lib/validations/base/product';

/**
 * Product Factory for Test Data Generation
 * 
 * Comprehensive factory for creating test product data with realistic
 * values and proper validation. Supports various product types including
 * digital, physical, subscription, and one-time products.
 * 
 * Features:
 * - Realistic product data generation
 * - Proper handling of product types and constraints
 * - Inventory and pricing scenarios
 * - SEO and media data generation
 * - Bulk data creation utilities
 * - Edge case scenarios for testing
 */

export interface ProductFactoryOptions {
  name?: string;
  description?: string;
  shortDescription?: string;
  price?: number;
  currency?: string;
  compareAtPrice?: number | null;
  sku?: string;
  isActive?: boolean;
  isDigital?: boolean;
  requiresShipping?: boolean;
  stockQuantity?: number | null;
  lowStockThreshold?: number | null;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[];
  images?: string[];
  thumbnail?: string;
  stripePriceId?: string;
  stripeProductId?: string;
  type?: ProductType;
  billingInterval?: BillingInterval | null;
}

export interface ProductScenarioOptions {
  quantity?: number;
  category?: 'electronics' | 'software' | 'books' | 'clothing' | 'home' | 'sports' | 'mixed';
  priceRange?: { min: number; max: number };
  includeInactive?: boolean;
  includeOutOfStock?: boolean;
  subscriptionRatio?: number; // 0-1, percentage of products that should be subscriptions
}

export class ProductFactory {
  private prisma: PrismaClient;
  private usedSlugs = new Set<string>();
  private usedSkus = new Set<string>();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==========================================================================
  // BASIC PRODUCT GENERATION
  // ==========================================================================

  /**
   * Generate product data without creating in database
   */
  generateProductData(overrides: ProductFactoryOptions = {}): CreateProduct {
    const name = overrides.name || this.generateProductName(overrides.type);
    const isDigital = overrides.isDigital ?? faker.datatype.boolean({ probability: 0.3 });
    const isSubscription = overrides.type === 'SUBSCRIPTION';

    // Generate unique SKU and slug
    const sku = overrides.sku || this.generateUniqueSku();
    const slug = overrides.slug || this.generateUniqueSlug(name);

    // Price generation with realistic values
    const price = overrides.price ?? this.generateRealisticPrice(overrides.type);
    const compareAtPrice = overrides.compareAtPrice !== undefined 
      ? overrides.compareAtPrice
      : (faker.datatype.boolean({ probability: 0.3 }) 
          ? price * faker.number.float({ min: 1.1, max: 1.5 })
          : null);

    // Stock management for physical products
    const stockQuantity = isDigital 
      ? null 
      : (overrides.stockQuantity !== undefined 
          ? overrides.stockQuantity
          : faker.number.int({ min: 0, max: 500 }));

    const lowStockThreshold = !isDigital && stockQuantity !== null
      ? (overrides.lowStockThreshold ?? faker.number.int({ min: 5, max: 20 }))
      : null;

    return {
      name,
      description: overrides.description || this.generateProductDescription(name),
      shortDescription: overrides.shortDescription || faker.lorem.sentence({ min: 4, max: 8 }),
      price,
      currency: overrides.currency || 'USD',
      compareAtPrice,
      sku,
      isActive: overrides.isActive ?? true,
      isDigital,
      requiresShipping: isDigital ? false : (overrides.requiresShipping ?? true),
      stockQuantity,
      lowStockThreshold,
      slug,
      metaTitle: overrides.metaTitle || `${name} - Shop Now`,
      metaDescription: overrides.metaDescription || this.generateMetaDescription(name),
      tags: overrides.tags || this.generateProductTags(overrides.type, name),
      images: overrides.images || this.generateProductImages(name),
      thumbnail: overrides.thumbnail || faker.image.urlPicsumPhotos({ width: 400, height: 400 }),
      stripePriceId: overrides.stripePriceId || `price_${faker.string.alphanumeric(14)}`,
      stripeProductId: overrides.stripeProductId || `prod_${faker.string.alphanumeric(14)}`,
      type: overrides.type || (isSubscription ? 'SUBSCRIPTION' : 'ONE_TIME'),
      billingInterval: isSubscription 
        ? (overrides.billingInterval || faker.helpers.arrayElement(['DAY', 'WEEK', 'MONTH', 'YEAR'] as BillingInterval[]))
        : null,
    };
  }

  /**
   * Create a single product in the database
   */
  async createProduct(overrides: ProductFactoryOptions = {}): Promise<Product> {
    const productData = this.generateProductData(overrides);
    
    return await this.prisma.product.create({
      data: {
        ...productData,
        price: new Prisma.Decimal(productData.price),
        compareAtPrice: productData.compareAtPrice 
          ? new Prisma.Decimal(productData.compareAtPrice) 
          : null,
      },
    });
  }

  // ==========================================================================
  // SPECIALIZED PRODUCT TYPES
  // ==========================================================================

  /**
   * Create a digital product
   */
  async createDigitalProduct(overrides: ProductFactoryOptions = {}): Promise<Product> {
    return this.createProduct({
      isDigital: true,
      requiresShipping: false,
      stockQuantity: null,
      lowStockThreshold: null,
      type: 'ONE_TIME',
      tags: ['digital', 'instant-download'],
      ...overrides,
    });
  }

  /**
   * Create a physical product with inventory
   */
  async createPhysicalProduct(overrides: ProductFactoryOptions = {}): Promise<Product> {
    const stockQuantity = overrides.stockQuantity ?? faker.number.int({ min: 10, max: 200 });
    
    return this.createProduct({
      isDigital: false,
      requiresShipping: true,
      stockQuantity,
      lowStockThreshold: Math.floor(stockQuantity * 0.1), // 10% of stock
      type: 'ONE_TIME',
      tags: ['physical', 'shipping-required'],
      ...overrides,
    });
  }

  /**
   * Create a subscription product
   */
  async createSubscriptionProduct(overrides: ProductFactoryOptions = {}): Promise<Product> {
    const billingInterval = overrides.billingInterval || 
      faker.helpers.arrayElement(['MONTH', 'YEAR'] as BillingInterval[]);
    
    return this.createProduct({
      type: 'SUBSCRIPTION',
      billingInterval,
      isDigital: true,
      requiresShipping: false,
      stockQuantity: null,
      lowStockThreshold: null,
      tags: ['subscription', 'recurring'],
      price: this.generateSubscriptionPrice(billingInterval),
      ...overrides,
    });
  }

  /**
   * Create a product on sale (with compareAtPrice)
   */
  async createSaleProduct(overrides: ProductFactoryOptions = {}): Promise<Product> {
    const price = overrides.price ?? faker.number.float({ min: 19.99, max: 199.99, fractionDigits: 2 });
    const compareAtPrice = price * faker.number.float({ min: 1.2, max: 1.8 });
    
    return this.createProduct({
      price,
      compareAtPrice,
      tags: ['sale', 'discount', 'limited-time'],
      ...overrides,
    });
  }

  /**
   * Create a low stock product
   */
  async createLowStockProduct(overrides: ProductFactoryOptions = {}): Promise<Product> {
    const lowStockThreshold = 10;
    const stockQuantity = faker.number.int({ min: 1, max: lowStockThreshold });
    
    return this.createPhysicalProduct({
      stockQuantity,
      lowStockThreshold,
      tags: ['low-stock', 'limited-quantity'],
      ...overrides,
    });
  }

  /**
   * Create an out-of-stock product
   */
  async createOutOfStockProduct(overrides: ProductFactoryOptions = {}): Promise<Product> {
    return this.createPhysicalProduct({
      stockQuantity: 0,
      lowStockThreshold: 5,
      tags: ['out-of-stock', 'sold-out'],
      ...overrides,
    });
  }

  /**
   * Create an inactive product
   */
  async createInactiveProduct(overrides: ProductFactoryOptions = {}): Promise<Product> {
    return this.createProduct({
      isActive: false,
      tags: ['inactive', 'disabled'],
      ...overrides,
    });
  }

  // ==========================================================================
  // BULK CREATION METHODS
  // ==========================================================================

  /**
   * Create multiple products with varied characteristics
   */
  async createProductBatch(options: ProductScenarioOptions = {}): Promise<Product[]> {
    const {
      quantity = 10,
      category = 'mixed',
      priceRange = { min: 9.99, max: 299.99 },
      includeInactive = false,
      includeOutOfStock = false,
      subscriptionRatio = 0.2,
    } = options;

    const products: Promise<Product>[] = [];

    for (let i = 0; i < quantity; i++) {
      const shouldBeSubscription = Math.random() < subscriptionRatio;
      const shouldBeInactive = includeInactive && Math.random() < 0.1;
      const shouldBeOutOfStock = includeOutOfStock && Math.random() < 0.1;
      
      const price = faker.number.float({
        min: priceRange.min,
        max: priceRange.max,
        fractionDigits: 2,
      });

      let productPromise: Promise<Product>;

      if (shouldBeInactive) {
        productPromise = this.createInactiveProduct({
          price,
          tags: this.getCategoryTags(category),
        });
      } else if (shouldBeOutOfStock) {
        productPromise = this.createOutOfStockProduct({
          price,
          tags: this.getCategoryTags(category),
        });
      } else if (shouldBeSubscription) {
        productPromise = this.createSubscriptionProduct({
          price,
          tags: this.getCategoryTags(category),
        });
      } else {
        productPromise = this.createProduct({
          price,
          tags: this.getCategoryTags(category),
          type: 'ONE_TIME',
        });
      }

      products.push(productPromise);
    }

    return Promise.all(products);
  }

  /**
   * Create products for specific test scenarios
   */
  async createTestScenarios(): Promise<{
    activeProducts: Product[];
    inactiveProducts: Product[];
    digitalProducts: Product[];
    physicalProducts: Product[];
    subscriptionProducts: Product[];
    saleProducts: Product[];
    lowStockProducts: Product[];
    outOfStockProducts: Product[];
  }> {
    const [
      activeProducts,
      inactiveProducts,
      digitalProducts,
      physicalProducts,
      subscriptionProducts,
      saleProducts,
      lowStockProducts,
      outOfStockProducts,
    ] = await Promise.all([
      // Active products
      Promise.all([
        this.createProduct({ name: 'Active Product 1' }),
        this.createProduct({ name: 'Active Product 2' }),
        this.createProduct({ name: 'Active Product 3' }),
      ]),
      
      // Inactive products
      Promise.all([
        this.createInactiveProduct({ name: 'Inactive Product 1' }),
        this.createInactiveProduct({ name: 'Inactive Product 2' }),
      ]),
      
      // Digital products
      Promise.all([
        this.createDigitalProduct({ name: 'Digital Product 1' }),
        this.createDigitalProduct({ name: 'Digital Product 2' }),
      ]),
      
      // Physical products
      Promise.all([
        this.createPhysicalProduct({ name: 'Physical Product 1' }),
        this.createPhysicalProduct({ name: 'Physical Product 2' }),
      ]),
      
      // Subscription products
      Promise.all([
        this.createSubscriptionProduct({ name: 'Monthly Subscription' }),
        this.createSubscriptionProduct({ name: 'Yearly Subscription', billingInterval: 'YEAR' }),
      ]),
      
      // Sale products
      Promise.all([
        this.createSaleProduct({ name: 'Sale Product 1' }),
        this.createSaleProduct({ name: 'Sale Product 2' }),
      ]),
      
      // Low stock products
      Promise.all([
        this.createLowStockProduct({ name: 'Low Stock Product 1' }),
        this.createLowStockProduct({ name: 'Low Stock Product 2' }),
      ]),
      
      // Out of stock products
      Promise.all([
        this.createOutOfStockProduct({ name: 'Out of Stock Product 1' }),
        this.createOutOfStockProduct({ name: 'Out of Stock Product 2' }),
      ]),
    ]);

    return {
      activeProducts,
      inactiveProducts,
      digitalProducts,
      physicalProducts,
      subscriptionProducts,
      saleProducts,
      lowStockProducts,
      outOfStockProducts,
    };
  }

  // ==========================================================================
  // EDGE CASE PRODUCT CREATION
  // ==========================================================================

  /**
   * Create products for testing edge cases
   */
  async createEdgeCaseProducts(): Promise<{
    minPriceProduct: Product;
    maxPriceProduct: Product;
    longNameProduct: Product;
    specialCharactersProduct: Product;
    maxTagsProduct: Product;
    maxImagesProduct: Product;
    unicodeProduct: Product;
  }> {
    return {
      minPriceProduct: await this.createProduct({
        name: 'Minimum Price Product',
        price: 0.01,
        tags: ['edge-case', 'min-price'],
      }),
      
      maxPriceProduct: await this.createProduct({
        name: 'Maximum Price Product',
        price: 999999.99,
        tags: ['edge-case', 'max-price'],
      }),
      
      longNameProduct: await this.createProduct({
        name: 'A'.repeat(100), // Maximum allowed length
        tags: ['edge-case', 'long-name'],
      }),
      
      specialCharactersProduct: await this.createProduct({
        name: "Product with 'Special' Characters-123",
        description: 'Product with special characters: &, <, >, ", \', etc.',
        tags: ['edge-case', 'special-chars'],
      }),
      
      maxTagsProduct: await this.createProduct({
        name: 'Maximum Tags Product',
        tags: Array.from({ length: 20 }, (_, i) => `tag-${i + 1}`),
      }),
      
      maxImagesProduct: await this.createProduct({
        name: 'Maximum Images Product',
        images: Array.from({ length: 10 }, (_, i) => 
          `https://example.com/image-${i + 1}.jpg`
        ),
        tags: ['edge-case', 'max-images'],
      }),
      
      unicodeProduct: await this.createProduct({
        name: '产品名称 🛒 Продукт',
        description: 'Unicode description with emoji 📱 and various languages',
        tags: ['unicode', 'international', '测试'],
      }),
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Generate a realistic product name based on type
   */
  private generateProductName(type?: ProductType): string {
    const productTypes = {
      'ONE_TIME': () => faker.commerce.productName(),
      'SUBSCRIPTION': () => `${faker.company.name()} ${faker.helpers.arrayElement(['Pro', 'Premium', 'Enterprise', 'Basic'])} Plan`,
      'USAGE_BASED': () => `${faker.word.verb({ length: { min: 5, max: 10 } })} API Credits`,
    };

    if (type && productTypes[type]) {
      return productTypes[type]();
    }

    return faker.commerce.productName();
  }

  /**
   * Generate realistic pricing based on product type
   */
  private generateRealisticPrice(type?: ProductType): number {
    const priceRanges = {
      'ONE_TIME': { min: 9.99, max: 499.99 },
      'SUBSCRIPTION': { min: 4.99, max: 99.99 },
      'USAGE_BASED': { min: 0.01, max: 9.99 },
    };

    const range = priceRanges[type || 'ONE_TIME'];
    return faker.number.float({
      min: range.min,
      max: range.max,
      fractionDigits: 2,
    });
  }

  /**
   * Generate subscription-appropriate pricing
   */
  private generateSubscriptionPrice(interval: BillingInterval): number {
    const priceRanges = {
      'DAY': { min: 0.99, max: 9.99 },
      'WEEK': { min: 4.99, max: 29.99 },
      'MONTH': { min: 9.99, max: 99.99 },
      'YEAR': { min: 99.99, max: 999.99 },
    };

    const range = priceRanges[interval] || priceRanges['MONTH'];
    return faker.number.float({
      min: range.min,
      max: range.max,
      fractionDigits: 2,
    });
  }

  /**
   * Generate product description
   */
  private generateProductDescription(name: string): string {
    const features = Array.from({ length: faker.number.int({ min: 3, max: 6 }) }, () => 
      faker.commerce.productDescription()
    );

    return `${name} offers exceptional value with features including: ${features.join(', ')}. Perfect for ${faker.commerce.department().toLowerCase()} enthusiasts and professionals alike.`;
  }

  /**
   * Generate SEO meta description
   */
  private generateMetaDescription(name: string): string {
    const benefit = faker.commerce.productAdjective();
    const action = faker.helpers.arrayElement(['Buy', 'Shop', 'Get', 'Order']);
    return `${action} ${name} - ${benefit} quality at unbeatable prices. Free shipping available.`;
  }

  /**
   * Generate product tags based on type and name
   */
  private generateProductTags(type?: ProductType, name?: string): string[] {
    const baseTags = [
      faker.commerce.department().toLowerCase(),
      faker.commerce.productMaterial().toLowerCase(),
    ];

    const typeTags = {
      'ONE_TIME': ['one-time', 'purchase'],
      'SUBSCRIPTION': ['subscription', 'recurring', 'service'],
      'USAGE_BASED': ['usage-based', 'pay-per-use', 'api'],
    };

    if (type && typeTags[type]) {
      baseTags.push(...typeTags[type]);
    }

    // Add name-derived tags
    if (name) {
      const nameWords = name.toLowerCase().split(' ');
      const relevantWords = nameWords.filter(word => 
        word.length > 3 && !['the', 'and', 'with', 'for'].includes(word)
      );
      baseTags.push(...relevantWords.slice(0, 2));
    }

    // Remove duplicates and limit to reasonable number
    return [...new Set(baseTags)].slice(0, 8);
  }

  /**
   * Generate product images
   */
  private generateProductImages(_name: string): string[] {
    const imageCount = faker.number.int({ min: 1, max: 5 });
    return Array.from({ length: imageCount }, () => 
      faker.image.urlPicsumPhotos({ width: 800, height: 600 })
    );
  }

  /**
   * Generate unique SKU
   */
  private generateUniqueSku(): string {
    let sku: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      sku = faker.string.alphanumeric(8).toUpperCase();
      attempts++;
    } while (this.usedSkus.has(sku) && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      sku = `${faker.string.alphanumeric(6).toUpperCase()}-${Date.now()}`;
    }

    this.usedSkus.add(sku);
    return sku;
  }

  /**
   * Generate unique slug from name
   */
  private generateUniqueSlug(name: string): string {
    const baseSlug = faker.helpers.slugify(name).toLowerCase();
    let slug = baseSlug;
    let attempts = 0;
    const maxAttempts = 100;

    while (this.usedSlugs.has(slug) && attempts < maxAttempts) {
      slug = `${baseSlug}-${faker.string.alphanumeric(4).toLowerCase()}`;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      slug = `${baseSlug}-${Date.now()}`;
    }

    this.usedSlugs.add(slug);
    return slug;
  }

  /**
   * Get category-specific tags
   */
  private getCategoryTags(category: string): string[] {
    const categoryTags = {
      electronics: ['electronics', 'tech', 'gadgets', 'digital'],
      software: ['software', 'digital', 'license', 'download'],
      books: ['books', 'reading', 'education', 'literature'],
      clothing: ['clothing', 'fashion', 'apparel', 'style'],
      home: ['home', 'house', 'living', 'furniture'],
      sports: ['sports', 'fitness', 'outdoor', 'activity'],
      mixed: [],
    };

    const baseTags = categoryTags[category as keyof typeof categoryTags] || [];
    
    // Add some random additional tags
    const additionalTags = [
      faker.commerce.productAdjective().toLowerCase(),
      faker.commerce.productMaterial().toLowerCase(),
    ];

    return [...baseTags, ...additionalTags].slice(0, 6);
  }

  /**
   * Clear internal caches (useful between test runs)
   */
  clearCaches(): void {
    this.usedSlugs.clear();
    this.usedSkus.clear();
  }

  /**
   * Reset factory state for fresh test runs
   */
  reset(): void {
    this.clearCaches();
  }
}