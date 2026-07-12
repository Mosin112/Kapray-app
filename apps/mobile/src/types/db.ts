/**
 * Row types matching supabase/migrations (catalog read model).
 *
 * TODO(once hosted project is linked): replace with generated types —
 *   supabase gen types typescript --linked > src/types/database.ts
 * and derive these aliases from it.
 */

export type SyncStatus = 'live' | 'onboarding' | 'blocked';
export type CampaignKind = 'sale' | 'drop' | 'clearance';
export type CampaignStatus = 'scheduled' | 'live' | 'ended';

export interface Brand {
  id: string;
  slug: string;
  name: string;
  domain: string;
  base_url: string;
  logo_url: string | null;
  platform: string;
  currency: string; // 'PKR' | 'USD'
  sync_status: SyncStatus;
}

export interface ProductImage {
  id: string;
  product_id: string;
  src: string;
  position: number;
}

export interface Variant {
  id: string;
  product_id: string;
  external_id: string;
  title: string | null;
  price: number;
  compare_at_price: number | null;
  available: boolean;
}

export interface Product {
  id: string;
  brand_id: string;
  external_id: string;
  title: string;
  description: string | null;
  product_url: string;
  category: string | null;
  fabric: string | null;
  tags: string[];
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
}

/** Product as the feed queries it: joined with brand, images, variants. */
export interface FeedProduct extends Product {
  brand: Brand;
  images: ProductImage[];
  variants: Variant[];
}

export interface Campaign {
  id: string;
  brand_id: string;
  title: string;
  subtitle: string | null;
  hero_image: string | null;
  kind: CampaignKind;
  starts_at: string;
  ends_at: string | null;
  status: CampaignStatus;
  source: 'manual' | 'auto_detected';
}

export interface CampaignWithBrand extends Campaign {
  brand: Brand;
}
