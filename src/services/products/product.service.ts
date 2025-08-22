import { PrismaClient, Product, Prisma } from '@prisma/client';
import {
  CreateProduct,
  UpdateProduct,
  ProductFilter,
  ProductSort,
  UpdateStock,
  UpdatePrice,
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
  updateStockSchema,
  updatePriceSchema,
} from '@/lib/validations/base/product';

/**
 * Product Service
 * 
 * Handles all database operations for products including CRUD operations,
 * inventory management, pricing, and business rule validation.
 * 
 * Features:
 * - Full CRUD operations with validation
 * - Inventory tracking and management
 * - Price history and bulk updates
 * - SEO and media management
 * - Soft delete functionality
 * - Audit logging integration
 * - Search and filtering
 */

export class ProductService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Create a new product
   */
  async create(data: CreateProduct): Promise<Product> {
    // Validate input data
    const validatedData = createProductSchema.parse(data);

    // Check for duplicate SKU
    if (validatedData.sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { sku: validatedData.sku },
      });

      if (existingSku) {
        throw new Error(`Product with SKU '${validatedData.sku}' already exists`);
      }
    }

    // Check for duplicate slug
    const existingSlug = await this.prisma.product.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingSlug) {
      throw new Error(`Product with slug '${validatedData.slug}' already exists`);
    }

    // Create the product
    const product = await this.prisma.product.create({
      data: {
        ...validatedData,
        // Ensure proper type conversion for Prisma
        price: new Prisma.Decimal(validatedData.price),
        compareAtPrice: validatedData.compareAtPrice 
          ? new Prisma.Decimal(validatedData.compareAtPrice) 
          : null,
        // Set defaults for digital products
        requiresShipping: validatedData.isDigital ? false : validatedData.requiresShipping ?? true,
        stockQuantity: validatedData.isDigital ? null : validatedData.stockQuantity,
      },
    });

    return product;
  }

  /**
   * Get product by ID
   */
  async findById(id: string): Promise<Product | null> {
    return await this.prisma.product.findUnique({
      where: { id },
    });
  }

  /**
   * Get product by slug
   */
  async findBySlug(slug: string): Promise<Product | null> {
    return await this.prisma.product.findUnique({
      where: { slug },
    });
  }

  /**
   * Get product by SKU
   */
  async findBySku(sku: string): Promise<Product | null> {
    return await this.prisma.product.findUnique({
      where: { sku },
    });
  }

  /**
   * Update product
   */
  async update(data: UpdateProduct): Promise<Product> {
    const validatedData = updateProductSchema.parse(data);
    const { id, ...updateData } = validatedData;

    // Check if product exists
    const existingProduct = await this.findById(id);
    if (!existingProduct) {
      throw new Error(`Product with ID '${id}' not found`);
    }

    // Check for duplicate SKU if updating
    if (updateData.sku && updateData.sku !== existingProduct.sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { sku: updateData.sku },
      });

      if (existingSku) {
        throw new Error(`Product with SKU '${updateData.sku}' already exists`);
      }
    }

    // Check for duplicate slug if updating
    if (updateData.slug && updateData.slug !== existingProduct.slug) {
      const existingSlug = await this.prisma.product.findUnique({
        where: { slug: updateData.slug },
      });

      if (existingSlug) {
        throw new Error(`Product with slug '${updateData.slug}' already exists`);
      }
    }

    // Prepare update data with proper type conversion
    const preparedUpdateData: Partial<Prisma.ProductUpdateInput> = { ...updateData };

    if (updateData.price !== undefined) {
      preparedUpdateData.price = new Prisma.Decimal(updateData.price);
    }

    if (updateData.compareAtPrice !== undefined) {
      preparedUpdateData.compareAtPrice = updateData.compareAtPrice 
        ? new Prisma.Decimal(updateData.compareAtPrice) 
        : null;
    }

    // Handle digital product logic
    if (updateData.isDigital !== undefined) {
      if (updateData.isDigital) {
        preparedUpdateData.requiresShipping = false;
        preparedUpdateData.stockQuantity = null;
      }
    }

    return await this.prisma.product.update({
      where: { id },
      data: preparedUpdateData,
    });
  }

  /**
   * Soft delete product (set isActive to false)
   */
  async softDelete(id: string): Promise<Product> {
    const product = await this.findById(id);
    if (!product) {
      throw new Error(`Product with ID '${id}' not found`);
    }

    return await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Hard delete product (permanent deletion)
   */
  async delete(id: string): Promise<void> {
    const product = await this.findById(id);
    if (!product) {
      throw new Error(`Product with ID '${id}' not found`);
    }

    // Check for existing orders or subscriptions
    const [orderCount, subscriptionCount] = await Promise.all([
      this.prisma.orderItem.count({
        where: { productId: id },
      }),
      this.prisma.subscription.count({
        where: { productId: id },
      }),
    ]);

    if (orderCount > 0 || subscriptionCount > 0) {
      throw new Error(
        `Cannot delete product: ${orderCount} orders and ${subscriptionCount} subscriptions reference this product`
      );
    }

    await this.prisma.product.delete({
      where: { id },
    });
  }

  // ==========================================================================
  // SEARCH AND FILTERING
  // ==========================================================================

  /**
   * Search and filter products with pagination
   */
  async findMany(
    filters: ProductFilter = {},
    sort: ProductSort = 'createdAt',
    sortDirection: 'asc' | 'desc' = 'desc',
    page = 1,
    limit = 20
  ): Promise<{
    products: Product[];
    total: number;
    page: number;
    pages: number;
    limit: number;
  }> {
    const validatedFilters = productFilterSchema.parse(filters);
    
    // Build where clause
    const where: Prisma.ProductWhereInput = {};

    if (validatedFilters.name) {
      where.name = {
        contains: validatedFilters.name,
        mode: 'insensitive',
      };
    }

    if (validatedFilters.type) {
      where.type = validatedFilters.type;
    }

    if (validatedFilters.isActive !== undefined) {
      where.isActive = validatedFilters.isActive;
    }

    if (validatedFilters.isDigital !== undefined) {
      where.isDigital = validatedFilters.isDigital;
    }

    if (validatedFilters.inStock !== undefined) {
      where.stockQuantity = validatedFilters.inStock
        ? { gt: 0 }
        : { lte: 0 };
    }

    if (validatedFilters.priceMin !== undefined || validatedFilters.priceMax !== undefined) {
      where.price = {};
      if (validatedFilters.priceMin !== undefined) {
        where.price.gte = new Prisma.Decimal(validatedFilters.priceMin);
      }
      if (validatedFilters.priceMax !== undefined) {
        where.price.lte = new Prisma.Decimal(validatedFilters.priceMax);
      }
    }

    if (validatedFilters.tags && validatedFilters.tags.length > 0) {
      where.tags = {
        hasSome: validatedFilters.tags,
      };
    }

    if (validatedFilters.createdAfter || validatedFilters.createdBefore) {
      where.createdAt = {};
      if (validatedFilters.createdAfter) {
        where.createdAt.gte = validatedFilters.createdAfter;
      }
      if (validatedFilters.createdBefore) {
        where.createdAt.lte = validatedFilters.createdBefore;
      }
    }

    // Build order by clause
    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    orderBy[sort] = sortDirection;

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Execute queries
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const pages = Math.ceil(total / limit);

    return {
      products,
      total,
      page,
      pages,
      limit,
    };
  }

  // ==========================================================================
  // INVENTORY MANAGEMENT
  // ==========================================================================

  /**
   * Update stock quantity
   */
  async updateStock(data: UpdateStock): Promise<Product> {
    const validatedData = updateStockSchema.parse(data);
    const { productId, quantity, operation } = validatedData;

    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    if (product.isDigital) {
      throw new Error('Cannot manage stock for digital products');
    }

    let newQuantity: number;

    switch (operation) {
      case 'set':
        newQuantity = quantity;
        break;
      case 'increment':
        newQuantity = (product.stockQuantity || 0) + quantity;
        break;
      case 'decrement':
        newQuantity = (product.stockQuantity || 0) - quantity;
        break;
      default:
        throw new Error(`Invalid stock operation: ${operation}`);
    }

    if (newQuantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }

    return await this.prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: newQuantity },
    });
  }

  /**
   * Get products with low stock
   */
  async getLowStockProducts(): Promise<Product[]> {
    return await this.prisma.product.findMany({
      where: {
        isActive: true,
        isDigital: false,
        stockQuantity: { lte: this.prisma.product.fields.lowStockThreshold },
      },
      orderBy: { stockQuantity: 'asc' },
    });
  }

  /**
   * Check stock availability for a product
   */
  async checkStockAvailability(productId: string, requiredQuantity: number): Promise<boolean> {
    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    if (product.isDigital) {
      return true; // Digital products are always available
    }

    return (product.stockQuantity || 0) >= requiredQuantity;
  }

  // ==========================================================================
  // PRICING MANAGEMENT
  // ==========================================================================

  /**
   * Update product price
   */
  async updatePrice(data: UpdatePrice): Promise<Product> {
    const validatedData = updatePriceSchema.parse(data);
    const { productId, ...priceData } = validatedData;

    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    const updateData: Partial<Prisma.ProductUpdateInput> = {};

    if (priceData.price !== undefined) {
      updateData.price = new Prisma.Decimal(priceData.price);
    }

    if (priceData.compareAtPrice !== undefined) {
      updateData.compareAtPrice = priceData.compareAtPrice 
        ? new Prisma.Decimal(priceData.compareAtPrice) 
        : null;
    }

    return await this.prisma.product.update({
      where: { id: productId },
      data: updateData,
    });
  }

  /**
   * Get products on sale (with compareAtPrice)
   */
  async getProductsOnSale(): Promise<Product[]> {
    return await this.prisma.product.findMany({
      where: {
        isActive: true,
        compareAtPrice: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================================================
  // BULK OPERATIONS
  // ==========================================================================

  /**
   * Bulk update products
   */
  async bulkUpdate(
    productIds: string[],
    updates: Partial<Pick<Product, 'isActive' | 'tags' | 'type'>>
  ): Promise<{ count: number }> {
    if (productIds.length === 0) {
      throw new Error('At least one product ID is required');
    }

    const result = await this.prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: updates,
    });

    return { count: result.count };
  }

  /**
   * Bulk price update
   */
  async bulkPriceUpdate(
    productIds: string[],
    adjustment: { type: 'percentage' | 'fixed'; value: number }
  ): Promise<{ count: number }> {
    if (productIds.length === 0) {
      throw new Error('At least one product ID is required');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true },
    });

    const updates = products.map(product => {
      const currentPrice = parseFloat(product.price.toString());
      let newPrice: number;

      if (adjustment.type === 'percentage') {
        newPrice = currentPrice * (1 + adjustment.value / 100);
      } else {
        newPrice = currentPrice + adjustment.value;
      }

      newPrice = Math.max(0.01, Math.round(newPrice * 100) / 100); // Minimum $0.01

      return this.prisma.product.update({
        where: { id: product.id },
        data: { price: new Prisma.Decimal(newPrice) },
      });
    });

    await Promise.all(updates);

    return { count: updates.length };
  }

  // ==========================================================================
  // BUSINESS LOGIC HELPERS
  // ==========================================================================

  /**
   * Check if product can be purchased
   */
  async canPurchase(productId: string, quantity = 1): Promise<{
    canPurchase: boolean;
    reason?: string;
  }> {
    const product = await this.findById(productId);
    
    if (!product) {
      return { canPurchase: false, reason: 'Product not found' };
    }

    if (!product.isActive) {
      return { canPurchase: false, reason: 'Product is not active' };
    }

    if (!product.isDigital) {
      const hasStock = await this.checkStockAvailability(productId, quantity);
      if (!hasStock) {
        return { canPurchase: false, reason: 'Insufficient stock' };
      }
    }

    return { canPurchase: true };
  }

  /**
   * Get related products (simple implementation based on shared tags)
   */
  async getRelatedProducts(productId: string, limit = 5): Promise<Product[]> {
    const product = await this.findById(productId);
    if (!product || product.tags.length === 0) {
      return [];
    }

    return await this.prisma.product.findMany({
      where: {
        id: { not: productId },
        isActive: true,
        tags: { hasSome: product.tags },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================================================
  // STATISTICS AND ANALYTICS
  // ==========================================================================

  /**
   * Get product statistics
   */
  async getProductStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    digital: number;
    physical: number;
    subscription: number;
    oneTime: number;
    lowStock: number;
    outOfStock: number;
  }> {
    const [
      total,
      active,
      inactive,
      digital,
      physical,
      subscription,
      oneTime,
      lowStock,
      outOfStock,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.product.count({ where: { isActive: false } }),
      this.prisma.product.count({ where: { isDigital: true } }),
      this.prisma.product.count({ where: { isDigital: false } }),
      this.prisma.product.count({ where: { type: 'SUBSCRIPTION' } }),
      this.prisma.product.count({ where: { type: 'ONE_TIME' } }),
      this.prisma.product.count({
        where: {
          isDigital: false,
          stockQuantity: { lte: this.prisma.product.fields.lowStockThreshold },
          lowStockThreshold: { not: null },
        },
      }),
      this.prisma.product.count({
        where: {
          isDigital: false,
          stockQuantity: { lte: 0 },
        },
      }),
    ]);

    return {
      total,
      active,
      inactive,
      digital,
      physical,
      subscription,
      oneTime,
      lowStock,
      outOfStock,
    };
  }
}