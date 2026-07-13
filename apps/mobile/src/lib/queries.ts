/**
 * TanStack Query hooks over Supabase PostgREST (spec §7: 5-min stale time on
 * catalog reads). All catalog data is public-read via RLS.
 */
import { useQuery } from '@tanstack/react-query';

import type { Brand, CampaignWithBrand, FeedProduct } from '../types/db';
import { supabase } from './supabase';

export const CATALOG_STALE_MS = 5 * 60 * 1000;

// Full graph — used by the PDP (all images).
const FULL_PRODUCT_SELECT =
  'id,brand_id,external_id,title,description,product_url,category,fabric,tags,' +
  'first_seen_at,last_seen_at,is_active,' +
  'brand:brands(id,slug,name,domain,base_url,logo_url,platform,currency,sync_status),' +
  'images:product_images(id,product_id,src,position),' +
  'variants(id,product_id,external_id,title,price,compare_at_price,available)';

// Feed pins only need the first image + variant prices, so keep the payload
// lean across a ~1k-product catalog (images limited to 1 in the query below).
const FEED_PRODUCT_SELECT = FULL_PRODUCT_SELECT;

// PostgREST/Supabase default max-rows is 1000; keep the whole live catalog in
// one cached fetch for MVP (client-side search/filter per spec §7.2).
const FEED_ROW_LIMIT = 1000;

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
        .order('position', { referencedTable: 'product_images', ascending: true })
        .limit(1, { referencedTable: 'product_images' })
        .order('first_seen_at', { ascending: false })
        .limit(FEED_ROW_LIMIT);
      if (error) throw error;
      const rows = (data as unknown as FeedProduct[])
        .filter((p) => p.brand?.sync_status === 'live')
        .filter(hasPlausiblePrice);
      return interleaveByBrand(rows);
    },
  });
}

/**
 * Drop products the storefront left unpurchasable — Rs 0 placeholders,
 * fragrance testers, and per-meter "loose fabric" rows priced at a few rupees.
 * They'd otherwise render as "Rs 0" / "Rs 9" pins and read as broken. Floor is
 * currency-aware (the Khaadi USD feed uses a lower one). Mirrors the price>0
 * guard the scraper's Khaadi adapter already applies.
 */
const PRICE_FLOOR: Record<string, number> = { PKR: 100, USD: 3 };
function hasPlausiblePrice(p: FeedProduct): boolean {
  const v = p.variants?.[0];
  if (!v) return false;
  return v.price >= (PRICE_FLOOR[p.brand.currency] ?? 0);
}

/**
 * Round-robin products across brands so the feed opens varied instead of
 * showing one brand's whole catalog before the next. (Followed-brands-first
 * ordering replaces this in Phase 3.)
 */
function interleaveByBrand(rows: FeedProduct[]): FeedProduct[] {
  const byBrand = new Map<string, FeedProduct[]>();
  for (const p of rows) {
    const key = p.brand.slug;
    if (!byBrand.has(key)) byBrand.set(key, []);
    byBrand.get(key)!.push(p);
  }
  const queues = [...byBrand.values()];
  const out: FeedProduct[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      const p = q.shift();
      if (p) {
        out.push(p);
        added = true;
      }
    }
  }
  return out;
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    enabled: !!id,
    staleTime: CATALOG_STALE_MS,
    queryFn: async (): Promise<FeedProduct> => {
      const { data, error } = await supabase
        .from('products')
        .select(FULL_PRODUCT_SELECT)
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
