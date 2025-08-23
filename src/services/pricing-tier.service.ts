import { PrismaClient, PricingTier, Prisma } from '@prisma/client';
import {
  CreatePricingTier,
  UpdatePricingTier,
  PricingTierFilter,
  PricingTierSort,
  ReorderPricingTiers,
  FeatureComparison,
  FreemiumTierValidation,
  BulkPricingTierUpdate,
  ActivatePricingTier,
  PricingTierStats,
  createPricingTierSchema,
  updatePricingTierSchema,
  pricingTierFilterSchema,
  reorderPricingTiersSchema,
  featureComparisonSchema,
  freemiumTierValidationSchema,
  bulkPricingTierUpdateSchema,
  activatePricingTierSchema,
} from '@/lib/validations/base/pricing-tier';

/**
 * Pricing Tier Service
 * 
 * Comprehensive service for managing pricing tiers with support for:
 * - Multiple pricing models (one-time, subscription, freemium)
 * - Business rule validation
 * - Feature management and comparison
 * - Tier hierarchy and ordering
 * - Stripe integration preparation
 */

export class PricingTierService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Create a new pricing tier
   */
  async create(data: CreatePricingTier): Promise<PricingTier> {
    // Validate input data
    const validatedData = createPricingTierSchema.parse(data);

    // Check for duplicate tier name within the product
    const existingTier = await this.prisma.pricingTier.findUnique({
      where: {
        productId_name: {
          productId: validatedData.productId,
          name: validatedData.name,
        },
      },
    });

    if (existingTier) {
      throw new Error(
        `Pricing tier '${validatedData.name}' already exists for this product`
      );
    }

    // Check freemium tier business rule - only one freemium tier per product
    if (validatedData.isFreemium) {
      const existingFreemiumTier = await this.prisma.pricingTier.findFirst({
        where: {
          productId: validatedData.productId,
          isFreemium: true,
          isActive: true,
        },
      });

      if (existingFreemiumTier) {
        throw new Error(
          'Only one freemium tier is allowed per product'
        );
      }
    }

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: validatedData.productId },
    });

    if (!product) {
      throw new Error(`Product with ID '${validatedData.productId}' not found`);
    }

    // Auto-assign sort order if not provided
    if (!validatedData.sortOrder) {
      const maxOrder = await this.prisma.pricingTier.aggregate({
        where: { productId: validatedData.productId },
        _max: { sortOrder: true },
      });
      validatedData.sortOrder = (maxOrder._max.sortOrder || 0) + 1;
    }

    // Create pricing tier
    const pricingTier = await this.prisma.pricingTier.create({
      data: {
        ...validatedData,
        price: new Prisma.Decimal(validatedData.price),
        features: validatedData.features || [],
      },
    });

    return pricingTier;
  }

  /**
   * Get pricing tier by ID
   */
  async findById(id: string): Promise<PricingTier | null> {
    return await this.prisma.pricingTier.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });
  }

  /**
   * Get pricing tier by product and name
   */
  async findByProductAndName(productId: string, name: string): Promise<PricingTier | null> {
    return await this.prisma.pricingTier.findUnique({
      where: {
        productId_name: {
          productId,
          name,
        },
      },
    });
  }

  /**
   * Update pricing tier
   */
  async update(data: UpdatePricingTier): Promise<PricingTier> {
    const validatedData = updatePricingTierSchema.parse(data);
    const { id, ...updateData } = validatedData;

    // Check if pricing tier exists
    const existingTier = await this.findById(id);
    if (!existingTier) {
      throw new Error(`Pricing tier with ID '${id}' not found`);
    }

    // Check for duplicate name if updating
    if (updateData.name && updateData.name !== existingTier.name) {
      const duplicateTier = await this.findByProductAndName(
        existingTier.productId,
        updateData.name
      );

      if (duplicateTier) {
        throw new Error(
          `Pricing tier '${updateData.name}' already exists for this product`
        );
      }
    }

    // Check freemium tier business rule
    if (updateData.isFreemium === true) {
      const existingFreemiumTier = await this.prisma.pricingTier.findFirst({
        where: {
          productId: existingTier.productId,
          isFreemium: true,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingFreemiumTier) {
        throw new Error(
          'Only one freemium tier is allowed per product'
        );
      }
    }

    // Prepare update data with proper type conversion
    const preparedUpdateData: Partial<Prisma.PricingTierUpdateInput> = { ...updateData };

    if (updateData.price !== undefined) {
      preparedUpdateData.price = new Prisma.Decimal(updateData.price);
    }

    return await this.prisma.pricingTier.update({
      where: { id },
      data: preparedUpdateData,
    });
  }

  /**
   * Soft delete pricing tier (set isActive to false)
   */
  async softDelete(id: string): Promise<PricingTier> {
    const tier = await this.findById(id);
    if (!tier) {
      throw new Error(`Pricing tier with ID '${id}' not found`);
    }

    return await this.prisma.pricingTier.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Hard delete pricing tier (permanent deletion)
   */
  async delete(id: string): Promise<void> {
    const tier = await this.findById(id);
    if (!tier) {
      throw new Error(`Pricing tier with ID '${id}' not found`);
    }

    // Check for existing subscriptions or orders referencing this tier
    // Note: In a real system, you'd check against order items that reference this tier
    // For now, we'll add a check for future expansion

    await this.prisma.pricingTier.delete({
      where: { id },
    });
  }

  // ==========================================================================
  // SEARCH AND FILTERING
  // ==========================================================================

  /**
   * Search and filter pricing tiers with pagination
   */
  async findMany(
    productId: string,
    filters: PricingTierFilter = {},
    sort: PricingTierSort = 'sortOrder',
    sortDirection: 'asc' | 'desc' = 'asc',
    page = 1,
    limit = 20
  ): Promise<{
    tiers: PricingTier[];
    total: number;
    page: number;
    pages: number;
    limit: number;
  }> {
    const validatedFilters = pricingTierFilterSchema.parse({ ...filters, productId });
    
    // Build where clause
    const where: Prisma.PricingTierWhereInput = {
      productId,
    };

    if (validatedFilters.name) {
      where.name = {
        contains: validatedFilters.name,
        mode: 'insensitive',
      };
    }

    if (validatedFilters.isFreemium !== undefined) {
      where.isFreemium = validatedFilters.isFreemium;
    }

    if (validatedFilters.isActive !== undefined) {
      where.isActive = validatedFilters.isActive;
    }

    if (validatedFilters.billingInterval) {
      where.billingInterval = validatedFilters.billingInterval;
    }

    if (validatedFilters.hasTrialPeriod !== undefined) {
      where.trialDays = validatedFilters.hasTrialPeriod
        ? { gt: 0 }
        : { equals: null };
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

    // Build order by clause
    const orderBy: Prisma.PricingTierOrderByWithRelationInput = {};
    orderBy[sort] = sortDirection;

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Execute queries
    const [tiers, total] = await Promise.all([
      this.prisma.pricingTier.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.pricingTier.count({ where }),
    ]);

    const pages = Math.ceil(total / limit);

    return {
      tiers,
      total,
      page,
      pages,
      limit,
    };
  }

  /**
   * Get all pricing tiers for a product
   */
  async findByProductId(productId: string, includeInactive = false): Promise<PricingTier[]> {
    const where: Prisma.PricingTierWhereInput = { productId };
    
    if (!includeInactive) {
      where.isActive = true;
    }

    return await this.prisma.pricingTier.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ==========================================================================
  // BUSINESS LOGIC OPERATIONS
  // ==========================================================================

  /**
   * Reorder pricing tiers
   */
  async reorderTiers(data: ReorderPricingTiers): Promise<PricingTier[]> {
    const validatedData = reorderPricingTiersSchema.parse(data);
    const { productId, tierIds } = validatedData;

    // Verify all tiers belong to the product
    const existingTiers = await this.prisma.pricingTier.findMany({
      where: {
        id: { in: tierIds },
        productId,
      },
    });

    if (existingTiers.length !== tierIds.length) {
      throw new Error('One or more pricing tiers do not belong to the specified product');
    }

    // Update sort order for each tier
    const updatePromises = tierIds.map((tierId, index) =>
      this.prisma.pricingTier.update({
        where: { id: tierId },
        data: { sortOrder: index + 1 },
      })
    );

    await Promise.all(updatePromises);

    // Return updated tiers in new order
    return await this.findByProductId(productId);
  }

  /**
   * Get feature comparison between tiers
   */
  async getFeatureComparison(data: FeatureComparison): Promise<{
    tiers: PricingTier[];
    featureMatrix: Record<string, Record<string, boolean>>;
    allFeatures: string[];
  }> {
    const validatedData = featureComparisonSchema.parse(data);
    const { productId, features } = validatedData;

    const tiers = await this.findByProductId(productId);
    
    const featureMatrix: Record<string, Record<string, boolean>> = {};
    const allFeatures = new Set<string>();

    // Build feature matrix
    tiers.forEach(tier => {
      featureMatrix[tier.id] = {};
      const tierFeatures = tier.features as string[];
      
      tierFeatures.forEach(feature => allFeatures.add(feature));
      
      features.forEach(feature => {
        featureMatrix[tier.id][feature] = tierFeatures.includes(feature);
      });
    });

    return {
      tiers,
      featureMatrix,
      allFeatures: Array.from(allFeatures),
    };
  }

  /**
   * Validate freemium tier constraints
   */
  async validateFreemiumTier(data: FreemiumTierValidation): Promise<{
    isValid: boolean;
    existingFreemiumTier?: PricingTier;
    message?: string;
  }> {
    const validatedData = freemiumTierValidationSchema.parse(data);
    const { productId, excludeCurrentTierId } = validatedData;

    const whereClause: Prisma.PricingTierWhereInput = {
      productId,
      isFreemium: true,
      isActive: true,
    };

    if (excludeCurrentTierId) {
      whereClause.id = { not: excludeCurrentTierId };
    }

    const existingFreemiumTier = await this.prisma.pricingTier.findFirst({
      where: whereClause,
    });

    if (existingFreemiumTier) {
      return {
        isValid: false,
        existingFreemiumTier,
        message: 'Only one freemium tier is allowed per product',
      };
    }

    return { isValid: true };
  }

  /**
   * Bulk update pricing tiers
   */
  async bulkUpdate(data: BulkPricingTierUpdate): Promise<{ count: number }> {
    const validatedData = bulkPricingTierUpdateSchema.parse(data);
    const { productId, tierIds, updates } = validatedData;

    // Verify all tiers belong to the product
    const tierCount = await this.prisma.pricingTier.count({
      where: {
        id: { in: tierIds },
        productId,
      },
    });

    if (tierCount !== tierIds.length) {
      throw new Error('One or more pricing tiers do not belong to the specified product');
    }

    const result = await this.prisma.pricingTier.updateMany({
      where: { id: { in: tierIds } },
      data: updates,
    });

    return { count: result.count };
  }

  /**
   * Activate/deactivate pricing tier
   */
  async setActiveStatus(data: ActivatePricingTier): Promise<PricingTier> {
    const validatedData = activatePricingTierSchema.parse(data);
    const { tierId, isActive } = validatedData;

    const tier = await this.findById(tierId);
    if (!tier) {
      throw new Error(`Pricing tier with ID '${tierId}' not found`);
    }

    return await this.prisma.pricingTier.update({
      where: { id: tierId },
      data: { isActive },
    });
  }

  // ==========================================================================
  // STATISTICS AND ANALYTICS
  // ==========================================================================

  /**
   * Get pricing tier statistics for a product
   */
  async getStats(productId: string): Promise<PricingTierStats> {
    const tiers = await this.findByProductId(productId, true);
    const activeTiers = tiers.filter(tier => tier.isActive);

    const stats: PricingTierStats = {
      productId,
      totalTiers: tiers.length,
      activeTiers: activeTiers.length,
      freemiumTiers: tiers.filter(tier => tier.isFreemium).length,
      subscriptionTiers: tiers.filter(tier => tier.billingInterval).length,
      oneTimeTiers: tiers.filter(tier => !tier.billingInterval).length,
      averagePrice: 0,
      priceRange: { min: 0, max: 0 },
    };

    if (activeTiers.length > 0) {
      const prices = activeTiers.map(tier => parseFloat(tier.price.toString()));
      stats.averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      stats.priceRange.min = Math.min(...prices);
      stats.priceRange.max = Math.max(...prices);
    }

    return stats;
  }

  /**
   * Get pricing tier recommendations based on features
   */
  async getRecommendations(productId: string, requiredFeatures: string[]): Promise<PricingTier[]> {
    const tiers = await this.findByProductId(productId);
    
    return tiers
      .filter(tier => {
        const tierFeatures = tier.features as string[];
        return requiredFeatures.every(feature => tierFeatures.includes(feature));
      })
      .sort((a, b) => parseFloat(a.price.toString()) - parseFloat(b.price.toString()));
  }

  /**
   * Get cheapest tier with specific features
   */
  async getCheapestTierWithFeatures(productId: string, requiredFeatures: string[]): Promise<PricingTier | null> {
    const recommendations = await this.getRecommendations(productId, requiredFeatures);
    return recommendations[0] || null;
  }

  /**
   * Get freemium tier for a product
   */
  async getFreemiumTier(productId: string): Promise<PricingTier | null> {
    return await this.prisma.pricingTier.findFirst({
      where: {
        productId,
        isFreemium: true,
        isActive: true,
      },
    });
  }
}