"use client";

import { Download, Filter, MoreHorizontal, Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import { ProductFilters } from "@/components/admin/products/ProductFilters";
import { ProductStats } from "@/components/admin/products/ProductStats";
import { ProductTable } from "@/components/admin/products/ProductTable";

import {
  enhancedFetch,
  ErrorSeverity,
  ErrorType,
  logError,
  parseError,
  retryOperation,
  type EnhancedError,
} from "@/lib/error-handling";
import { createAPIHeaders } from "@/lib/utils";
import type {
  Product,
  ProductFilter,
  ProductSort,
} from "@/lib/validations/base/product";

interface ProductsData {
  products: Product[];
  pagination: {
    page: number;
    pages: number;
    limit: number;
    total: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filters: ProductFilter;
}

interface ProductStatsData {
  total: number;
  active: number;
  inactive: number;
  digital: number;
  physical: number;
  subscription: number;
  oneTime: number;
  lowStock: number;
  outOfStock: number;
}

interface BulkOperationFeedback {
  type: "success" | "info" | "warning";
  message: string;
}

/**
 * Generate contextual feedback messages for bulk operations
 */
function generateBulkOperationFeedback(
  operation: string,
  affectedCount: number,
  requestedCount: number,
  skippedCount: number,
  operationMessage?: string
): BulkOperationFeedback {
  // Operation display names
  const operationNames = {
    activate: {
      action: "activated",
      present: "active",
      past: "already active",
    },
    deactivate: {
      action: "deactivated",
      present: "inactive",
      past: "already inactive",
    },
    delete: {
      action: "deleted",
      present: "inactive",
      past: "already inactive",
    },
    priceUpdate: {
      action: "price updated",
      present: "updated",
      past: "already updated",
    },
  };

  const opConfig = operationNames[operation as keyof typeof operationNames] || {
    action: operation,
    present: "processed",
    past: "already processed",
  };

  // If backend provided a specific message, use it as info
  if (operationMessage && affectedCount === 0) {
    return {
      type: "info",
      message: operationMessage,
    };
  }

  // All products were successfully processed
  if (affectedCount === requestedCount && affectedCount > 0) {
    return {
      type: "success",
      message: `Successfully ${opConfig.action} ${affectedCount} product${affectedCount === 1 ? "" : "s"}`,
    };
  }

  // No products were affected
  if (affectedCount === 0) {
    if (skippedCount > 0 || requestedCount > 0) {
      // All products were already in the target state
      return {
        type: "info",
        message: `All ${requestedCount} selected product${requestedCount === 1 ? " is" : "s are"} ${opConfig.past}`,
      };
    }
    return {
      type: "warning",
      message: `No products could be ${opConfig.action}`,
    };
  }

  // Mixed results - some processed, some skipped
  if (affectedCount > 0 && skippedCount > 0) {
    return {
      type: "success",
      message: `${opConfig.action.charAt(0).toUpperCase() + opConfig.action.slice(1)} ${affectedCount} product${affectedCount === 1 ? "" : "s"}. ${skippedCount} ${skippedCount === 1 ? "was" : "were"} ${opConfig.past}`,
    };
  }

  // Partial success (some products might not exist or failed)
  if (affectedCount > 0 && affectedCount < requestedCount) {
    return {
      type: "success",
      message: `Successfully ${opConfig.action} ${affectedCount} of ${requestedCount} product${requestedCount === 1 ? "" : "s"}`,
    };
  }

  // Fallback
  return {
    type: "success",
    message: `Bulk ${operation} operation completed`,
  };
}

export default function AdminProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State management
  const [productsData, setProductsData] = useState<ProductsData | null>(null);
  const [stats, setStats] = useState<ProductStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<ProductFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [sortField, setSortField] = useState<ProductSort>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [activeStatusFilter, setActiveStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Selection state for bulk operations
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Initialize state from URL parameters
  useEffect(() => {
    const search = searchParams.get("search");
    const page = searchParams.get("page");
    const sort = searchParams.get("sort");
    const sortDirection = searchParams.get("sortDirection");
    const isActive = searchParams.get("isActive");

    if (search) setSearchQuery(search);
    if (page && !isNaN(parseInt(page))) setCurrentPage(parseInt(page));
    if (sort) setSortField(sort as ProductSort);
    if (
      sortDirection &&
      (sortDirection === "asc" || sortDirection === "desc")
    ) {
      setSortDirection(sortDirection);
    }

    // Set active status filter
    if (isActive === "true") {
      setActiveStatusFilter("active");
      setFilters((prev) => ({ ...prev, isActive: true }));
    } else if (isActive === "false") {
      setActiveStatusFilter("inactive");
      setFilters((prev) => ({ ...prev, isActive: false }));
    } else {
      setActiveStatusFilter("all");
    }

    // Set other filters
    const newFilters: ProductFilter = {};
    const name = searchParams.get("name");
    const type = searchParams.get("type");
    const isDigital = searchParams.get("isDigital");
    const inStock = searchParams.get("inStock");
    const priceMin = searchParams.get("priceMin");
    const priceMax = searchParams.get("priceMax");
    const tags = searchParams.get("tags");
    const createdAfter = searchParams.get("createdAfter");
    const createdBefore = searchParams.get("createdBefore");

    if (name) newFilters.name = name;
    if (type) newFilters.type = type;
    if (isDigital !== null) newFilters.isDigital = isDigital === "true";
    if (inStock !== null) newFilters.inStock = inStock === "true";
    if (priceMin && !isNaN(parseFloat(priceMin)))
      newFilters.priceMin = parseFloat(priceMin);
    if (priceMax && !isNaN(parseFloat(priceMax)))
      newFilters.priceMax = parseFloat(priceMax);
    if (tags)
      newFilters.tags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    if (createdAfter) newFilters.createdAfter = new Date(createdAfter);
    if (createdBefore) newFilters.createdBefore = new Date(createdBefore);

    if (Object.keys(newFilters).length > 0) {
      setFilters((prev) => ({ ...prev, ...newFilters }));
    }
  }, [searchParams]);

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();

    if (searchQuery) params.set("search", searchQuery);
    if (filters.name) params.set("name", filters.name);
    if (filters.type) params.set("type", filters.type);
    if (filters.isActive !== undefined)
      params.set("isActive", filters.isActive.toString());
    if (filters.isDigital !== undefined)
      params.set("isDigital", filters.isDigital.toString());
    if (filters.inStock !== undefined)
      params.set("inStock", filters.inStock.toString());
    if (filters.priceMin !== undefined)
      params.set("priceMin", filters.priceMin.toString());
    if (filters.priceMax !== undefined)
      params.set("priceMax", filters.priceMax.toString());
    if (filters.tags && filters.tags.length > 0)
      params.set("tags", filters.tags.join(","));
    if (filters.createdAfter)
      params.set("createdAfter", filters.createdAfter.toISOString());
    if (filters.createdBefore)
      params.set("createdBefore", filters.createdBefore.toISOString());

    params.set("page", currentPage.toString());
    params.set("limit", pageSize.toString());
    params.set("sort", sortField);
    params.set("sortDirection", sortDirection);

    return params.toString();
  }, [searchQuery, filters, currentPage, pageSize, sortField, sortDirection]);

  // Update URL when filters change
  const updateURL = (newParams: URLSearchParams) => {
    const url = new URL(window.location.href);
    url.search = newParams.toString();
    window.history.replaceState({}, "", url.toString());
  };

  // Update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams();

    if (searchQuery) params.set("search", searchQuery);
    if (filters.name) params.set("name", filters.name);
    if (filters.type) params.set("type", filters.type);
    if (filters.isActive !== undefined)
      params.set("isActive", filters.isActive.toString());
    if (filters.isDigital !== undefined)
      params.set("isDigital", filters.isDigital.toString());
    if (filters.inStock !== undefined)
      params.set("inStock", filters.inStock.toString());
    if (filters.priceMin !== undefined)
      params.set("priceMin", filters.priceMin.toString());
    if (filters.priceMax !== undefined)
      params.set("priceMax", filters.priceMax.toString());
    if (filters.tags && filters.tags.length > 0)
      params.set("tags", filters.tags.join(","));
    if (filters.createdAfter)
      params.set("createdAfter", filters.createdAfter.toISOString());
    if (filters.createdBefore)
      params.set("createdBefore", filters.createdBefore.toISOString());

    if (currentPage > 1) params.set("page", currentPage.toString());
    if (sortField !== "createdAt") params.set("sort", sortField);
    if (sortDirection !== "desc") params.set("sortDirection", sortDirection);

    updateURL(params);
  }, [searchQuery, filters, currentPage, sortField, sortDirection]);

  // Fetch products data with enhanced error handling
  const fetchProducts = async () => {
    const fetchContext = {
      operation: "fetch_products",
      queryParams: queryParams.substring(0, 200), // Truncate long query params
      timestamp: new Date().toISOString(),
    };

    try {
      setLoading(true);
      setError(null);

      const response = await retryOperation(
        async () => {
          return await enhancedFetch(`/api/products?${queryParams}`, {}, 20000);
        },
        {
          maxRetries: 2,
          baseDelay: 1000,
          retryableErrors: [
            ErrorType.NETWORK_ERROR,
            ErrorType.TIMEOUT,
            ErrorType.SERVER_ERROR,
          ],
        }
      );

      const data = await response.json();
      setProductsData(data);
    } catch (_error) {
      const enhancedError =
        error && typeof error === "object" && "type" in error
          ? (error as EnhancedError)
          : parseError(error, fetchContext);

      logError(enhancedError, fetchContext);

      let errorMessage: string;

      switch (enhancedError.type) {
        case ErrorType.NETWORK_ERROR:
          errorMessage =
            "Unable to connect to server. Please check your connection.";
          break;
        case ErrorType.TIMEOUT:
          errorMessage = "Request timed out. Please try again.";
          break;
        case ErrorType.SERVER_ERROR:
          errorMessage = "Server error occurred. Please try again in a moment.";
          break;
        default:
          errorMessage = enhancedError.userMessage || "Failed to load products";
      }

      setError(errorMessage);

      // Don't show toast for loading errors - the UI will show the error state
      if (
        enhancedError.severity === ErrorSeverity.HIGH ||
        enhancedError.severity === ErrorSeverity.CRITICAL
      ) {
        toast.error("Unable to load products. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch product statistics
  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/products/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch product statistics");
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (_error) {
      console.error("Error fetching product stats:", _error);
    }
  };

  // Fetch data on component mount and when query params change
  useEffect(() => {
    fetchProducts();
  }, [queryParams]);

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters: ProductFilter) => {
    setFilters(newFilters);
    setCurrentPage(1);

    // Update active status filter state based on isActive filter
    if (newFilters.isActive === true) {
      setActiveStatusFilter("active");
    } else if (newFilters.isActive === false) {
      setActiveStatusFilter("inactive");
    } else if (newFilters.isActive === undefined) {
      setActiveStatusFilter("all");
    }
  };

  // Handle active status filter change
  const handleActiveStatusFilterChange = (
    status: "all" | "active" | "inactive"
  ) => {
    setActiveStatusFilter(status);
    setCurrentPage(1);

    const newFilters = { ...filters };

    if (status === "active") {
      newFilters.isActive = true;
    } else if (status === "inactive") {
      newFilters.isActive = false;
    } else {
      delete newFilters.isActive;
    }

    setFilters(newFilters);
  };

  // Handle sorting
  const handleSort = (field: ProductSort, direction: "asc" | "desc") => {
    setSortField(field);
    setSortDirection(direction);
    setCurrentPage(1);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle selection
  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedProducts(selectedIds);
  };

  // Handle product deletion with enhanced error handling
  const handleDeleteProduct = async (productId: string) => {
    const deleteContext = {
      productId,
      operation: "single_delete",
      timestamp: new Date().toISOString(),
    };

    try {
      await retryOperation(
        async () => {
          return await enhancedFetch(
            `/api/products/${productId}`,
            {
              method: "DELETE",
              headers: createAPIHeaders(),
            },
            30000
          );
        },
        {
          maxRetries: 1, // Single delete operations get fewer retries
          baseDelay: 1000,
          retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.TIMEOUT],
        }
      );

      toast.success("Product deleted successfully");
      await Promise.all([fetchProducts(), fetchStats()]);
    } catch (_error) {
      const enhancedError =
        error && typeof error === "object" && "type" in error
          ? (error as EnhancedError)
          : parseError(error, deleteContext);

      logError(enhancedError, deleteContext);

      // Provide specific error messages for single product deletion
      let userMessage: string;

      switch (enhancedError.type) {
        case ErrorType.RESOURCE_NOT_FOUND:
          userMessage = "Product not found. It may have already been deleted.";
          // Refresh the list to reflect current state
          fetchProducts();
          break;

        case ErrorType.CSRF_ERROR:
          userMessage =
            "Security validation failed. Please refresh the page and try again.";
          break;

        case ErrorType.INSUFFICIENT_PERMISSIONS:
          userMessage = "You don't have permission to delete this product.";
          break;

        case ErrorType.CONFLICT:
          userMessage =
            "Cannot delete product. It may be referenced by existing orders.";
          break;

        default:
          userMessage = enhancedError.userMessage || "Failed to delete product";
      }

      toast.error(userMessage);
    }
  };

  // Handle bulk operations with enhanced error handling
  const handleBulkOperation = async (operation: string, data?: unknown) => {
    if (selectedProducts.length === 0) {
      toast.error("Please select at least one product");
      return;
    }

    const operationContext = {
      operation,
      productCount: selectedProducts.length,
      selectedProducts: selectedProducts.slice(0, 5), // Log first 5 IDs only for privacy
      timestamp: new Date().toISOString(),
    };

    setBulkLoading(true);

    try {
      const endpoint = "/api/products/bulk";
      const body: {
        productIds: string[];
        operation?: string;
        activate?: boolean;
        adjustment?: unknown;
      } = { productIds: selectedProducts };

      // Prepare request body based on operation type
      switch (operation) {
        case "activate":
          body.operation = "activation";
          body.activate = true;
          break;
        case "deactivate":
          body.operation = "activation";
          body.activate = false;
          break;
        case "delete":
          body.operation = "delete";
          break;
        case "priceUpdate":
          body.operation = "price_adjustment";
          body.adjustment = data;
          break;
        default:
          throw new Error(`Unknown bulk operation: ${operation}`);
      }

      // Use enhanced fetch with retry logic for network resilience
      const response = await retryOperation(
        async () => {
          return await enhancedFetch(
            endpoint,
            {
              method: "POST",
              headers: createAPIHeaders(),
              body: JSON.stringify(body),
            },
            45000
          ); // 45 second timeout for bulk operations
        },
        {
          maxRetries: 2,
          baseDelay: 2000,
          retryableErrors: [
            ErrorType.NETWORK_ERROR,
            ErrorType.TIMEOUT,
            ErrorType.SERVICE_UNAVAILABLE,
          ],
        }
      );

      const result = await response.json();

      // Extract response data
      const affectedCount = result.result?.affectedCount || 0;
      const requestedCount =
        result.result?.requestedCount || selectedProducts.length;
      const skippedCount = result.result?.skippedCount || 0;
      const operationMessage = result.result?.message;

      // Generate contextual feedback messages
      const feedback = generateBulkOperationFeedback(
        operation,
        affectedCount,
        requestedCount,
        skippedCount,
        operationMessage
      );

      // Display appropriate toast based on operation result
      switch (feedback.type) {
        case "success":
          toast.success(feedback.message);
          break;
        case "info":
          toast.info(feedback.message);
          break;
        case "warning":
          toast.warning(feedback.message);
          break;
        default:
          toast.success(feedback.message);
          break;
      }

      // Clear selection and refresh data on success
      setSelectedProducts([]);
      await Promise.all([fetchProducts(), fetchStats()]);
    } catch (_error) {
      // Enhanced error handling with detailed categorization
      let enhancedError: EnhancedError;

      if (error && typeof error === "object" && "type" in error) {
        // Already an EnhancedError
        enhancedError = error as EnhancedError;
      } else {
        // Parse the error to get enhanced information
        enhancedError = parseError(error, operationContext);
      }

      // Log error with context
      logError(enhancedError, {
        ...operationContext,
        bulkOperation: true,
        endpoint: "/api/products/bulk",
      });

      // Provide specific user feedback based on error type
      let userMessage: string;
      let toastType: "error" | "warning" = "error";

      switch (enhancedError.type) {
        case ErrorType.NETWORK_ERROR:
          userMessage =
            "Network connection failed. Please check your internet connection and try again.";
          toastType = "warning";
          break;

        case ErrorType.TIMEOUT:
          userMessage = `The bulk ${operation} operation timed out. Some products may have been processed. Please refresh and check the results.`;
          toastType = "warning";
          break;

        case ErrorType.AUTHENTICATION_FAILED:
          userMessage =
            "Your session has expired. Please log in again to continue.";
          // Consider redirecting to login
          break;

        case ErrorType.INSUFFICIENT_PERMISSIONS:
          userMessage = `You don't have permission to perform bulk ${operation} operations.`;
          break;

        case ErrorType.CSRF_ERROR:
          userMessage =
            "Security validation failed. Please refresh the page and try again.";
          break;

        case ErrorType.RATE_LIMIT_EXCEEDED:
          userMessage =
            "Too many bulk operations. Please wait a moment before trying again.";
          toastType = "warning";
          break;

        case ErrorType.VALIDATION_ERROR:
          userMessage = enhancedError.message.includes("productIds")
            ? "Some selected products are invalid. Please refresh and try again."
            : enhancedError.userMessage;
          break;

        case ErrorType.RESOURCE_NOT_FOUND:
          userMessage =
            "Some selected products no longer exist. Please refresh and try again.";
          break;

        case ErrorType.SERVER_ERROR:
        case ErrorType.DATABASE_ERROR:
          userMessage = `Server error during bulk ${operation}. Please try again in a few moments.`;
          break;

        case ErrorType.SERVICE_UNAVAILABLE:
          userMessage =
            "The service is temporarily unavailable. Please try again later.";
          toastType = "warning";
          break;

        case ErrorType.CONFLICT:
          userMessage = `Bulk ${operation} conflicts with current data. Please refresh and try again.`;
          break;

        default:
          userMessage =
            enhancedError.userMessage ||
            `Failed to ${operation} products. Please try again.`;
      }

      // Show appropriate toast
      if (toastType === "warning") {
        toast.warning(userMessage);
      } else {
        toast.error(userMessage);
      }

      // Provide retry suggestion for retryable errors
      if (
        enhancedError.isRetryable &&
        enhancedError.severity !== ErrorSeverity.CRITICAL
      ) {
        setTimeout(() => {
          toast.info(
            `You can retry the ${operation} operation. Consider selecting fewer products if the issue persists.`,
            { duration: 8000 }
          );
        }, 3000);
      }

      // For certain errors, refresh the product list to ensure data consistency
      if (
        [
          ErrorType.RESOURCE_NOT_FOUND,
          ErrorType.CONFLICT,
          ErrorType.TIMEOUT,
        ].includes(enhancedError.type)
      ) {
        setTimeout(() => {
          fetchProducts();
          fetchStats();
        }, 1000);
      }
    } finally {
      setBulkLoading(false);
    }
  };

  // Handle export with enhanced error handling
  const handleExport = async () => {
    const exportContext = {
      operation: "export_products",
      queryParams: queryParams.substring(0, 200),
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await retryOperation(
        async () => {
          return await enhancedFetch(
            `/api/admin/products/export?${queryParams}`,
            {},
            60000
          ); // 60s timeout for export
        },
        {
          maxRetries: 1, // Limited retries for export operations
          baseDelay: 2000,
          retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.SERVER_ERROR],
        }
      );

      const blob = await response.blob();

      // Check if blob is actually an error response
      if (blob.type === "application/json") {
        const text = await blob.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || "Export failed");
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `products-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      toast.success("Products exported successfully");
    } catch (_error) {
      const enhancedError =
        error && typeof error === "object" && "type" in error
          ? (error as EnhancedError)
          : parseError(error, exportContext);

      logError(enhancedError, exportContext);

      let userMessage: string;

      switch (enhancedError.type) {
        case ErrorType.TIMEOUT:
          userMessage =
            "Export is taking longer than expected. The file might be large. Please try with fewer filters.";
          break;
        case ErrorType.INSUFFICIENT_PERMISSIONS:
          userMessage = "You don't have permission to export product data.";
          break;
        case ErrorType.SERVER_ERROR:
          userMessage =
            "Server error during export. Please try again in a moment.";
          break;
        default:
          userMessage =
            enhancedError.userMessage || "Failed to export products";
      }

      toast.error(userMessage);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground">
                Error loading products: {error}
              </p>
              <Button
                onClick={fetchProducts}
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog and inventory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => router.push("/admin/products/create")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {stats && <ProductStats stats={stats} />}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            Find and filter products by various criteria
            {activeStatusFilter !== "all" && (
              <span className="ml-2 font-medium">
                • Currently showing {activeStatusFilter} products only
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder="Search products by name, SKU, or description..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Advanced Filters
              {Object.keys(filters).length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {Object.keys(filters).length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Quick Status Filters */}
          <div className="bg-muted/30 flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <span className="text-muted-foreground text-sm font-medium">
              Quick Filter:
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant={activeStatusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => handleActiveStatusFilterChange("all")}
                className="h-8"
              >
                All Products
                {stats && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.total}
                  </Badge>
                )}
              </Button>
              <Button
                variant={
                  activeStatusFilter === "active" ? "default" : "outline"
                }
                size="sm"
                onClick={() => handleActiveStatusFilterChange("active")}
                className="h-8"
              >
                Active Only
                {stats && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.active}
                  </Badge>
                )}
              </Button>
              <Button
                variant={
                  activeStatusFilter === "inactive" ? "default" : "outline"
                }
                size="sm"
                onClick={() => handleActiveStatusFilterChange("inactive")}
                className="h-8"
              >
                Inactive Only
                {stats && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.inactive}
                  </Badge>
                )}
              </Button>
            </div>
            {activeStatusFilter !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleActiveStatusFilterChange("all")}
                className="text-muted-foreground hover:text-foreground h-8 text-xs"
              >
                Clear Filter
              </Button>
            )}
          </div>

          {showFilters && (
            <ProductFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
          )}
        </CardContent>
      </Card>

      {/* Bulk Operations */}
      {selectedProducts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="secondary">
                  {selectedProducts.length} selected
                </Badge>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkOperation("activate")}
                    disabled={bulkLoading}
                  >
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkOperation("deactivate")}
                    disabled={bulkLoading}
                  >
                    Deactivate
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={bulkLoading}
                      >
                        <MoreHorizontal className="mr-2 h-4 w-4" />
                        More Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => handleBulkOperation("delete")}
                        className="text-destructive"
                      >
                        Delete Selected
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProducts([])}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            {productsData ? (
              <>
                {`Showing ${productsData.products.length} of ${productsData.pagination.total} products`}
                {activeStatusFilter !== "all" && (
                  <span className="text-muted-foreground ml-1">
                    ({activeStatusFilter} products only)
                  </span>
                )}
              </>
            ) : (
              "Loading products..."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductTable
            products={productsData?.products || []}
            loading={loading}
            selectedProducts={selectedProducts}
            onSelectionChange={handleSelectionChange}
            onSort={handleSort}
            currentSort={{ field: sortField, direction: sortDirection }}
            onDeleteProduct={handleDeleteProduct}
            pagination={productsData?.pagination || undefined}
            onPageChange={handlePageChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
