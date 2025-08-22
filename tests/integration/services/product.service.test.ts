import { PrismaClient } from '@prisma/client';
import { DatabaseTestHelper } from '@tests/setup/jest.setup';
import { TestDataGenerator } from '@tests/fixtures/TestDataGenerator';
import { ProductService } from '@/services/products/product.service';
import type {
  CreateProduct,
  UpdateProduct,
  ProductFilter,
  UpdateStock,
  UpdatePrice,
} from '@/lib/validations/base/product';

/**
 * Comprehensive integration tests for ProductService
 * 
 * Tests all database operations including:
 * - CRUD operations with validation
 * - Database constraints and uniqueness
 * - Inventory management
 * - Price management
 * - Business logic validation
 * - Search and filtering
 * - Bulk operations
 * - Error handling and edge cases
 */

describe('ProductService Integration Tests', () => {
  let prisma: PrismaClient;
  let productService: ProductService;
  let testDataGenerator: TestDataGenerator;

  beforeAll(async () => {
    prisma = await DatabaseTestHelper.getTestDatabase();
    productService = new ProductService(prisma);
    testDataGenerator = new TestDataGenerator(prisma);
  });

  beforeEach(async () => {
    await DatabaseTestHelper.cleanDatabase();
  });

  afterAll(async () => {
    await DatabaseTestHelper.closeDatabase();
  });

  // ==========================================================================
  // CRUD OPERATIONS TESTS
  // ==========================================================================

  describe('Product CRUD Operations', () => {
    describe('create()', () => {
      const validProductData: CreateProduct = {
        name: 'Integration Test Product',
        description: 'A comprehensive test product for integration testing',
        shortDescription: 'Integration test product',
        price: 99.99,
        currency: 'USD',
        sku: 'INT-TEST-001',
        slug: 'integration-test-product',
        isDigital: false,
        requiresShipping: true,
        type: 'ONE_TIME',
        tags: ['integration', 'test'],
        images: ['https://example.com/image1.jpg'],
        thumbnail: 'https://example.com/thumbnail.jpg',
        metaTitle: 'Integration Test Product',
        metaDescription: 'A product for testing integration functionality',
        stockQuantity: 100,
        lowStockThreshold: 10,
        compareAtPrice: 129.99,
      };

      it('should create a valid product successfully', async () => {
        const product = await productService.create(validProductData);

        expect(product).toBeDefined();
        expect(product.id).toBeDefined();
        expect(product.name).toBe(validProductData.name);
        expect(product.sku).toBe(validProductData.sku);
        expect(product.slug).toBe(validProductData.slug);
        expect(parseFloat(product.price.toString())).toBe(validProductData.price);
        expect(product.isActive).toBe(true);
        expect(product.createdAt).toBeDefined();
        expect(product.updatedAt).toBeDefined();
      });

      it('should create subscription products with billing intervals', async () => {
        const subscriptionData: CreateProduct = {
          ...validProductData,
          name: 'Subscription Product',
          sku: 'SUB-TEST-001',
          slug: 'subscription-product',
          type: 'SUBSCRIPTION' as const,
          billingInterval: 'MONTH' as const,
        };

        const product = await productService.create(subscriptionData);

        expect(product.type).toBe('SUBSCRIPTION');
        expect(product.billingInterval).toBe('MONTH');
      });

      it('should create digital products correctly', async () => {
        const digitalData: CreateProduct = {
          ...validProductData,
          name: 'Digital Product',
          sku: 'DIG-TEST-001',
          slug: 'digital-product',
          isDigital: true,
          requiresShipping: false,
          stockQuantity: undefined,
        };

        const product = await productService.create(digitalData);

        expect(product.isDigital).toBe(true);
        expect(product.requiresShipping).toBe(false);
        expect(product.stockQuantity).toBeNull();
      });

      it('should enforce unique SKU constraint', async () => {
        await productService.create(validProductData);

        const duplicateSkuData = {
          ...validProductData,
          name: 'Different Product',
          slug: 'different-product',
        };

        await expect(productService.create(duplicateSkuData))
          .rejects.toThrow('Product with SKU \'INT-TEST-001\' already exists');
      });

      it('should enforce unique slug constraint', async () => {
        await productService.create(validProductData);

        const duplicateSlugData = {
          ...validProductData,
          name: 'Different Product',
          sku: 'DIFF-001',
        };

        await expect(productService.create(duplicateSlugData))
          .rejects.toThrow('Product with slug \'integration-test-product\' already exists');
      });

      it('should validate subscription products require billing intervals', async () => {
        const invalidSubscription: CreateProduct = {
          ...validProductData,
          type: 'SUBSCRIPTION' as const,
          billingInterval: undefined,
        };

        await expect(productService.create(invalidSubscription))
          .rejects.toThrow('Billing interval is required for subscription products');
      });

      it('should validate digital products cannot require shipping', async () => {
        const invalidDigital: CreateProduct = {
          ...validProductData,
          isDigital: true,
          requiresShipping: true,
        };

        await expect(productService.create(invalidDigital))
          .rejects.toThrow('Digital products cannot require shipping');
      });

      it('should validate compareAtPrice is higher than price', async () => {
        const invalidPricing: CreateProduct = {
          ...validProductData,
          price: 100,
          compareAtPrice: 90,
        };

        await expect(productService.create(invalidPricing))
          .rejects.toThrow('Compare at price must be higher than regular price');
      });
    });

    describe('findById()', () => {
      it('should find existing product by ID', async () => {
        const createdProduct = await testDataGenerator.createTestProduct();
        const foundProduct = await productService.findById(createdProduct.id);

        expect(foundProduct).toBeDefined();
        expect(foundProduct?.id).toBe(createdProduct.id);
        expect(foundProduct?.name).toBe(createdProduct.name);
      });

      it('should return null for non-existent product ID', async () => {
        const nonExistentProduct = await productService.findById('non-existent-id');
        expect(nonExistentProduct).toBeNull();
      });
    });

    describe('findBySlug()', () => {
      it('should find existing product by slug', async () => {
        const createdProduct = await testDataGenerator.createTestProduct();
        const foundProduct = await productService.findBySlug(createdProduct.slug);

        expect(foundProduct).toBeDefined();
        expect(foundProduct?.slug).toBe(createdProduct.slug);
        expect(foundProduct?.id).toBe(createdProduct.id);
      });

      it('should return null for non-existent slug', async () => {
        const nonExistentProduct = await productService.findBySlug('non-existent-slug');
        expect(nonExistentProduct).toBeNull();
      });
    });

    describe('findBySku()', () => {
      it('should find existing product by SKU', async () => {
        const createdProduct = await testDataGenerator.createTestProduct();
        const foundProduct = await productService.findBySku(createdProduct.sku!);

        expect(foundProduct).toBeDefined();
        expect(foundProduct?.sku).toBe(createdProduct.sku);
        expect(foundProduct?.id).toBe(createdProduct.id);
      });

      it('should return null for non-existent SKU', async () => {
        const nonExistentProduct = await productService.findBySku('NON-EXISTENT');
        expect(nonExistentProduct).toBeNull();
      });
    });

    describe('update()', () => {
      it('should update product successfully', async () => {
        const createdProduct = await testDataGenerator.createTestProduct();
        
        const updateData: UpdateProduct = {
          id: createdProduct.id,
          name: 'Updated Product Name',
          price: 149.99,
          isActive: false,
        };

        const updatedProduct = await productService.update(updateData);

        expect(updatedProduct.name).toBe('Updated Product Name');
        expect(parseFloat(updatedProduct.price.toString())).toBe(149.99);
        expect(updatedProduct.isActive).toBe(false);
        expect(updatedProduct.updatedAt.getTime()).toBeGreaterThan(createdProduct.updatedAt.getTime());
      });

      it('should throw error for non-existent product', async () => {
        const updateData: UpdateProduct = {
          id: 'non-existent-id',
          name: 'Updated Name',
        };

        await expect(productService.update(updateData))
          .rejects.toThrow('Product with ID \'non-existent-id\' not found');
      });

      it('should enforce unique SKU on update', async () => {
        await testDataGenerator.createTestProduct({ sku: 'PROD-001' });
        const product2 = await testDataGenerator.createTestProduct({ sku: 'PROD-002' });

        const updateData: UpdateProduct = {
          id: product2.id,
          sku: 'PROD-001',
        };

        await expect(productService.update(updateData))
          .rejects.toThrow('Product with SKU \'PROD-001\' already exists');
      });

      it('should enforce unique slug on update', async () => {
        await testDataGenerator.createTestProduct({ slug: 'product-one' });
        const product2 = await testDataGenerator.createTestProduct({ slug: 'product-two' });

        const updateData: UpdateProduct = {
          id: product2.id,
          slug: 'product-one',
        };

        await expect(productService.update(updateData))
          .rejects.toThrow('Product with slug \'product-one\' already exists');
      });

      it('should handle digital product conversion', async () => {
        const physicalProduct = await testDataGenerator.createTestProduct({
          isDigital: false,
          requiresShipping: true,
          stockQuantity: 100,
        });

        const updateData: UpdateProduct = {
          id: physicalProduct.id,
          isDigital: true,
        };

        const updatedProduct = await productService.update(updateData);

        expect(updatedProduct.isDigital).toBe(true);
        expect(updatedProduct.requiresShipping).toBe(false);
        expect(updatedProduct.stockQuantity).toBeNull();
      });

      it('should validate subscription update requires billing interval', async () => {
        const oneTimeProduct = await testDataGenerator.createTestProduct({
          type: 'ONE_TIME',
        });

        const updateData: UpdateProduct = {
          id: oneTimeProduct.id,
          type: 'SUBSCRIPTION' as const,
          // Missing billingInterval
        };

        await expect(productService.update(updateData))
          .rejects.toThrow('Billing interval is required for subscription products');
      });
    });

    describe('softDelete()', () => {
      it('should soft delete product by setting isActive to false', async () => {
        const product = await testDataGenerator.createTestProduct({ isActive: true });
        
        const deletedProduct = await productService.softDelete(product.id);

        expect(deletedProduct.isActive).toBe(false);
        expect(deletedProduct.id).toBe(product.id);

        // Verify product still exists in database
        const foundProduct = await productService.findById(product.id);
        expect(foundProduct).toBeDefined();
        expect(foundProduct?.isActive).toBe(false);
      });

      it('should throw error for non-existent product', async () => {
        await expect(productService.softDelete('non-existent-id'))
          .rejects.toThrow('Product with ID \'non-existent-id\' not found');
      });
    });

    describe('delete()', () => {
      it('should hard delete product with no references', async () => {
        const product = await testDataGenerator.createTestProduct();
        
        await productService.delete(product.id);

        // Verify product no longer exists
        const foundProduct = await productService.findById(product.id);
        expect(foundProduct).toBeNull();
      });

      it('should throw error for non-existent product', async () => {
        await expect(productService.delete('non-existent-id'))
          .rejects.toThrow('Product with ID \'non-existent-id\' not found');
      });

      it('should prevent deletion of products with order references', async () => {
        const user = await testDataGenerator.createTestUser();
        const product = await testDataGenerator.createTestProduct();
        
        // Create an order that references the product
        const order = await testDataGenerator.createTestOrder(user.id);
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            unitPrice: product.price,
            quantity: 1,
            totalPrice: product.price,
          },
        });

        await expect(productService.delete(product.id))
          .rejects.toThrow(/Cannot delete product: .* orders .* reference this product/);
      });

      it('should prevent deletion of products with subscription references', async () => {
        const user = await testDataGenerator.createTestUser();
        const product = await testDataGenerator.createTestProduct();
        
        // Create a subscription that references the product
        await testDataGenerator.createTestSubscription(user.id, product.id);

        await expect(productService.delete(product.id))
          .rejects.toThrow(/Cannot delete product: .* subscriptions reference this product/);
      });
    });
  });

  // ==========================================================================
  // SEARCH AND FILTERING TESTS
  // ==========================================================================

  describe('Search and Filtering', () => {
    beforeEach(async () => {
      // Create test products with different characteristics
      await Promise.all([
        testDataGenerator.createTestProduct({
          name: 'Electronics Gadget',
          type: 'ONE_TIME',
          isActive: true,
          isDigital: false,
          price: 99.99,
          tags: ['electronics', 'gadgets'],
          stockQuantity: 50,
        }),
        testDataGenerator.createTestProduct({
          name: 'Software Subscription',
          type: 'SUBSCRIPTION',
          billingInterval: 'MONTH',
          isActive: true,
          isDigital: true,
          price: 29.99,
          tags: ['software', 'subscription'],
        }),
        testDataGenerator.createTestProduct({
          name: 'Inactive Product',
          type: 'ONE_TIME',
          isActive: false,
          isDigital: false,
          price: 199.99,
          tags: ['inactive'],
          stockQuantity: 0,
        }),
        testDataGenerator.createTestProduct({
          name: 'Premium Service',
          type: 'SUBSCRIPTION',
          billingInterval: 'YEAR',
          isActive: true,
          isDigital: true,
          price: 299.99,
          tags: ['premium', 'service'],
        }),
      ]);
    });

    describe('findMany()', () => {
      it('should return all products with default pagination', async () => {
        const result = await productService.findMany();

        expect(result.products).toHaveLength(4);
        expect(result.total).toBe(4);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
        expect(result.pages).toBe(1);
      });

      it('should filter by name', async () => {
        const filters: ProductFilter = { name: 'Electronics' };
        const result = await productService.findMany(filters);

        expect(result.products).toHaveLength(1);
        expect(result.products[0].name).toContain('Electronics');
      });

      it('should filter by product type', async () => {
        const filters: ProductFilter = { type: 'SUBSCRIPTION' };
        const result = await productService.findMany(filters);

        expect(result.products).toHaveLength(2);
        result.products.forEach(product => {
          expect(product.type).toBe('SUBSCRIPTION');
        });
      });

      it('should filter by active status', async () => {
        const filters: ProductFilter = { isActive: false };
        const result = await productService.findMany(filters);

        expect(result.products).toHaveLength(1);
        expect(result.products[0].name).toBe('Inactive Product');
      });

      it('should filter by digital status', async () => {
        const filters: ProductFilter = { isDigital: true };
        const result = await productService.findMany(filters);

        expect(result.products).toHaveLength(2);
        result.products.forEach(product => {
          expect(product.isDigital).toBe(true);
        });
      });

      it('should filter by stock status', async () => {
        const filters: ProductFilter = { inStock: true };
        const result = await productService.findMany(filters);

        expect(result.products).toHaveLength(3); // Digital products + products with stock
        result.products.forEach(product => {
          expect(product.isDigital || (product.stockQuantity && product.stockQuantity > 0))
            .toBeTruthy();
        });
      });

      it('should filter by price range', async () => {
        const filters: ProductFilter = { priceMin: 50, priceMax: 150 };
        const result = await productService.findMany(filters);

        result.products.forEach(product => {
          const price = parseFloat(product.price.toString());
          expect(price).toBeGreaterThanOrEqual(50);
          expect(price).toBeLessThanOrEqual(150);
        });
      });

      it('should filter by tags', async () => {
        const filters: ProductFilter = { tags: ['electronics'] };
        const result = await productService.findMany(filters);

        expect(result.products).toHaveLength(1);
        expect(result.products[0].tags).toContain('electronics');
      });

      it('should support pagination', async () => {
        const page1 = await productService.findMany({}, 'name', 'asc', 1, 2);
        expect(page1.products).toHaveLength(2);
        expect(page1.page).toBe(1);
        expect(page1.pages).toBe(2);

        const page2 = await productService.findMany({}, 'name', 'asc', 2, 2);
        expect(page2.products).toHaveLength(2);
        expect(page2.page).toBe(2);

        // Ensure different products on different pages
        const page1Ids = page1.products.map(p => p.id);
        const page2Ids = page2.products.map(p => p.id);
        expect(page1Ids).not.toEqual(page2Ids);
      });

      it('should support different sort orders', async () => {
        const byNameAsc = await productService.findMany({}, 'name', 'asc');
        const byNameDesc = await productService.findMany({}, 'name', 'desc');

        expect(byNameAsc.products[0].name).not.toBe(byNameDesc.products[0].name);
        expect(byNameAsc.products[0].name).toBe(byNameDesc.products[byNameDesc.products.length - 1].name);
      });

      it('should combine multiple filters', async () => {
        const filters: ProductFilter = {
          type: 'SUBSCRIPTION',
          isActive: true,
          isDigital: true,
          priceMin: 25,
        };
        const result = await productService.findMany(filters);

        result.products.forEach(product => {
          expect(product.type).toBe('SUBSCRIPTION');
          expect(product.isActive).toBe(true);
          expect(product.isDigital).toBe(true);
          expect(parseFloat(product.price.toString())).toBeGreaterThanOrEqual(25);
        });
      });
    });
  });

  // ==========================================================================
  // INVENTORY MANAGEMENT TESTS
  // ==========================================================================

  describe('Inventory Management', () => {
    describe('updateStock()', () => {
      it('should set stock quantity', async () => {
        const product = await testDataGenerator.createTestProduct({
          isDigital: false,
          stockQuantity: 50,
        });

        const stockUpdate: UpdateStock = {
          productId: product.id,
          quantity: 100,
          operation: 'set',
        };

        const updatedProduct = await productService.updateStock(stockUpdate);

        expect(updatedProduct.stockQuantity).toBe(100);
      });

      it('should increment stock quantity', async () => {
        const product = await testDataGenerator.createTestProduct({
          isDigital: false,
          stockQuantity: 50,
        });

        const stockUpdate: UpdateStock = {
          productId: product.id,
          quantity: 25,
          operation: 'increment',
        };

        const updatedProduct = await productService.updateStock(stockUpdate);

        expect(updatedProduct.stockQuantity).toBe(75);
      });

      it('should decrement stock quantity', async () => {
        const product = await testDataGenerator.createTestProduct({
          isDigital: false,
          stockQuantity: 50,
        });

        const stockUpdate: UpdateStock = {
          productId: product.id,
          quantity: 15,
          operation: 'decrement',
        };

        const updatedProduct = await productService.updateStock(stockUpdate);

        expect(updatedProduct.stockQuantity).toBe(35);
      });

      it('should prevent negative stock quantities', async () => {
        const product = await testDataGenerator.createTestProduct({
          isDigital: false,
          stockQuantity: 10,
        });

        const stockUpdate: UpdateStock = {
          productId: product.id,
          quantity: 15,
          operation: 'decrement',
        };

        await expect(productService.updateStock(stockUpdate))
          .rejects.toThrow('Stock quantity cannot be negative');
      });

      it('should reject stock operations on digital products', async () => {
        const digitalProduct = await testDataGenerator.createTestProduct({
          isDigital: true,
        });

        const stockUpdate: UpdateStock = {
          productId: digitalProduct.id,
          quantity: 10,
          operation: 'set',
        };

        await expect(productService.updateStock(stockUpdate))
          .rejects.toThrow('Cannot manage stock for digital products');
      });

      it('should throw error for non-existent product', async () => {
        const stockUpdate: UpdateStock = {
          productId: 'non-existent-id',
          quantity: 10,
          operation: 'set',
        };

        await expect(productService.updateStock(stockUpdate))
          .rejects.toThrow('Product with ID \'non-existent-id\' not found');
      });
    });

    describe('checkStockAvailability()', () => {
      it('should return true for digital products', async () => {
        const digitalProduct = await testDataGenerator.createTestProduct({
          isDigital: true,
        });

        const isAvailable = await productService.checkStockAvailability(digitalProduct.id, 1000);

        expect(isAvailable).toBe(true);
      });

      it('should return true when sufficient stock exists', async () => {
        const product = await testDataGenerator.createTestProduct({
          isDigital: false,
          stockQuantity: 100,
        });

        const isAvailable = await productService.checkStockAvailability(product.id, 50);

        expect(isAvailable).toBe(true);
      });

      it('should return false when insufficient stock exists', async () => {
        const product = await testDataGenerator.createTestProduct({
          isDigital: false,
          stockQuantity: 10,
        });

        const isAvailable = await productService.checkStockAvailability(product.id, 20);

        expect(isAvailable).toBe(false);
      });

      it('should throw error for non-existent product', async () => {
        await expect(productService.checkStockAvailability('non-existent-id', 10))
          .rejects.toThrow('Product with ID \'non-existent-id\' not found');
      });
    });
  });

  // ==========================================================================
  // PRICING MANAGEMENT TESTS
  // ==========================================================================

  describe('Pricing Management', () => {
    describe('updatePrice()', () => {
      it('should update product price', async () => {
        const product = await testDataGenerator.createTestProduct({ price: 99.99 });

        const priceUpdate: UpdatePrice = {
          productId: product.id,
          price: 149.99,
        };

        const updatedProduct = await productService.updatePrice(priceUpdate);

        expect(parseFloat(updatedProduct.price.toString())).toBe(149.99);
      });

      it('should update compareAtPrice', async () => {
        const product = await testDataGenerator.createTestProduct({
          price: 99.99,
          compareAtPrice: null,
        });

        const priceUpdate: UpdatePrice = {
          productId: product.id,
          compareAtPrice: 129.99,
        };

        const updatedProduct = await productService.updatePrice(priceUpdate);

        expect(parseFloat(updatedProduct.compareAtPrice!.toString())).toBe(129.99);
      });

      it('should validate compareAtPrice is higher than price', async () => {
        const product = await testDataGenerator.createTestProduct({ price: 99.99 });

        const priceUpdate: UpdatePrice = {
          productId: product.id,
          price: 149.99,
          compareAtPrice: 129.99, // Lower than new price
        };

        await expect(productService.updatePrice(priceUpdate))
          .rejects.toThrow('Compare at price must be higher than regular price');
      });

      it('should throw error for non-existent product', async () => {
        const priceUpdate: UpdatePrice = {
          productId: 'non-existent-id',
          price: 99.99,
        };

        await expect(productService.updatePrice(priceUpdate))
          .rejects.toThrow('Product with ID \'non-existent-id\' not found');
      });
    });

    describe('getProductsOnSale()', () => {
      beforeEach(async () => {
        await Promise.all([
          testDataGenerator.createTestProduct({
            name: 'On Sale Product 1',
            price: 99.99,
            compareAtPrice: 129.99,
            isActive: true,
          }),
          testDataGenerator.createTestProduct({
            name: 'On Sale Product 2',
            price: 149.99,
            compareAtPrice: 199.99,
            isActive: true,
          }),
          testDataGenerator.createTestProduct({
            name: 'Regular Product',
            price: 79.99,
            compareAtPrice: null,
            isActive: true,
          }),
          testDataGenerator.createTestProduct({
            name: 'Inactive Sale Product',
            price: 59.99,
            compareAtPrice: 89.99,
            isActive: false,
          }),
        ]);
      });

      it('should return only active products with compareAtPrice', async () => {
        const saleProducts = await productService.getProductsOnSale();

        expect(saleProducts).toHaveLength(2);
        saleProducts.forEach(product => {
          expect(product.isActive).toBe(true);
          expect(product.compareAtPrice).not.toBeNull();
        });
      });
    });
  });

  // ==========================================================================
  // BULK OPERATIONS TESTS
  // ==========================================================================

  describe('Bulk Operations', () => {
    describe('bulkUpdate()', () => {
      beforeEach(async () => {
        await Promise.all([
          testDataGenerator.createTestProduct({
            name: 'Bulk Test 1',
            isActive: true,
            tags: ['original'],
          }),
          testDataGenerator.createTestProduct({
            name: 'Bulk Test 2',
            isActive: true,
            tags: ['original'],
          }),
          testDataGenerator.createTestProduct({
            name: 'Bulk Test 3',
            isActive: true,
            tags: ['original'],
          }),
        ]);
      });

      it('should update multiple products', async () => {
        const products = await prisma.product.findMany({
          where: { name: { startsWith: 'Bulk Test' } },
        });

        const productIds = products.map(p => p.id);
        const result = await productService.bulkUpdate(productIds, {
          isActive: false,
          tags: ['bulk-updated'],
        });

        expect(result.count).toBe(3);

        // Verify updates were applied
        const updatedProducts = await prisma.product.findMany({
          where: { id: { in: productIds } },
        });

        updatedProducts.forEach(product => {
          expect(product.isActive).toBe(false);
          expect(product.tags).toEqual(['bulk-updated']);
        });
      });

      it('should throw error for empty product list', async () => {
        await expect(productService.bulkUpdate([], { isActive: false }))
          .rejects.toThrow('At least one product ID is required');
      });
    });

    describe('bulkPriceUpdate()', () => {
      beforeEach(async () => {
        await Promise.all([
          testDataGenerator.createTestProduct({ price: 100.00 }),
          testDataGenerator.createTestProduct({ price: 200.00 }),
          testDataGenerator.createTestProduct({ price: 300.00 }),
        ]);
      });

      it('should apply percentage price increases', async () => {
        const products = await prisma.product.findMany({ take: 3 });
        const productIds = products.map(p => p.id);
        const originalPrices = products.map(p => parseFloat(p.price.toString()));

        const result = await productService.bulkPriceUpdate(productIds, {
          type: 'percentage',
          value: 10, // 10% increase
        });

        expect(result.count).toBe(3);

        // Verify price updates
        const updatedProducts = await prisma.product.findMany({
          where: { id: { in: productIds } },
        });

        updatedProducts.forEach((product, index) => {
          const expectedPrice = originalPrices[index] * 1.1;
          const actualPrice = parseFloat(product.price.toString());
          expect(actualPrice).toBeCloseTo(expectedPrice, 2);
        });
      });

      it('should apply fixed price increases', async () => {
        const products = await prisma.product.findMany({ take: 3 });
        const productIds = products.map(p => p.id);
        const originalPrices = products.map(p => parseFloat(p.price.toString()));

        const result = await productService.bulkPriceUpdate(productIds, {
          type: 'fixed',
          value: 25.00, // $25 increase
        });

        expect(result.count).toBe(3);

        // Verify price updates
        const updatedProducts = await prisma.product.findMany({
          where: { id: { in: productIds } },
        });

        updatedProducts.forEach((product, index) => {
          const expectedPrice = originalPrices[index] + 25.00;
          const actualPrice = parseFloat(product.price.toString());
          expect(actualPrice).toBeCloseTo(expectedPrice, 2);
        });
      });

      it('should enforce minimum price of $0.01', async () => {
        const product = await testDataGenerator.createTestProduct({ price: 1.00 });

        await productService.bulkPriceUpdate([product.id], {
          type: 'fixed',
          value: -2.00, // Would result in negative price
        });

        const updatedProduct = await prisma.product.findUnique({
          where: { id: product.id },
        });

        expect(parseFloat(updatedProduct!.price.toString())).toBe(0.01);
      });

      it('should throw error for empty product list', async () => {
        await expect(productService.bulkPriceUpdate([], {
          type: 'percentage',
          value: 10,
        })).rejects.toThrow('At least one product ID is required');
      });
    });
  });

  // ==========================================================================
  // BUSINESS LOGIC TESTS
  // ==========================================================================

  describe('Business Logic', () => {
    describe('canPurchase()', () => {
      it('should allow purchase of active product with stock', async () => {
        const product = await testDataGenerator.createTestProduct({
          isActive: true,
          isDigital: false,
          stockQuantity: 50,
        });

        const result = await productService.canPurchase(product.id, 5);

        expect(result.canPurchase).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should allow purchase of digital products regardless of stock', async () => {
        const digitalProduct = await testDataGenerator.createTestProduct({
          isActive: true,
          isDigital: true,
        });

        const result = await productService.canPurchase(digitalProduct.id, 1000);

        expect(result.canPurchase).toBe(true);
      });

      it('should reject purchase of non-existent product', async () => {
        const result = await productService.canPurchase('non-existent-id', 1);

        expect(result.canPurchase).toBe(false);
        expect(result.reason).toBe('Product not found');
      });

      it('should reject purchase of inactive product', async () => {
        const inactiveProduct = await testDataGenerator.createTestProduct({
          isActive: false,
        });

        const result = await productService.canPurchase(inactiveProduct.id, 1);

        expect(result.canPurchase).toBe(false);
        expect(result.reason).toBe('Product is not active');
      });

      it('should reject purchase when insufficient stock', async () => {
        const product = await testDataGenerator.createTestProduct({
          isActive: true,
          isDigital: false,
          stockQuantity: 5,
        });

        const result = await productService.canPurchase(product.id, 10);

        expect(result.canPurchase).toBe(false);
        expect(result.reason).toBe('Insufficient stock');
      });
    });

    describe('getRelatedProducts()', () => {
      beforeEach(async () => {
        // Create products with shared tags
        await Promise.all([
          testDataGenerator.createTestProduct({
            name: 'Main Product',
            tags: ['electronics', 'gadgets', 'tech'],
            isActive: true,
          }),
          testDataGenerator.createTestProduct({
            name: 'Related 1',
            tags: ['electronics', 'mobile'],
            isActive: true,
          }),
          testDataGenerator.createTestProduct({
            name: 'Related 2',
            tags: ['gadgets', 'smart'],
            isActive: true,
          }),
          testDataGenerator.createTestProduct({
            name: 'Related 3',
            tags: ['tech', 'innovation'],
            isActive: true,
          }),
          testDataGenerator.createTestProduct({
            name: 'Unrelated',
            tags: ['clothing', 'fashion'],
            isActive: true,
          }),
          testDataGenerator.createTestProduct({
            name: 'Inactive Related',
            tags: ['electronics', 'tech'],
            isActive: false,
          }),
        ]);
      });

      it('should return related products based on shared tags', async () => {
        const products = await prisma.product.findMany();
        const mainProduct = products.find(p => p.name === 'Main Product')!;

        const relatedProducts = await productService.getRelatedProducts(mainProduct.id);

        expect(relatedProducts.length).toBeLessThanOrEqual(5);
        expect(relatedProducts.length).toBeGreaterThan(0);

        // Should not include the main product itself
        expect(relatedProducts.find(p => p.id === mainProduct.id)).toBeUndefined();

        // Should only include active products
        relatedProducts.forEach(product => {
          expect(product.isActive).toBe(true);
        });

        // Should have at least one shared tag
        relatedProducts.forEach(product => {
          const hasSharedTag = product.tags.some(tag => mainProduct.tags.includes(tag));
          expect(hasSharedTag).toBe(true);
        });
      });

      it('should return empty array for product with no tags', async () => {
        const product = await testDataGenerator.createTestProduct({
          tags: [],
        });

        const relatedProducts = await productService.getRelatedProducts(product.id);

        expect(relatedProducts).toEqual([]);
      });

      it('should return empty array for non-existent product', async () => {
        const relatedProducts = await productService.getRelatedProducts('non-existent-id');

        expect(relatedProducts).toEqual([]);
      });
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('Statistics', () => {
    describe('getProductStats()', () => {
      beforeEach(async () => {
        await Promise.all([
          // Active one-time digital
          testDataGenerator.createTestProduct({
            isActive: true,
            type: 'ONE_TIME',
            isDigital: true,
          }),
          // Active one-time physical with good stock
          testDataGenerator.createTestProduct({
            isActive: true,
            type: 'ONE_TIME',
            isDigital: false,
            stockQuantity: 100,
            lowStockThreshold: 10,
          }),
          // Active one-time physical with low stock
          testDataGenerator.createTestProduct({
            isActive: true,
            type: 'ONE_TIME',
            isDigital: false,
            stockQuantity: 5,
            lowStockThreshold: 10,
          }),
          // Active one-time physical out of stock
          testDataGenerator.createTestProduct({
            isActive: true,
            type: 'ONE_TIME',
            isDigital: false,
            stockQuantity: 0,
            lowStockThreshold: 10,
          }),
          // Active subscription digital
          testDataGenerator.createTestProduct({
            isActive: true,
            type: 'SUBSCRIPTION',
            billingInterval: 'MONTH',
            isDigital: true,
          }),
          // Inactive product
          testDataGenerator.createTestProduct({
            isActive: false,
            type: 'ONE_TIME',
            isDigital: false,
          }),
        ]);
      });

      it('should return comprehensive product statistics', async () => {
        const stats = await productService.getProductStats();

        expect(stats.total).toBe(6);
        expect(stats.active).toBe(5);
        expect(stats.inactive).toBe(1);
        expect(stats.digital).toBe(2);
        expect(stats.physical).toBe(4);
        expect(stats.subscription).toBe(1);
        expect(stats.oneTime).toBe(5);
        expect(stats.lowStock).toBe(1);
        expect(stats.outOfStock).toBe(1);
      });
    });
  });
});