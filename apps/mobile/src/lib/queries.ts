/**
 * TanStack Query hooks over Supabase PostgREST (spec §7: 5-min stale time on
 * catalog reads). All catalog data is public-read via RLS.
 */
import { useQuery } from '@tanstack/react-query';

import type { Brand, CampaignWithBrand, FeedProduct } from '../types/db';
import { supabase } from './supabase';

export const CATALOG_STALE_MS = 5 * 60 * 1000;

const FEED_PRODUCT_SELECT =
  'id,brand_id,external_id,title,description,product_url,category,fabric,tags,' +
  'first_seen_at,last_seen_at,is_active,' +
  'brand:brands(id,slug,name,domain,base_url,logo_url,platform,currency,sync_status),' +
  'images:product_images(id,product_id,src,position),' +
  'variants(id,product_id,external_id,title,price,compare_at_price,available)';

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    staleTime: CATALOG_STALE_MS,
    queryFn: async (): Promise<Brand[]> => {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('sync_status', { ascending: true }) // 'blocked' < 'live' < 'onboarding'… sorted client-side below anyway
        .order('name');
      if (error) throw error;
      return data as Brand[];
    },
  });
}

/**
 * The full active catalog for the feed. MVP scale is small (3 brands); search
 * and filtering are client-side per spec §7.2. Sorted by recency
 * (followed-brands-first ordering arrives with follows in Phase 3).
 */
export function useFeedProducts() {
  return useQuery({
    queryKey: ['feed-products'],
    staleTime: CATALOG_STALE_MS,
    queryFn: async (): Promise<FeedProduct[]> => {
      const { data, error } = await supabase
        .from('products')
        .select(FEED_PRODUCT_SELECT)
        .eq('is_active', true)
        .order('first_seen_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = data as unknown as FeedProduct[];
      // Keep images in position order; only products from live brands surface.
      return rows
        .filter((p) => p.brand?.sync_status === 'live')
        .map((p) => ({ ...p, images: [...p.images].sort((a, b) => a.position - b.position) }));
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    enabled: !!id,
    staleTime: CATALOG_STALE_MS,
    queryFn: async (): Promise<FeedProduct> => {
      const { data, error } = await supabase
        .from('products')
        .select(FEED_PRODUCT_SELECT)
        .eq('id', id!)
        .single();
      if (error) throw error;
      const p = data as unknown as FeedProduct;
      return { ...p, images: [...p.images].sort((a, b) => a.position - b.position) };
    },
  });
}

export function useLiveCampaigns() {
  return useQuery({
    queryKey: ['campaigns', 'live'],
    staleTime: CATALOG_STALE_MS,
    queryFn: async (): Promise<CampaignWithBrand[]> => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*,brand:brands(id,slug,name,domain,base_url,logo_url,platform,currency,sync_status)')
        .eq('status', 'live')
        .order('starts_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CampaignWithBrand[];
    },
  });
}
