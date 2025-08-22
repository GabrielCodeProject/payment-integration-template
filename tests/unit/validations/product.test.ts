import { z } from 'zod';
import {
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
  productSortSchema,
  updateStockSchema,
  updatePriceSchema,
  bulkPriceUpdateSchema,
  productImageUploadSchema,
  productImageUpdateSchema,
  updateSeoSchema,
  bulkProductUpdateSchema,
  productImportSchema,
  publicProductSchema,
  productListItemSchema,
  productDetailsSchema,
  productTypeSchema,
  billingIntervalSchema,
  lowStockAlertSchema,
  stockLevelSchema,
  ProductType,
  BillingInterval,
  CreateProduct,
  UpdateProduct,
  ProductFilter,
  ProductSort,
  UpdateStock,
  UpdatePrice,
  ProductListItem,
  ProductDetails,
} from '@/lib/validations/base/product';

/**
 * Comprehensive test suite for product validation schemas
 * 
 * Tests all product-related validation rules including:
 * - Basic product schema validation
 * - Create and update operations
 * - Cross-field validation rules
 * - Edge cases and error handling
 * - Business rule validation
 */

describe('Product Validation Schemas', () => {
  // ==========================================================================
  // ENUM TESTS
  // ==========================================================================

  describe('Product Enums', () => {
    describe('productTypeSchema', () => {
      it('should accept valid product types', () => {
        expect(() => productTypeSchema.parse('ONE_TIME')).not.toThrow();
        expect(() => productTypeSchema.parse('SUBSCRIPTION')).not.toThrow();
        expect(() => productTypeSchema.parse('USAGE_BASED')).not.toThrow();
      });

      it('should reject invalid product types', () => {
        expect(() => productTypeSchema.parse('INVALID')).toThrow();
        expect(() => productTypeSchema.parse('one_time')).toThrow();
        expect(() => productTypeSchema.parse('')).toThrow();
        expect(() => productTypeSchema.parse(null)).toThrow();
      });
    });

    describe('billingIntervalSchema', () => {
      it('should accept valid billing intervals', () => {
        expect(() => billingIntervalSchema.parse('DAY')).not.toThrow();
        expect(() => billingIntervalSchema.parse('WEEK')).not.toThrow();
        expect(() => billingIntervalSchema.parse('MONTH')).not.toThrow();
        expect(() => billingIntervalSchema.parse('YEAR')).not.toThrow();
      });

      it('should reject invalid billing intervals', () => {
        expect(() => billingIntervalSchema.parse('MONTHLY')).toThrow();
        expect(() => billingIntervalSchema.parse('YEARLY')).toThrow();
        expect(() => billingIntervalSchema.parse('day')).toThrow();
        expect(() => billingIntervalSchema.parse('')).toThrow();
      });
    });
  });

  // ==========================================================================
  // CREATE PRODUCT SCHEMA TESTS
  // ==========================================================================

  describe('createProductSchema', () => {
    const validProductData: CreateProduct = {
      name: 'Test Product',
      description: 'A comprehensive test product description',
      shortDescription: 'Test product short description',
      price: 99.99,
      currency: 'USD',
      sku: 'TEST-PROD-001',
      slug: 'test-product-001',
      isDigital: false,
      requiresShipping: true,
      type: 'ONE_TIME',
      tags: ['electronics', 'gadgets'],
      images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
      thumbnail: 'https://example.com/thumbnail.jpg',
      metaTitle: 'Test Product - Buy Now',
      metaDescription: 'High-quality test product available for purchase',
      stockQuantity: 100,
      lowStockThreshold: 10,
      compareAtPrice: 129.99,
    };

    describe('Valid Data', () => {
      it('should accept valid product creation data', () => {
        expect(() => createProductSchema.parse(validProductData)).not.toThrow();
      });

      it('should apply default values correctly', () => {
        const minimalData = {
          name: 'Minimal Product',
          price: 29.99,
          sku: 'MIN-001',
          slug: 'minimal-product',
        };

        const result = createProductSchema.parse(minimalData);
        expect(result.type).toBe('ONE_TIME');
        expect(result.isDigital).toBe(false);
        expect(result.currency).toBe('USD');
      });

      it('should accept subscription products with billing intervals', () => {
        const subscriptionData = {
          ...validProductData,
          type: 'SUBSCRIPTION' as ProductType,
          billingInterval: 'MONTH' as BillingInterval,
        };

        expect(() => createProductSchema.parse(subscriptionData)).not.toThrow();
      });
    });

    describe('Required Fields', () => {
      it('should require name', () => {
        const dataWithoutName = { ...validProductData };
        delete (dataWithoutName as any).name;
        expect(() => createProductSchema.parse(dataWithoutName)).toThrow();
      });

      it('should require price', () => {
        const dataWithoutPrice = { ...validProductData };
        delete (dataWithoutPrice as any).price;
        expect(() => createProductSchema.parse(dataWithoutPrice)).toThrow();
      });

      it('should require sku', () => {
        const dataWithoutSku = { ...validProductData };
        delete (dataWithoutSku as any).sku;
        expect(() => createProductSchema.parse(dataWithoutSku)).toThrow();
      });

      it('should require slug', () => {
        const dataWithoutSlug = { ...validProductData };
        delete (dataWithoutSlug as any).slug;
        expect(() => createProductSchema.parse(dataWithoutSlug)).toThrow();
      });
    });

    describe('Field Validation', () => {
      it('should validate name length and format', () => {
        // Name too short
        expect(() => createProductSchema.parse({
          ...validProductData,
          name: '',
        })).toThrow();

        // Name too long
        expect(() => createProductSchema.parse({
          ...validProductData,
          name: 'a'.repeat(101),
        })).toThrow();

        // Invalid characters in name
        expect(() => createProductSchema.parse({
          ...validProductData,
          name: 'Product <script>alert("xss")</script>',
        })).toThrow();
      });

      it('should validate price constraints', () => {
        // Negative price
        expect(() => createProductSchema.parse({
          ...validProductData,
          price: -10,
        })).toThrow();

        // Zero price
        expect(() => createProductSchema.parse({
          ...validProductData,
          price: 0,
        })).toThrow();

        // Price too high
        expect(() => createProductSchema.parse({
          ...validProductData,
          price: 1000000,
        })).toThrow();

        // Valid price with decimals
        expect(() => createProductSchema.parse({
          ...validProductData,
          price: 99.99,
        })).not.toThrow();
      });

      it('should validate SKU format', () => {
        // Invalid characters
        expect(() => createProductSchema.parse({
          ...validProductData,
          sku: 'test-product-001',
        })).toThrow();

        // Too long
        expect(() => createProductSchema.parse({
          ...validProductData,
          sku: 'A'.repeat(51),
        })).toThrow();

        // Valid SKU
        expect(() => createProductSchema.parse({
          ...validProductData,
          sku: 'PROD-001-A',
        })).not.toThrow();
      });

      it('should validate slug format', () => {
        // Invalid characters
        expect(() => createProductSchema.parse({
          ...validProductData,
          slug: 'Product Name',
        })).toThrow();

        // Uppercase letters
        expect(() => createProductSchema.parse({
          ...validProductData,
          slug: 'Product-Name',
        })).toThrow();

        // Valid slug
        expect(() => createProductSchema.parse({
          ...validProductData,
          slug: 'product-name-123',
        })).not.toThrow();
      });

      it('should validate SEO field lengths', () => {
        // Meta title too long
        expect(() => createProductSchema.parse({
          ...validProductData,
          metaTitle: 'a'.repeat(71),
        })).toThrow();

        // Meta description too long
        expect(() => createProductSchema.parse({
          ...validProductData,
          metaDescription: 'a'.repeat(161),
        })).toThrow();

        // Valid SEO fields
        expect(() => createProductSchema.parse({
          ...validProductData,
          metaTitle: 'Valid Meta Title',
          metaDescription: 'Valid meta description within limits',
        })).not.toThrow();
      });

      it('should validate inventory fields', () => {
        // Negative stock quantity
        expect(() => createProductSchema.parse({
          ...validProductData,
          stockQuantity: -1,
        })).toThrow();

        // Negative low stock threshold
        expect(() => createProductSchema.parse({
          ...validProductData,
          lowStockThreshold: -5,
        })).toThrow();

        // Valid inventory fields
        expect(() => createProductSchema.parse({
          ...validProductData,
          stockQuantity: 100,
          lowStockThreshold: 10,
        })).not.toThrow();
      });

      it('should validate tags array', () => {
        // Too many tags
        expect(() => createProductSchema.parse({
          ...validProductData,
          tags: Array.from({ length: 21 }, (_, i) => `tag${i}`),
        })).toThrow();

        // Empty tag
        expect(() => createProductSchema.parse({
          ...validProductData,
          tags: ['valid-tag', ''],
        })).toThrow();

        // Tag too long
        expect(() => createProductSchema.parse({
          ...validProductData,
          tags: ['a'.repeat(51)],
        })).toThrow();

        // Valid tags
        expect(() => createProductSchema.parse({
          ...validProductData,
          tags: ['electronics', 'gadgets', 'tech'],
        })).not.toThrow();
      });

      it('should validate images array', () => {
        // Too many images
        expect(() => createProductSchema.parse({
          ...validProductData,
          images: Array.from({ length: 11 }, (_, i) => `https://example.com/image${i}.jpg`),
        })).toThrow();

        // Invalid URL
        expect(() => createProductSchema.parse({
          ...validProductData,
          images: ['not-a-url'],
        })).toThrow();

        // Valid images
        expect(() => createProductSchema.parse({
          ...validProductData,
          images: [
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ],
        })).not.toThrow();
      });
    });

    describe('Cross-Field Validation', () => {
      it('should require billing interval for subscription products', () => {
        const subscriptionWithoutInterval = {
          ...validProductData,
          type: 'SUBSCRIPTION' as ProductType,
          billingInterval: undefined,
        };

        expect(() => createProductSchema.parse(subscriptionWithoutInterval)).toThrow();
      });

      it('should validate compareAtPrice is higher than price', () => {
        const invalidComparePrice = {
          ...validProductData,
          price: 100,
          compareAtPrice: 90,
        };

        expect(() => createProductSchema.parse(invalidComparePrice)).toThrow();
      });

      it('should not allow digital products to require shipping', () => {
        const digitalWithShipping = {
          ...validProductData,
          isDigital: true,
          requiresShipping: true,
        };

        expect(() => createProductSchema.parse(digitalWithShipping)).toThrow();
      });

      it('should not allow digital products to have stock quantity', () => {
        const digitalWithStock = {
          ...validProductData,
          isDigital: true,
          stockQuantity: 100,
        };

        expect(() => createProductSchema.parse(digitalWithStock)).toThrow();
      });

      it('should allow valid digital product configuration', () => {
        const validDigital = {
          ...validProductData,
          isDigital: true,
          requiresShipping: false,
          stockQuantity: undefined,
        };

        expect(() => createProductSchema.parse(validDigital)).not.toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle decimal precision in price', () => {
        const precisePrice = {
          ...validProductData,
          price: 99.999, // Should be rounded to 99.99
        };

        const result = createProductSchema.parse(precisePrice);
        expect(result.price).toBe(99.999);
      });

      it('should handle empty optional arrays', () => {
        const withEmptyArrays = {
          ...validProductData,
          tags: [],
          images: [],
        };

        expect(() => createProductSchema.parse(withEmptyArrays)).not.toThrow();
      });

      it('should handle undefined optional fields', () => {
        const minimalProduct = {
          name: 'Minimal Product',
          price: 29.99,
          sku: 'MIN-001',
          slug: 'minimal-product',
        };

        expect(() => createProductSchema.parse(minimalProduct)).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // UPDATE PRODUCT SCHEMA TESTS
  // ==========================================================================

  describe('updateProductSchema', () => {
    const validUpdateData: UpdateProduct = {
      id: 'clx123456789',
      name: 'Updated Product Name',
      price: 129.99,
      isActive: false,
    };

    describe('Valid Updates', () => {
      it('should accept valid update data', () => {
        expect(() => updateProductSchema.parse(validUpdateData)).not.toThrow();
      });

      it('should require id field', () => {
        const updateWithoutId = { ...validUpdateData };
        delete (updateWithoutId as any).id;
        expect(() => updateProductSchema.parse(updateWithoutId)).toThrow();
      });

      it('should allow partial updates', () => {
        const partialUpdate = {
          id: 'clx123456789',
          name: 'New Name Only',
        };

        expect(() => updateProductSchema.parse(partialUpdate)).not.toThrow();
      });
    });

    describe('Cross-Field Validation in Updates', () => {
      it('should validate compareAtPrice against price in updates', () => {
        const invalidUpdate = {
          id: 'clx123456789',
          price: 100,
          compareAtPrice: 90,
        };

        expect(() => updateProductSchema.parse(invalidUpdate)).toThrow();
      });

      it('should require billing interval when updating type to subscription', () => {
        const subscriptionUpdate = {
          id: 'clx123456789',
          type: 'SUBSCRIPTION' as ProductType,
        };

        expect(() => updateProductSchema.parse(subscriptionUpdate)).toThrow();
      });

      it('should allow valid subscription update', () => {
        const validSubscriptionUpdate = {
          id: 'clx123456789',
          type: 'SUBSCRIPTION' as ProductType,
          billingInterval: 'MONTH' as BillingInterval,
        };

        expect(() => updateProductSchema.parse(validSubscriptionUpdate)).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // SPECIALIZED SCHEMA TESTS
  // ==========================================================================

  describe('updateStockSchema', () => {
    it('should validate stock update operations', () => {
      const validStockUpdate: UpdateStock = {
        productId: 'clx123456789',
        quantity: 10,
        operation: 'increment',
        reason: 'Restocked inventory',
      };

      expect(() => updateStockSchema.parse(validStockUpdate)).not.toThrow();
    });

    it('should require valid operation types', () => {
      const invalidOperation = {
        productId: 'clx123456789',
        quantity: 10,
        operation: 'invalid',
      };

      expect(() => updateStockSchema.parse(invalidOperation)).toThrow();
    });

    it('should allow negative quantities for decrement operations', () => {
      const decrementUpdate = {
        productId: 'clx123456789',
        quantity: -5,
        operation: 'decrement',
      };

      expect(() => updateStockSchema.parse(decrementUpdate)).not.toThrow();
    });
  });

  describe('updatePriceSchema', () => {
    it('should validate price updates', () => {
      const validPriceUpdate: UpdatePrice = {
        productId: 'clx123456789',
        price: 149.99,
        compareAtPrice: 199.99,
        effectiveDate: new Date('2024-01-01'),
      };

      expect(() => updatePriceSchema.parse(validPriceUpdate)).not.toThrow();
    });

    it('should validate compareAtPrice is higher than price', () => {
      const invalidPriceUpdate = {
        productId: 'clx123456789',
        price: 149.99,
        compareAtPrice: 99.99,
      };

      expect(() => updatePriceSchema.parse(invalidPriceUpdate)).toThrow();
    });
  });

  describe('bulkPriceUpdateSchema', () => {
    it('should validate bulk price updates', () => {
      const validBulkUpdate = {
        productIds: ['clx123456789', 'clx987654321'],
        priceAdjustment: {
          type: 'percentage',
          value: 10,
        },
      };

      expect(() => bulkPriceUpdateSchema.parse(validBulkUpdate)).not.toThrow();
    });

    it('should require at least one product', () => {
      const emptyBulkUpdate = {
        productIds: [],
        priceAdjustment: {
          type: 'percentage',
          value: 10,
        },
      };

      expect(() => bulkPriceUpdateSchema.parse(emptyBulkUpdate)).toThrow();
    });
  });

  describe('productImageUploadSchema', () => {
    it('should validate image upload data', () => {
      const validImageUpload = {
        productId: 'clx123456789',
        imageUrl: 'https://example.com/product-image.jpg',
        altText: 'Product image description',
        sortOrder: 1,
      };

      expect(() => productImageUploadSchema.parse(validImageUpload)).not.toThrow();
    });

    it('should limit alt text length', () => {
      const longAltText = {
        productId: 'clx123456789',
        imageUrl: 'https://example.com/product-image.jpg',
        altText: 'a'.repeat(256),
      };

      expect(() => productImageUploadSchema.parse(longAltText)).toThrow();
    });
  });

  describe('productImageUpdateSchema', () => {
    it('should validate image array updates', () => {
      const validImageUpdate = {
        productId: 'clx123456789',
        images: [
          {
            url: 'https://example.com/image1.jpg',
            altText: 'First image',
            sortOrder: 0,
          },
          {
            url: 'https://example.com/image2.jpg',
            altText: 'Second image',
            sortOrder: 1,
          },
        ],
      };

      expect(() => productImageUpdateSchema.parse(validImageUpdate)).not.toThrow();
    });

    it('should limit number of images', () => {
      const tooManyImages = {
        productId: 'clx123456789',
        images: Array.from({ length: 11 }, (_, i) => ({
          url: `https://example.com/image${i}.jpg`,
          altText: `Image ${i}`,
          sortOrder: i,
        })),
      };

      expect(() => productImageUpdateSchema.parse(tooManyImages)).toThrow();
    });
  });

  describe('updateSeoSchema', () => {
    it('should validate SEO field updates', () => {
      const validSeoUpdate = {
        productId: 'clx123456789',
        slug: 'updated-product-slug',
        metaTitle: 'Updated Product Title',
        metaDescription: 'Updated product meta description',
        tags: ['updated', 'seo', 'tags'],
      };

      expect(() => updateSeoSchema.parse(validSeoUpdate)).not.toThrow();
    });

    it('should validate meta field lengths', () => {
      const invalidSeoUpdate = {
        productId: 'clx123456789',
        metaTitle: 'a'.repeat(71),
        metaDescription: 'a'.repeat(161),
      };

      expect(() => updateSeoSchema.parse(invalidSeoUpdate)).toThrow();
    });
  });

  // ==========================================================================
  // FILTER AND SORT SCHEMA TESTS
  // ==========================================================================

  describe('productFilterSchema', () => {
    it('should accept valid filter criteria', () => {
      const validFilter: ProductFilter = {
        name: 'search term',
        type: 'SUBSCRIPTION',
        isActive: true,
        isDigital: false,
        inStock: true,
        priceMin: 10,
        priceMax: 1000,
        tags: ['electronics', 'gadgets'],
        createdAfter: new Date('2024-01-01'),
        createdBefore: new Date('2024-12-31'),
      };

      expect(() => productFilterSchema.parse(validFilter)).not.toThrow();
    });

    it('should accept empty filter object', () => {
      expect(() => productFilterSchema.parse({})).not.toThrow();
    });

    it('should validate price range constraints', () => {
      const negativePriceFilter = {
        priceMin: -10,
      };

      expect(() => productFilterSchema.parse(negativePriceFilter)).toThrow();
    });
  });

  describe('productSortSchema', () => {
    it('should accept valid sort fields', () => {
      expect(() => productSortSchema.parse('name')).not.toThrow();
      expect(() => productSortSchema.parse('price')).not.toThrow();
      expect(() => productSortSchema.parse('createdAt')).not.toThrow();
      expect(() => productSortSchema.parse('updatedAt')).not.toThrow();
      expect(() => productSortSchema.parse('stockQuantity')).not.toThrow();
      expect(() => productSortSchema.parse('type')).not.toThrow();
    });

    it('should reject invalid sort fields', () => {
      expect(() => productSortSchema.parse('invalidField')).toThrow();
    });
  });

  // ==========================================================================
  // INVENTORY SCHEMA TESTS
  // ==========================================================================

  describe('lowStockAlertSchema', () => {
    it('should validate low stock alert configuration', () => {
      const validAlert = {
        productId: 'clx123456789',
        threshold: 10,
      };

      expect(() => lowStockAlertSchema.parse(validAlert)).not.toThrow();
    });

    it('should require positive threshold', () => {
      const invalidAlert = {
        productId: 'clx123456789',
        threshold: 0,
      };

      expect(() => lowStockAlertSchema.parse(invalidAlert)).toThrow();
    });
  });

  describe('stockLevelSchema', () => {
    it('should validate stock level data', () => {
      const validStockLevel = {
        productId: 'clx123456789',
        currentStock: 100,
        reservedStock: 10,
        availableStock: 90,
        lowStockThreshold: 20,
        isLowStock: false,
      };

      expect(() => stockLevelSchema.parse(validStockLevel)).not.toThrow();
    });

    it('should require non-negative stock values', () => {
      const invalidStockLevel = {
        productId: 'clx123456789',
        currentStock: -5,
        reservedStock: 0,
        availableStock: 0,
        isLowStock: false,
      };

      expect(() => stockLevelSchema.parse(invalidStockLevel)).toThrow();
    });
  });

  // ==========================================================================
  // BULK OPERATIONS TESTS
  // ==========================================================================

  describe('bulkProductUpdateSchema', () => {
    it('should validate bulk product updates', () => {
      const validBulkUpdate = {
        productIds: ['clx123456789', 'clx987654321'],
        updates: {
          isActive: false,
          tags: ['clearance', 'sale'],
          type: 'ONE_TIME' as ProductType,
        },
      };

      expect(() => bulkProductUpdateSchema.parse(validBulkUpdate)).not.toThrow();
    });

    it('should require at least one product ID', () => {
      const emptyBulkUpdate = {
        productIds: [],
        updates: {
          isActive: false,
        },
      };

      expect(() => bulkProductUpdateSchema.parse(emptyBulkUpdate)).toThrow();
    });
  });

  describe('productImportSchema', () => {
    it('should validate product import data', () => {
      const validImport = {
        products: [
          {
            name: 'Import Product 1',
            price: 99.99,
            sku: 'IMPORT-001',
            slug: 'import-product-1',
          },
          {
            name: 'Import Product 2',
            price: 149.99,
            sku: 'IMPORT-002',
            slug: 'import-product-2',
          },
        ],
        skipDuplicates: true,
        updateExisting: false,
      };

      expect(() => productImportSchema.parse(validImport)).not.toThrow();
    });

    it('should require at least one product', () => {
      const emptyImport = {
        products: [],
        skipDuplicates: true,
        updateExisting: false,
      };

      expect(() => productImportSchema.parse(emptyImport)).toThrow();
    });
  });

  // ==========================================================================
  // PUBLIC SCHEMA TESTS
  // ==========================================================================

  describe('publicProductSchema', () => {
    it('should exclude sensitive fields', () => {
      const fullProduct = {
        id: 'clx123456789',
        name: 'Test Product',
        description: 'Test description',
        shortDescription: 'Test short description',
        price: 99.99,
        currency: 'USD',
        compareAtPrice: 129.99,
        sku: 'TEST-001',
        isActive: true,
        isDigital: false,
        requiresShipping: true,
        stockQuantity: 100, // Should be excluded
        lowStockThreshold: 10, // Should be excluded
        slug: 'test-product',
        metaTitle: 'Test Product',
        metaDescription: 'Test meta description',
        tags: ['test'],
        images: ['https://example.com/image.jpg'],
        thumbnail: 'https://example.com/thumb.jpg',
        stripePriceId: 'price_test123', // Should be excluded
        stripeProductId: 'prod_test123', // Should be excluded
        type: 'ONE_TIME',
        billingInterval: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        inStock: true, // Should be included
        isOnSale: true, // Should be included
        discountPercentage: 23, // Should be included
      };

      const result = publicProductSchema.parse(fullProduct);
      
      expect(result).toHaveProperty('inStock');
      expect(result).toHaveProperty('isOnSale');
      expect(result).not.toHaveProperty('stockQuantity');
      expect(result).not.toHaveProperty('lowStockThreshold');
      expect(result).not.toHaveProperty('stripePriceId');
      expect(result).not.toHaveProperty('stripeProductId');
    });
  });

  describe('productListItemSchema', () => {
    it('should validate product list items', () => {
      const validListItem: ProductListItem = {
        id: 'clx123456789',
        name: 'Test Product',
        shortDescription: 'Test short description',
        price: 99.99,
        compareAtPrice: 129.99,
        currency: 'USD',
        thumbnail: 'https://example.com/thumb.jpg',
        slug: 'test-product',
        type: 'ONE_TIME',
        isActive: true,
        inStock: true,
        isOnSale: true,
        createdAt: new Date('2024-01-01'),
      };

      expect(() => productListItemSchema.parse(validListItem)).not.toThrow();
    });
  });

  describe('productDetailsSchema', () => {
    it('should validate detailed product information', () => {
      const validDetails: ProductDetails = {
        id: 'clx123456789',
        name: 'Test Product',
        description: 'Detailed test description',
        shortDescription: 'Test short description',
        price: 99.99,
        currency: 'USD',
        compareAtPrice: 129.99,
        sku: 'TEST-001',
        isActive: true,
        isDigital: false,
        requiresShipping: true,
        slug: 'test-product',
        metaTitle: 'Test Product',
        metaDescription: 'Test meta description',
        tags: ['test'],
        images: ['https://example.com/image.jpg'],
        thumbnail: 'https://example.com/thumb.jpg',
        type: 'ONE_TIME',
        billingInterval: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        inStock: true,
        isOnSale: true,
        discountPercentage: 23,
        relatedProducts: [],
        reviews: {
          averageRating: 4.5,
          totalReviews: 127,
        },
      };

      expect(() => productDetailsSchema.parse(validDetails)).not.toThrow();
    });

    it('should validate review ratings are within bounds', () => {
      const invalidRating = {
        averageRating: 6, // Should be max 5
        totalReviews: 10,
      };

      expect(() => z.object({
        reviews: z.object({
          averageRating: z.number().min(0).max(5),
          totalReviews: z.number().min(0),
        }),
      }).parse({ reviews: invalidRating })).toThrow();
    });
  });

  // ==========================================================================
  // TYPE INFERENCE TESTS
  // ==========================================================================

  describe('Type Inference', () => {
    it('should infer correct TypeScript types', () => {
      // Test that TypeScript compilation succeeds with proper types
      const createProduct: CreateProduct = {
        name: 'Type Test Product',
        price: 99.99,
        sku: 'TYPE-TEST',
        slug: 'type-test-product',
        type: 'ONE_TIME',
      };

      const updateProduct: UpdateProduct = {
        id: 'clx123456789',
        name: 'Updated Name',
      };

      const productFilter: ProductFilter = {
        name: 'search',
        type: 'SUBSCRIPTION',
        isActive: true,
      };

      const productSort: ProductSort = 'name';
      
      const stockUpdate: UpdateStock = {
        productId: 'clx123456789',
        quantity: 10,
        operation: 'increment',
      };

      const priceUpdate: UpdatePrice = {
        productId: 'clx123456789',
        price: 129.99,
      };

      // These should compile without TypeScript errors
      expect(createProduct).toBeDefined();
      expect(updateProduct).toBeDefined();
      expect(productFilter).toBeDefined();
      expect(productSort).toBeDefined();
      expect(stockUpdate).toBeDefined();
      expect(priceUpdate).toBeDefined();
    });
  });
});