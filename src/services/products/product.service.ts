import { PrismaClient, Product, PricingTier, Prisma } from '@prisma/client';
import {
  CreateProduct,
  UpdateProduct,
  ProductFilter,
  ProductSort,
  UpdateStock,
  UpdatePrice,
  UpdateProductVisibility,
  UpdateProductAccessControl,
  BulkProductStatusUpdate,
  ProductVisibilityValidation,
  UserRole,
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
  updateStockSchema,
  updatePriceSchema,
  updateProductVisibilitySchema,
  updateProductAccessControlSchema,
  bulkProductStatusUpdateSchema,
  productVisibilityValidationSchema,
} from '@/lib/validations/base/product';
import { PricingTierService } from '../pricing-tier.service';

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
 * - Product visibility and availability controls
 * - Geographic restrictions and role-based access
 * - User capacity management and scheduling
 */

export class ProductService {
  private prisma: PrismaClient;
  private pricingTierService: PricingTierService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.pricingTierService = new PricingTierService(prisma);
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

    // Extract category and tag IDs for separate handling
    const { categoryIds, tagIds, ...productData } = validatedData;

    // Create the product with relationships
    const product = await this.prisma.product.create({
      data: {
        ...productData,
        // Ensure proper type conversion for Prisma
        price: new Prisma.Decimal(productData.price),
        compareAtPrice: productData.compareAtPrice 
          ? new Prisma.Decimal(productData.compareAtPrice) 
          : null,
        // Set defaults for digital products
        requiresShipping: productData.isDigital ? false : productData.requiresShipping ?? true,
        stockQuantity: productData.isDigital ? null : productData.stockQuantity,
        
        // Create category relationships
        categories: categoryIds?.length ? {
          create: categoryIds.map(categoryId => ({
            categoryId,
          })),
        } : undefined,

        // Create tag relationships
        tags: tagIds?.length ? {
          create: tagIds.map(tagId => ({
            tagId,
          })),
        } : undefined,
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
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

    // Extract category and tag IDs for separate handling
    const { categoryIds, tagIds, ...productUpdateData } = updateData;

    // Prepare update data with proper type conversion
    const preparedUpdateData: Partial<Prisma.ProductUpdateInput> = { ...productUpdateData };

    if (productUpdateData.price !== undefined) {
      preparedUpdateData.price = new Prisma.Decimal(productUpdateData.price);
    }

    if (productUpdateData.compareAtPrice !== undefined) {
      preparedUpdateData.compareAtPrice = productUpdateData.compareAtPrice 
        ? new Prisma.Decimal(productUpdateData.compareAtPrice) 
        : null;
    }

    // Handle digital product logic
    if (productUpdateData.isDigital !== undefined) {
      if (productUpdateData.isDigital) {
        preparedUpdateData.requiresShipping = false;
        preparedUpdateData.stockQuantity = null;
      }
    }

    // Handle category relationships
    if (categoryIds !== undefined) {
      preparedUpdateData.categories = {
        deleteMany: {}, // Remove all existing category relationships
        create: categoryIds.map(categoryId => ({
          categoryId,
        })),
      };
    }

    // Handle tag relationships
    if (tagIds !== undefined) {
      preparedUpdateData.tags = {
        deleteMany: {}, // Remove all existing tag relationships
        create: tagIds.map(tagId => ({
          tagId,
        })),
      };
    }

    return await this.prisma.product.update({
      where: { id },
      data: preparedUpdateData,
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
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

    if (validatedFilters.categoryIds && validatedFilters.categoryIds.length > 0) {
      where.categories = {
        some: {
          categoryId: {
            in: validatedFilters.categoryIds,
          },
        },
      };
    }

    if (validatedFilters.tagIds && validatedFilters.tagIds.length > 0) {
      where.tags = {
        some: {
          tagId: {
            in: validatedFilters.tagIds,
          },
        },
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

    // Visibility and availability filters
    if (validatedFilters.status) {
      where.status = validatedFilters.status;
    }

    if (validatedFilters.isPublished !== undefined) {
      where.isPublished = validatedFilters.isPublished;
    }

    if (validatedFilters.publishedAfter || validatedFilters.publishedBefore) {
      where.publishedAt = {};
      if (validatedFilters.publishedAfter) {
        where.publishedAt.gte = validatedFilters.publishedAfter;
      }
      if (validatedFilters.publishedBefore) {
        where.publishedAt.lte = validatedFilters.publishedBefore;
      }
    }

    if (validatedFilters.availableAfter || validatedFilters.availableBefore) {
      where.AND = where.AND || [];
      const availabilityConditions: Prisma.ProductWhereInput[] = [];
      
      if (validatedFilters.availableAfter) {
        availabilityConditions.push({
          OR: [
            { availableFrom: { gte: validatedFilters.availableAfter } },
            { availableFrom: null },
          ],
        });
      }
      
      if (validatedFilters.availableBefore) {
        availabilityConditions.push({
          OR: [
            { availableTo: { lte: validatedFilters.availableBefore } },
            { availableTo: null },
          ],
        });
      }
      
      where.AND.push(...availabilityConditions);
    }

    if (validatedFilters.restrictedRegions && validatedFilters.restrictedRegions.length > 0) {
      where.restrictedRegions = {
        hasSome: validatedFilters.restrictedRegions,
      };
    }

    if (validatedFilters.allowedUserRoles && validatedFilters.allowedUserRoles.length > 0) {
      where.allowedUserRoles = {
        hasSome: validatedFilters.allowedUserRoles,
      };
    }

    if (validatedFilters.isLimited !== undefined) {
      where.isLimited = validatedFilters.isLimited;
    }

    if (validatedFilters.hasAvailableCapacity !== undefined) {
      if (validatedFilters.hasAvailableCapacity) {
        where.OR = [
          { isLimited: false },
          {
            AND: [
              { isLimited: true },
              { maxUsers: { not: null } },
              { currentUsers: { lt: Prisma.raw('max_users') } },
            ],
          },
        ];
      } else {
        where.AND = where.AND || [];
        where.AND.push({
          isLimited: true,
          maxUsers: { not: null },
          currentUsers: { gte: Prisma.raw('max_users') },
        });
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
        include: {
          categories: {
            include: {
              category: true,
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
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

  // ==========================================================================
  // PRICING TIER MANAGEMENT
  // ==========================================================================

  /**
   * Get all pricing tiers for a product
   */
  async getPricingTiers(productId: string, includeInactive = false): Promise<PricingTier[]> {
    return await this.pricingTierService.findByProductId(productId, includeInactive);
  }

  /**
   * Get pricing tier statistics for a product
   */
  async getPricingTierStats(productId: string) {
    return await this.pricingTierService.getStats(productId);
  }

  /**
   * Get freemium tier for a product
   */
  async getFreemiumTier(productId: string): Promise<PricingTier | null> {
    return await this.pricingTierService.getFreemiumTier(productId);
  }

  /**
   * Check if a product has multiple pricing tiers
   */
  async hasMultiplePricingTiers(productId: string): Promise<boolean> {
    const tiers = await this.getPricingTiers(productId);
    return tiers.length > 1;
  }

  /**
   * Get product with pricing tiers
   */
  async findByIdWithPricingTiers(id: string): Promise<(Product & { pricingTiers: PricingTier[] }) | null> {
    return await this.prisma.product.findUnique({
      where: { id },
      include: {
        pricingTiers: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        categories: {
          include: {
            category: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  }

  /**
   * Get cheapest pricing tier for a product
   */
  async getCheapestTier(productId: string): Promise<PricingTier | null> {
    return await this.prisma.pricingTier.findFirst({
      where: {
        productId,
        isActive: true,
      },
      orderBy: { price: 'asc' },
    });
  }

  /**
   * Get most expensive pricing tier for a product
   */
  async getMostExpensiveTier(productId: string): Promise<PricingTier | null> {
    return await this.prisma.pricingTier.findFirst({
      where: {
        productId,
        isActive: true,
      },
      orderBy: { price: 'desc' },
    });
  }

  /**
   * Create default pricing tier when creating a product
   */
  async createDefaultPricingTier(productId: string, productData: CreateProduct): Promise<PricingTier> {
    return await this.pricingTierService.create({
      productId,
      name: 'Standard',
      description: 'Standard pricing tier',
      price: productData.price,
      currency: productData.currency || 'usd',
      billingInterval: productData.billingInterval,
      features: [],
      isFreemium: false,
      isActive: true,
      sortOrder: 1,
    });
  }

  /**
   * Migrate existing products to use pricing tiers
   */
  async migrateToMultiplePricingTiers(productId: string): Promise<PricingTier[]> {
    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    // Check if product already has pricing tiers
    const existingTiers = await this.getPricingTiers(productId);
    if (existingTiers.length > 0) {
      return existingTiers;
    }

    // Create default pricing tier based on product price
    const defaultTier = await this.createDefaultPricingTier(productId, {
      name: product.name,
      price: parseFloat(product.price.toString()),
      currency: product.currency,
      slug: product.slug,
      type: product.type,
      billingInterval: product.billingInterval,
      isDigital: product.isDigital,
    });

    return [defaultTier];
  }

  // ==========================================================================
  // VISIBILITY AND AVAILABILITY CONTROLS
  // ==========================================================================

  /**
   * Check if a product is visible and available to a user
   */
  async checkProductVisibility(data: ProductVisibilityValidation): Promise<{
    isVisible: boolean;
    isAvailable: boolean;
    reason?: string;
  }> {
    const validatedData = productVisibilityValidationSchema.parse(data);
    const { productId, userRole, userRegion, currentDateTime } = validatedData;

    const product = await this.findById(productId);
    if (!product) {
      return { isVisible: false, isAvailable: false, reason: 'Product not found' };
    }

    // Check if product is active
    if (!product.isActive) {
      return { isVisible: false, isAvailable: false, reason: 'Product is not active' };
    }

    // Check publication status
    if (!product.isPublished) {
      return { isVisible: false, isAvailable: false, reason: 'Product is not published' };
    }

    // Check product status
    if (product.status === 'DRAFT' || product.status === 'ARCHIVED') {
      return { isVisible: false, isAvailable: false, reason: `Product is ${product.status.toLowerCase()}` };
    }

    // Check if scheduled and within availability window
    if (product.status === 'SCHEDULED') {
      if (product.availableFrom && currentDateTime < product.availableFrom) {
        return { isVisible: false, isAvailable: false, reason: 'Product is not yet available' };
      }
    }

    // Check availability window
    if (product.availableFrom && currentDateTime < product.availableFrom) {
      return { isVisible: true, isAvailable: false, reason: 'Product is not yet available' };
    }

    if (product.availableTo && currentDateTime > product.availableTo) {
      return { isVisible: true, isAvailable: false, reason: 'Product is no longer available' };
    }

    // Check geographic restrictions
    if (userRegion && product.restrictedRegions.includes(userRegion)) {
      return { isVisible: false, isAvailable: false, reason: 'Product is not available in your region' };
    }

    // Check role-based access
    if (product.allowedUserRoles.length > 0 && !product.allowedUserRoles.includes(userRole)) {
      return { isVisible: false, isAvailable: false, reason: 'Product access restricted to specific user roles' };
    }

    // Check user capacity limits
    if (product.isLimited && product.maxUsers) {
      if (product.currentUsers >= product.maxUsers) {
        return { isVisible: true, isAvailable: false, reason: 'Product has reached maximum user capacity' };
      }
    }

    return { isVisible: true, isAvailable: true };
  }

  /**
   * Get products visible to a user based on their context
   */
  async getVisibleProducts(
    userRole: UserRole,
    userRegion?: string,
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
    const currentDateTime = new Date();
    
    // Build visibility filters
    const visibilityFilters: ProductFilter = {
      ...filters,
      isActive: true,
      isPublished: true,
      status: 'PUBLISHED',
      createdAfter: filters.createdAfter,
      createdBefore: filters.createdBefore,
      publishedAfter: undefined,
      publishedBefore: undefined,
      availableAfter: undefined,
      availableBefore: undefined,
    };

    // Add geographic restrictions
    if (userRegion) {
      visibilityFilters.restrictedRegions = [userRegion];
    }

    // Add role-based access - if product has role restrictions, user must be included
    visibilityFilters.allowedUserRoles = [userRole];

    // Add availability window
    visibilityFilters.availableAfter = currentDateTime;
    visibilityFilters.availableBefore = currentDateTime;

    return this.findMany(visibilityFilters, sort, sortDirection, page, limit);
  }

  /**
   * Update product visibility settings
   */
  async updateProductVisibility(data: UpdateProductVisibility): Promise<Product> {
    const validatedData = updateProductVisibilitySchema.parse(data);
    const { productId, ...updateData } = validatedData;

    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    // Set publishedAt if product is being published
    const finalUpdateData: Partial<Prisma.ProductUpdateInput> = { ...updateData };
    if (updateData.isPublished && !product.publishedAt) {
      finalUpdateData.publishedAt = new Date();
    }

    return await this.prisma.product.update({
      where: { id: productId },
      data: finalUpdateData,
    });
  }

  /**
   * Update product access control settings
   */
  async updateProductAccessControl(data: UpdateProductAccessControl): Promise<Product> {
    const validatedData = updateProductAccessControlSchema.parse(data);
    const { productId, ...updateData } = validatedData;

    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    return await this.prisma.product.update({
      where: { id: productId },
      data: updateData as Prisma.ProductUpdateInput,
    });
  }

  /**
   * Bulk update product status
   */
  async bulkUpdateProductStatus(data: BulkProductStatusUpdate): Promise<{ count: number }> {
    const validatedData = bulkProductStatusUpdateSchema.parse(data);
    const { productIds, ...updateData } = validatedData;

    if (productIds.length === 0) {
      throw new Error('At least one product ID is required');
    }

    // Prepare update data
    const finalUpdateData: any = { ...updateData };

    // Set publishedAt if products are being published
    if (updateData.isPublished && !updateData.publishedAt) {
      finalUpdateData.publishedAt = new Date();
    }

    const result = await this.prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: finalUpdateData,
    });

    return { count: result.count };
  }

  /**
   * Schedule product publication
   */
  async scheduleProductPublication(
    productId: string,
    publishDate: Date,
    availableUntil?: Date
  ): Promise<Product> {
    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    const updateData: Partial<Prisma.ProductUpdateInput> = {
      status: 'SCHEDULED',
      availableFrom: publishDate,
      availableTo: availableUntil || null,
    };

    return await this.prisma.product.update({
      where: { id: productId },
      data: updateData,
    });
  }

  /**
   * Publish product immediately
   */
  async publishProduct(productId: string): Promise<Product> {
    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    const updateData: Partial<Prisma.ProductUpdateInput> = {
      status: 'PUBLISHED',
      isPublished: true,
      publishedAt: new Date(),
    };

    return await this.prisma.product.update({
      where: { id: productId },
      data: updateData,
    });
  }

  /**
   * Archive product
   */
  async archiveProduct(productId: string): Promise<Product> {
    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    const updateData: Partial<Prisma.ProductUpdateInput> = {
      status: 'ARCHIVED',
      isPublished: false,
    };

    return await this.prisma.product.update({
      where: { id: productId },
      data: updateData,
    });
  }

  /**
   * Increment current user count for limited products
   */
  async incrementUserCount(productId: string): Promise<Product> {
    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    if (!product.isLimited) {
      throw new Error('Product is not limited, user count cannot be incremented');
    }

    if (product.maxUsers && product.currentUsers >= product.maxUsers) {
      throw new Error('Product has reached maximum user capacity');
    }

    return await this.prisma.product.update({
      where: { id: productId },
      data: {
        currentUsers: { increment: 1 },
      },
    });
  }

  /**
   * Decrement current user count for limited products
   */
  async decrementUserCount(productId: string): Promise<Product> {
    const product = await this.findById(productId);
    if (!product) {
      throw new Error(`Product with ID '${productId}' not found`);
    }

    if (!product.isLimited) {
      throw new Error('Product is not limited, user count cannot be decremented');
    }

    if (product.currentUsers <= 0) {
      throw new Error('User count cannot be negative');
    }

    return await this.prisma.product.update({
      where: { id: productId },
      data: {
        currentUsers: { decrement: 1 },
      },
    });
  }

  /**
   * Get products requiring status transitions (e.g., scheduled products that should be published)
   */
  async getProductsRequiringStatusTransition(): Promise<Product[]> {
    const now = new Date();

    return await this.prisma.product.findMany({
      where: {
        OR: [
          // Scheduled products that should be published
          {
            status: 'SCHEDULED',
            availableFrom: { lte: now },
            availableTo: { gte: now },
          },
          // Published products that should be archived (past availability)
          {
            status: 'PUBLISHED',
            availableTo: { lt: now },
          },
        ],
      },
      orderBy: { availableFrom: 'asc' },
    });
  }

  /**
   * Get products with visibility restrictions
   */
  async getRestrictedProducts(): Promise<Product[]> {
    return await this.prisma.product.findMany({
      where: {
        OR: [
          { restrictedRegions: { isEmpty: false } },
          { allowedUserRoles: { isEmpty: false } },
          { isLimited: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get visibility statistics
   */
  async getVisibilityStats(): Promise<{
    total: number;
    published: number;
    draft: number;
    scheduled: number;
    archived: number;
    withRestrictions: number;
    limited: number;
    nearCapacity: number;
  }> {
    const [
      total,
      published,
      draft,
      scheduled,
      archived,
      withRestrictions,
      limited,
      nearCapacity,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.product.count({ where: { status: 'DRAFT' } }),
      this.prisma.product.count({ where: { status: 'SCHEDULED' } }),
      this.prisma.product.count({ where: { status: 'ARCHIVED' } }),
      this.prisma.product.count({
        where: {
          OR: [
            { restrictedRegions: { isEmpty: false } },
            { allowedUserRoles: { isEmpty: false } },
          ],
        },
      }),
      this.prisma.product.count({ where: { isLimited: true } }),
      this.prisma.product.count({
        where: {
          isLimited: true,
          maxUsers: { not: null },
          // Note: This is a simplified version - in production you'd want a raw query
          currentUsers: { gt: 0 },
        },
      }),
    ]);

    return {
      total,
      published,
      draft,
      scheduled,
      archived,
      withRestrictions,
      limited,
      nearCapacity,
    };
  }
}