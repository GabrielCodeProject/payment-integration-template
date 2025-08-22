/**
 * Product API Routes Tests
 * 
 * Comprehensive test suite for all product CRUD API endpoints.
 * Tests authentication, authorization, validation, rate limiting,
 * and business logic scenarios.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeEach, jest, beforeAll } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { GET as getProduct, PUT as updateProduct, DELETE as deleteProduct } from '../[id]/route';
import { GET as getStock, PATCH as updateStock, POST as checkStock } from '../[id]/stock/route';
import { POST as bulkOperation } from '../bulk/route';
import { GET as searchProducts } from '../search/route';
import { db } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/db');
jest.mock('@/lib/auth/server-session');
jest.mock('@/lib/api-helpers');

const mockDb = db as jest.Mocked<typeof db>;

// Mock ProductService
const mockProductService = {
  findMany: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  updateStock: jest.fn(),
  checkStockAvailability: jest.fn(),
  canPurchase: jest.fn(),
  bulkUpdate: jest.fn(),
  bulkPriceUpdate: jest.fn(),
  getRelatedProducts: jest.fn(),
};

// Mock auth helper
const mockValidateApiAccess = jest.fn();
const mockGetAuditContext = jest.fn();
const mockCreateApiErrorResponse = jest.fn();

// Mock API helpers
const mockRateLimit = jest.fn();
const mockAuditAction = jest.fn();

// Setup mocks
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { validateApiAccess, getAuditContext, createApiErrorResponse } = require('@/lib/auth/server-session');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { rateLimit, auditAction } = require('@/lib/api-helpers');
  
  validateApiAccess.mockImplementation(mockValidateApiAccess);
  getAuditContext.mockImplementation(mockGetAuditContext);
  createApiErrorResponse.mockImplementation(mockCreateApiErrorResponse);
  rateLimit.mockImplementation(mockRateLimit);
  auditAction.mockImplementation(mockAuditAction);

  // Mock ProductService constructor
  jest.mock('@/services/products/product.service', () => {
    return {
      ProductService: jest.fn().mockImplementation(() => mockProductService),
    };
  });
});

describe('Product API Routes', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    mockRateLimit.mockResolvedValue({ success: true });
    mockAuditAction.mockResolvedValue(undefined);
    mockCreateApiErrorResponse.mockImplementation((code, message) => 
      new Response(JSON.stringify({ error: message }), { status: code })
    );
    mockGetAuditContext.mockReturnValue({
      adminUserId: 'admin-123',
      adminRole: 'ADMIN',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
  });

  describe('GET /api/products - List products', () => {
    it('should return paginated product list for public access', async () => {
      // Arrange
      const mockProducts = [
        {
          id: 'prod-1',
          name: 'Test Product 1',
          price: 29.99,
          isActive: true,
          isDigital: false,
          stockQuantity: 10,
        },
        {
          id: 'prod-2',
          name: 'Test Product 2',
          price: 19.99,
          isActive: true,
          isDigital: true,
          stockQuantity: null,
        },
      ];

      mockProductService.findMany.mockResolvedValue({
        products: mockProducts,
        total: 2,
        page: 1,
        pages: 1,
        limit: 20,
      });

      const url = new URL('http://localhost:3000/api/products');
      const request = new NextRequest(url);

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.products).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
      expect(mockProductService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
        'createdAt',
        'desc',
        1,
        20
      );
    });

    it('should apply filters correctly', async () => {
      // Arrange
      mockProductService.findMany.mockResolvedValue({
        products: [],
        total: 0,
        page: 1,
        pages: 1,
        limit: 20,
      });

      const url = new URL('http://localhost:3000/api/products?type=SUBSCRIPTION&priceMin=10&priceMax=50');
      const request = new NextRequest(url);

      // Act
      await GET(request);

      // Assert
      expect(mockProductService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SUBSCRIPTION',
          priceMin: 10,
          priceMax: 50,
          isActive: true,
        }),
        'createdAt',
        'desc',
        1,
        20
      );
    });

    it('should handle rate limiting', async () => {
      // Arrange
      mockRateLimit.mockResolvedValue({ success: false });

      const url = new URL('http://localhost:3000/api/products');
      const request = new NextRequest(url);

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(429);
    });

    it('should validate query parameters', async () => {
      // Arrange
      const url = new URL('http://localhost:3000/api/products?limit=invalid');
      const request = new NextRequest(url);

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/products - Create product', () => {
    it('should create product with admin authentication', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: true,
        session: {
          user: { id: 'admin-123', role: 'ADMIN' },
        },
      });

      const mockProduct = {
        id: 'prod-123',
        name: 'New Product',
        price: 39.99,
        sku: 'NP-001',
        slug: 'new-product',
        isActive: true,
      };

      mockProductService.create.mockResolvedValue(mockProduct);

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Product',
          price: 39.99,
          sku: 'NP-001',
          slug: 'new-product',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.product.id).toBe('prod-123');
      expect(mockProductService.create).toHaveBeenCalled();
      expect(mockAuditAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_PRODUCT',
          resource: 'Product',
          resourceId: 'prod-123',
        })
      );
    });

    it('should require admin authentication', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: false,
        session: null,
        error: { code: 401, message: 'Authentication required' },
      });

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
      expect(mockProductService.create).not.toHaveBeenCalled();
    });

    it('should validate product data', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: true,
        session: { user: { id: 'admin-123', role: 'ADMIN' } },
      });

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({ name: '' }), // Invalid data
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      expect(mockProductService.create).not.toHaveBeenCalled();
    });

    it('should handle duplicate SKU error', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: true,
        session: { user: { id: 'admin-123', role: 'ADMIN' } },
      });

      mockProductService.create.mockRejectedValue(
        new Error("Product with SKU 'DUP-001' already exists")
      );

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Duplicate Product',
          price: 29.99,
          sku: 'DUP-001',
          slug: 'duplicate-product',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/products/[id] - Get single product', () => {
    it('should return product details for public access', async () => {
      // Arrange
      const mockProduct = {
        id: 'prod-123',
        name: 'Test Product',
        price: 29.99,
        isActive: true,
        isDigital: false,
        stockQuantity: 5,
        compareAtPrice: 39.99,
      };

      const mockRelatedProducts = [
        { id: 'prod-456', name: 'Related Product', price: 19.99, slug: 'related' },
      ];

      mockValidateApiAccess.mockResolvedValue({ session: null });
      mockProductService.findById.mockResolvedValue(mockProduct);
      mockProductService.getRelatedProducts.mockResolvedValue(mockRelatedProducts);

      const params = { id: 'prod-123' };

      // Act
      const response = await getProduct(new NextRequest('http://localhost/api/products/prod-123'), { params });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.product.id).toBe('prod-123');
      expect(data.relatedProducts).toHaveLength(1);
      expect(data.product.inStock).toBe(true);
      expect(data.product.isOnSale).toBe(true);
    });

    it('should hide inactive products from public', async () => {
      // Arrange
      const mockProduct = {
        id: 'prod-123',
        name: 'Inactive Product',
        isActive: false,
      };

      mockValidateApiAccess.mockResolvedValue({ session: null });
      mockProductService.findById.mockResolvedValue(mockProduct);

      const params = { id: 'prod-123' };

      // Act
      const response = await getProduct(new NextRequest('http://localhost/api/products/prod-123'), { params });

      // Assert
      expect(response.status).toBe(404);
    });

    it('should show inactive products to admin', async () => {
      // Arrange
      const mockProduct = {
        id: 'prod-123',
        name: 'Inactive Product',
        isActive: false,
      };

      mockValidateApiAccess.mockResolvedValue({
        session: { user: { role: 'ADMIN' } },
      });
      mockProductService.findById.mockResolvedValue(mockProduct);

      const params = { id: 'prod-123' };

      // Act
      const response = await getProduct(new NextRequest('http://localhost/api/products/prod-123'), { params });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.product.id).toBe('prod-123');
    });
  });

  describe('PUT /api/products/[id] - Update product', () => {
    it('should update product with admin authentication', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: true,
        session: { user: { id: 'admin-123', role: 'ADMIN' } },
      });

      const originalProduct = {
        id: 'prod-123',
        name: 'Original Name',
        price: 29.99,
      };

      const updatedProduct = {
        id: 'prod-123',
        name: 'Updated Name',
        price: 39.99,
      };

      mockProductService.findById.mockResolvedValue(originalProduct);
      mockProductService.update.mockResolvedValue(updatedProduct);

      const request = new NextRequest('http://localhost/api/products/prod-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name', price: 39.99 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const params = { id: 'prod-123' };

      // Act
      const response = await updateProduct(request, { params });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.product.name).toBe('Updated Name');
      expect(mockAuditAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_PRODUCT',
          resourceId: 'prod-123',
        })
      );
    });

    it('should require admin role', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: false,
        session: null,
        error: { code: 403, message: 'Admin access required' },
      });

      const request = new NextRequest('http://localhost/api/products/prod-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const params = { id: 'prod-123' };

      // Act
      const response = await updateProduct(request, { params });

      // Assert
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/products/[id] - Delete product', () => {
    it('should soft delete product with admin authentication', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: true,
        session: { user: { id: 'admin-123', role: 'ADMIN' } },
      });

      const mockProduct = {
        id: 'prod-123',
        name: 'Test Product',
        isActive: true,
      };

      const deletedProduct = {
        ...mockProduct,
        isActive: false,
      };

      mockProductService.findById.mockResolvedValue(mockProduct);
      mockProductService.softDelete.mockResolvedValue(deletedProduct);

      const params = { id: 'prod-123' };

      // Act
      const response = await deleteProduct(new NextRequest('http://localhost/api/products/prod-123'), { params });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.product.isActive).toBe(false);
      expect(mockAuditAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOFT_DELETE_PRODUCT',
          resourceId: 'prod-123',
        })
      );
    });
  });

  describe('Stock Management Endpoints', () => {
    describe('GET /api/products/[id]/stock', () => {
      it('should return stock information for public users', async () => {
        // Arrange
        const mockProduct = {
          id: 'prod-123',
          name: 'Test Product',
          isActive: true,
          isDigital: false,
          stockQuantity: 10,
        };

        mockValidateApiAccess.mockResolvedValue({ session: null });
        mockProductService.findById.mockResolvedValue(mockProduct);
        mockProductService.canPurchase.mockResolvedValue({ canPurchase: true });

        const params = { id: 'prod-123' };

        // Act
        const response = await getStock(new NextRequest('http://localhost/api/products/prod-123/stock'), { params });

        // Assert
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.inStock).toBe(true);
        expect(data.availableForPurchase).toBe(true);
        expect(data.stockQuantity).toBeUndefined(); // Hidden from public
      });

      it('should return detailed stock info for admin', async () => {
        // Arrange
        const mockProduct = {
          id: 'prod-123',
          name: 'Test Product',
          isActive: true,
          isDigital: false,
          stockQuantity: 5,
          lowStockThreshold: 10,
        };

        mockValidateApiAccess.mockResolvedValue({
          session: { user: { role: 'ADMIN' } },
        });
        mockProductService.findById.mockResolvedValue(mockProduct);
        mockProductService.canPurchase.mockResolvedValue({ canPurchase: true });

        const params = { id: 'prod-123' };

        // Act
        const response = await getStock(new NextRequest('http://localhost/api/products/prod-123/stock'), { params });

        // Assert
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.stockQuantity).toBe(5);
        expect(data.lowStockThreshold).toBe(10);
        expect(data.isLowStock).toBe(true);
      });
    });

    describe('PATCH /api/products/[id]/stock', () => {
      it('should update stock with admin authentication', async () => {
        // Arrange
        mockValidateApiAccess.mockResolvedValue({
          isValid: true,
          session: { user: { id: 'admin-123', role: 'ADMIN' } },
        });

        const originalProduct = { id: 'prod-123', stockQuantity: 10 };
        const updatedProduct = { id: 'prod-123', stockQuantity: 15 };

        mockProductService.findById.mockResolvedValue(originalProduct);
        mockProductService.updateStock.mockResolvedValue(updatedProduct);

        const request = new NextRequest('http://localhost/api/products/prod-123/stock', {
          method: 'PATCH',
          body: JSON.stringify({
            quantity: 5,
            operation: 'increment',
            reason: 'Restocked',
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const params = { id: 'prod-123' };

        // Act
        const response = await updateStock(request, { params });

        // Assert
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.stock.newStock).toBe(15);
        expect(data.stock.stockChange).toBe(5);
        expect(mockAuditAction).toHaveBeenCalled();
      });

      it('should prevent negative stock', async () => {
        // Arrange
        mockValidateApiAccess.mockResolvedValue({
          isValid: true,
          session: { user: { id: 'admin-123', role: 'ADMIN' } },
        });

        const mockProduct = { id: 'prod-123', stockQuantity: 3 };

        mockProductService.findById.mockResolvedValue(mockProduct);
        mockProductService.updateStock.mockRejectedValue(
          new Error('Stock quantity cannot be negative')
        );

        const request = new NextRequest('http://localhost/api/products/prod-123/stock', {
          method: 'PATCH',
          body: JSON.stringify({
            quantity: 5,
            operation: 'decrement',
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        const params = { id: 'prod-123' };

        // Act
        const response = await updateStock(request, { params });

        // Assert
        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/products/[id]/stock', () => {
      it('should check stock availability', async () => {
        // Arrange
        mockProductService.checkStockAvailability.mockResolvedValue(true);
        mockProductService.canPurchase.mockResolvedValue({
          canPurchase: true,
          reason: undefined,
        });

        const request = new NextRequest('http://localhost/api/products/prod-123/stock', {
          method: 'POST',
          body: JSON.stringify({ quantity: 3 }),
          headers: { 'Content-Type': 'application/json' },
        });

        const params = { id: 'prod-123' };

        // Act
        const response = await checkStock(request, { params });

        // Assert
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.available).toBe(true);
        expect(data.canPurchase).toBe(true);
        expect(mockProductService.checkStockAvailability).toHaveBeenCalledWith('prod-123', 3);
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk update operation', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: true,
        session: { user: { id: 'admin-123', role: 'ADMIN' } },
      });

      const existingProducts = [
        { id: 'prod-1', name: 'Product 1' },
        { id: 'prod-2', name: 'Product 2' },
      ];

      mockDb.product.findMany.mockResolvedValue(existingProducts);
      mockProductService.bulkUpdate.mockResolvedValue({ count: 2 });

      const request = new NextRequest('http://localhost/api/products/bulk', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'update',
          productIds: ['prod-1', 'prod-2'],
          updates: { isActive: false },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await bulkOperation(request);

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.result.affectedCount).toBe(2);
      expect(mockAuditAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BULK_PRODUCT_OPERATION' })
      );
    });

    it('should perform bulk price adjustment', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: true,
        session: { user: { id: 'admin-123', role: 'ADMIN' } },
      });

      const originalProducts = [
        { id: 'prod-1', name: 'Product 1', price: { toString: () => '20.00' } },
        { id: 'prod-2', name: 'Product 2', price: { toString: () => '30.00' } },
      ];

      mockDb.product.findMany.mockResolvedValue(originalProducts);
      mockProductService.bulkPriceUpdate.mockResolvedValue({ count: 2 });

      const request = new NextRequest('http://localhost/api/products/bulk', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'price_adjustment',
          productIds: ['prod-1', 'prod-2'],
          adjustment: { type: 'percentage', value: 10 },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await bulkOperation(request);

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.result.affectedCount).toBe(2);
    });

    it('should handle missing products in bulk operations', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: true,
        session: { user: { id: 'admin-123', role: 'ADMIN' } },
      });

      // Return fewer products than requested
      mockDb.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'Product 1' },
      ]);

      const request = new NextRequest('http://localhost/api/products/bulk', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'update',
          productIds: ['prod-1', 'prod-2'], // prod-2 doesn't exist
          updates: { isActive: false },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await bulkOperation(request);

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe('Search Endpoint', () => {
    it('should perform product search', async () => {
      // Arrange
      const mockSearchResults = [
        {
          id: 'prod-1',
          name: 'Searchable Product',
          price: 29.99,
          isActive: true,
          isDigital: false,
          stockQuantity: 5,
        },
      ];

      mockDb.product.findMany.mockResolvedValue(mockSearchResults);
      mockDb.product.count.mockResolvedValue(1);

      const url = new URL('http://localhost/api/products/search?q=searchable');
      const request = new NextRequest(url);

      // Act
      const response = await searchProducts(request);

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results).toHaveLength(1);
      expect(data.query).toBe('searchable');
      expect(data.pagination.total).toBe(1);
    });

    it('should validate search query', async () => {
      // Arrange
      const url = new URL('http://localhost/api/products/search'); // Missing 'q' parameter
      const request = new NextRequest(url);

      // Act
      const response = await searchProducts(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should apply search filters', async () => {
      // Arrange
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);

      const url = new URL('http://localhost/api/products/search?q=test&type=SUBSCRIPTION&priceMin=10');
      const request = new NextRequest(url);

      // Act
      await searchProducts(request);

      // Assert
      expect(mockDb.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.any(Array), // Search conditions
              }),
              expect.objectContaining({
                type: 'SUBSCRIPTION',
                price: { gte: 10 },
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Arrange
      mockProductService.findMany.mockRejectedValue(new Error('Database connection failed'));

      const url = new URL('http://localhost:3000/api/products');
      const request = new NextRequest(url);

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(500);
    });

    it('should handle invalid JSON in request body', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: true,
        session: { user: { id: 'admin-123', role: 'ADMIN' } },
      });

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: 'invalid-json',
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should handle validation errors', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: true,
        session: { user: { id: 'admin-123', role: 'ADMIN' } },
      });

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({
          name: '', // Invalid: empty name
          price: -10, // Invalid: negative price
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on public endpoints', async () => {
      // Arrange
      mockRateLimit.mockResolvedValue({ success: false });

      const url = new URL('http://localhost:3000/api/products');
      const request = new NextRequest(url);

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(429);
      expect(mockRateLimit).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          maxRequests: 100,
        })
      );
    });

    it('should enforce stricter rate limits on admin endpoints', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: true,
        session: { user: { id: 'admin-123', role: 'ADMIN' } },
      });
      mockRateLimit.mockResolvedValue({ success: false });

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(429);
      expect(mockRateLimit).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          maxRequests: 50,
        })
      );
    });
  });

  describe('Authentication & Authorization', () => {
    it('should allow public access to GET endpoints', async () => {
      // Arrange
      mockProductService.findMany.mockResolvedValue({
        products: [],
        total: 0,
        page: 1,
        pages: 1,
        limit: 20,
      });

      const url = new URL('http://localhost:3000/api/products');
      const request = new NextRequest(url);

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
      // Should not call validateApiAccess for public endpoints
    });

    it('should require admin role for POST endpoints', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: false,
        session: { user: { role: 'CUSTOMER' } }, // Not admin
        error: { code: 403, message: 'Admin access required' },
      });

      const request = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(403);
    });

    it('should require admin role for PUT endpoints', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: false,
        session: { user: { role: 'SUPPORT' } }, // Not admin
        error: { code: 403, message: 'Admin access required' },
      });

      const request = new NextRequest('http://localhost/api/products/prod-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const params = { id: 'prod-123' };

      // Act
      const response = await updateProduct(request, { params });

      // Assert
      expect(response.status).toBe(403);
    });

    it('should require admin role for DELETE endpoints', async () => {
      // Arrange
      mockValidateApiAccess.mockResolvedValue({
        isValid: false,
        session: null,
        error: { code: 401, message: 'Authentication required' },
      });

      const params = { id: 'prod-123' };

      // Act
      const response = await deleteProduct(
        new NextRequest('http://localhost/api/products/prod-123'),
        { params }
      );

      // Assert
      expect(response.status).toBe(401);
    });
  });
});