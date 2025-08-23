"use client";

import { AlertTriangle, BarChart3, Info, Plus, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { createAPIHeaders } from "@/lib/utils";
import { PricingTierCard, type PricingTier } from "./PricingTierCard";
import { PricingTierForm } from "./PricingTierForm";

interface PricingTierStats {
  productId: string;
  totalTiers: number;
  activeTiers: number;
  freemiumTiers: number;
  subscriptionTiers: number;
  oneTimeTiers: number;
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
}

interface PricingTierManagerProps {
  productId: string;
  productName: string;
  productType: "ONE_TIME" | "SUBSCRIPTION" | "USAGE_BASED";
}

export function PricingTierManager({
  productId,
  productName,
  productType,
}: PricingTierManagerProps) {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [stats, setStats] = useState<PricingTierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTier | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch pricing tiers
  const fetchTiers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/${productId}/pricing-tiers`);
      if (!response.ok) throw new Error("Failed to fetch pricing tiers");

      const data = await response.json();
      setTiers(data.tiers || []);
    } catch (_error) {
      console.error("Error fetching pricing tiers:", _error);
      toast.error("Failed to load pricing tiers");
    } finally {
      setLoading(false);
    }
  };

  // Fetch pricing tier statistics
  const fetchStats = async () => {
    try {
      const response = await fetch(
        `/api/products/${productId}/pricing-tiers/stats`
      );
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (_error) {
      console.error("Error fetching pricing tier stats:", _error);
    }
  };

  useEffect(() => {
    fetchTiers();
    fetchStats();
  }, [productId]);

  // Handle create/update tier
  const handleSubmitTier = async (data: any) => {
    try {
      setIsSubmitting(true);

      const url = editingTier
        ? `/api/products/${productId}/pricing-tiers/${editingTier.id}`
        : `/api/products/${productId}/pricing-tiers`;

      const method = editingTier ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: createAPIHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `Failed to ${editingTier ? "update" : "create"} pricing tier`
        );
      }

      toast.success(
        `Pricing tier ${editingTier ? "updated" : "created"} successfully`
      );
      setIsFormOpen(false);
      setEditingTier(undefined);
      fetchTiers();
      fetchStats();
    } catch (error: unknown) {
      console.error("Error saving pricing tier:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${editingTier ? "update" : "create"} pricing tier`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete tier
  const handleDeleteTier = async (tier: PricingTier) => {
    try {
      const response = await fetch(
        `/api/products/${productId}/pricing-tiers/${tier.id}`,
        {
          method: "DELETE",
          headers: createAPIHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete pricing tier");
      }

      toast.success("Pricing tier deleted successfully");
      fetchTiers();
      fetchStats();
    } catch (error: unknown) {
      console.error("Error deleting pricing tier:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete pricing tier"
      );
    }
  };

  // Handle toggle tier active status
  const handleToggleActive = async (tier: PricingTier) => {
    try {
      const response = await fetch(
        `/api/products/${productId}/pricing-tiers/${tier.id}`,
        {
          method: "PUT",
          headers: createAPIHeaders(),
          body: JSON.stringify({
            isActive: !tier.isActive,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update tier status");
      }

      toast.success(
        `Tier ${!tier.isActive ? "activated" : "deactivated"} successfully`
      );
      fetchTiers();
    } catch (error: unknown) {
      console.error("Error toggling tier status:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update tier status"
      );
    }
  };

  // Handle reorder tiers
  const handleReorderTiers = async (newOrder: PricingTier[]) => {
    try {
      const tierIds = newOrder.map((tier) => tier.id);

      const response = await fetch(
        `/api/products/${productId}/pricing-tiers/reorder`,
        {
          method: "POST",
          headers: createAPIHeaders(),
          body: JSON.stringify({ tierIds }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reorder tiers");
      }

      toast.success("Tiers reordered successfully");
      fetchTiers();
    } catch (error: unknown) {
      console.error("Error reordering tiers:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reorder tiers"
      );
    }
  };

  const handleMoveUp = (tier: PricingTier) => {
    const currentIndex = tiers.findIndex((t) => t.id === tier.id);
    if (currentIndex > 0) {
      const newOrder = [...tiers];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [
        newOrder[currentIndex],
        newOrder[currentIndex - 1],
      ];
      handleReorderTiers(newOrder);
    }
  };

  const handleMoveDown = (tier: PricingTier) => {
    const currentIndex = tiers.findIndex((t) => t.id === tier.id);
    if (currentIndex < tiers.length - 1) {
      const newOrder = [...tiers];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [
        newOrder[currentIndex + 1],
        newOrder[currentIndex],
      ];
      handleReorderTiers(newOrder);
    }
  };

  const openCreateForm = () => {
    setEditingTier(undefined);
    setIsFormOpen(true);
  };

  const openEditForm = (tier: PricingTier) => {
    setEditingTier(tier);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTier(undefined);
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(price);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const activeTiers = tiers.filter((t) => t.isActive);
  const hasFreemiumTier = tiers.some((t) => t.isFreemium && t.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Pricing Tiers</h2>
          <p className="text-muted-foreground mt-1">
            Manage pricing tiers for "{productName}"
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tier
        </Button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-muted-foreground text-sm">Total Tiers</p>
                  <p className="text-2xl font-bold">{stats.totalTiers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-muted-foreground text-sm">Active</p>
                  <p className="text-2xl font-bold">{stats.activeTiers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-muted-foreground text-sm">Avg Price</p>
                <p className="text-2xl font-bold">
                  {formatPrice(stats.averagePrice, "usd")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-muted-foreground text-sm">Price Range</p>
                <p className="text-lg font-bold">
                  {formatPrice(stats.priceRange.min, "usd")} -{" "}
                  {formatPrice(stats.priceRange.max, "usd")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts and Info */}
      {tiers.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No pricing tiers configured. Create your first tier to get started.
          </AlertDescription>
        </Alert>
      )}

      {tiers.length > 0 && activeTiers.length === 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            All pricing tiers are inactive. Customers won't be able to purchase
            this product.
          </AlertDescription>
        </Alert>
      )}

      {tiers.length > 1 &&
        !hasFreemiumTier &&
        productType === "SUBSCRIPTION" && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Consider adding a freemium tier to attract more customers to your
              subscription product.
            </AlertDescription>
          </Alert>
        )}

      {/* Pricing Tiers Grid */}
      {tiers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <PricingTierCard
              key={tier.id}
              tier={tier}
              onEdit={openEditForm}
              onDelete={handleDeleteTier}
              onToggleActive={handleToggleActive}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              canMoveUp={index > 0}
              canMoveDown={index < tiers.length - 1}
            />
          ))}
        </div>
      )}

      {/* Pricing Tier Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {editingTier ? "Edit Pricing Tier" : "Create Pricing Tier"}
            </DialogTitle>
            <DialogDescription>
              {editingTier
                ? `Update the pricing tier "${editingTier.name}"`
                : "Create a new pricing tier for your product"}
            </DialogDescription>
          </DialogHeader>

          <PricingTierForm
            productId={productId}
            tier={editingTier}
            onSubmit={handleSubmitTier}
            onCancel={closeForm}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
