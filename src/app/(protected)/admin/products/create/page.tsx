'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { ProductForm } from '@/components/admin/products/ProductForm';
import type { CreateProduct } from '@/lib/validations/base/product';

export default function CreateProductPage() {
  const searchParams = useSearchParams();
  const [initialData, setInitialData] = useState<Partial<CreateProduct> | null>(null);

  // Check for duplicate data in search params
  useEffect(() => {
    const duplicateData = searchParams.get('duplicate');
    if (duplicateData) {
      try {
        const parsedData = JSON.parse(duplicateData);
        // Remove fields that shouldn't be duplicated
        const {
          id: _id,
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          stripeProductId: _stripeProductId,
          stripePriceId: _stripePriceId,
          ...cleanData
        } = parsedData;
        
        setInitialData(cleanData);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error parsing duplicate data:', error);
      }
    }
  }, [searchParams]);

  return (
    <ProductForm 
      mode="create"
      product={initialData as CreateProduct}
    />
  );
}