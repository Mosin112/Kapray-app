/**
 * Formatting helpers mirroring the prototype's `rs`/`fmt`/`offPct` and the
 * spec's conventions (§11.8: `Rs 8,000` en-PK grouping, `USD 35` honest —
 * no fake FX conversion; §11.6: Shopify CDN width params).
 */

/** en-PK digit grouping (2,50,000-style lakh grouping is NOT used by the
 * prototype — it renders plain western grouping via toLocaleString('en-PK'),
 * which groups 8,000 / 16,000 the standard way). */
const group = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function fmtPrice(currency: string, value: number): string {
  if (currency === 'USD') return `USD ${group(value)}`;
  return `Rs ${group(value)}`;
}

/** Discount % from price vs compare-at (prototype `offPct`). */
export function offPct(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round((1 - price / compareAt) * 100);
}

/**
 * Spec §11.6: every Shopify CDN image request appends width (bandwidth in PK
 * matters). Feed = 540, PDP = 1080. Non-Shopify URLs (e.g. Khaadi demandware,
 * which already carries sw/sh params) pass through untouched.
 */
export function cdnImage(src: string, width: 540 | 1080): string {
  if (!src.includes('cdn.shopify.com')) return src;
  const sep = src.includes('?') ? '&' : '?';
  return `${src}${sep}width=${width}`;
}

/** "synced 4 min ago" line on PDP/feed from products.last_seen_at. */
export function syncedAgo(lastSeenAt: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(lastSeenAt)) / 60000));
  if (mins < 1) return 'synced just now';
  if (mins < 60) return `synced ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `synced ${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  return `synced ${Math.round(hrs / 24)} d ago`;
}

/** Countdown "06:41:12" for campaign ends_at; null once past. */
export function countdown(endsAt: string, now = Date.now()): string | null {
  let secs = Math.floor((Date.parse(endsAt) - now) / 1000);
  if (secs <= 0) return null;
  const days = Math.floor(secs / 86400);
  secs -= days * 86400;
  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return days > 0 ? `${days}d ${h}:${m}` : `${h}:${m}:${s}`;
}

/**
 * Spec §8: clickout URL = product_url + UTM params. Campaign id when the
 * clickout is attributable to one, else 'organic'.
 */
export function clickoutUrl(productUrl: string, campaignId?: string | null): string {
  const sep = productUrl.includes('?') ? '&' : '?';
  const utm = `utm_source=kapray&utm_medium=app&utm_campaign=${campaignId ?? 'organic'}&ref=kapray`;
  return `${productUrl}${sep}${utm}`;
}
