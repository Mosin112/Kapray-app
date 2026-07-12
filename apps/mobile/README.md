# Kapray Mobile (Expo)

React Native + Expo (managed, TypeScript, SDK 57) app. Visual design follows the
approved prototype ([`docs/kapray-prototype.html`](../../docs/kapray-prototype.html))
via the tokens in [`src/theme/tokens.ts`](src/theme/tokens.ts).

## Run

```bash
npm install
cp .env.example .env        # fill in your Supabase URL + anon key
npx expo start              # then press `a` for Android
```

The app reads the catalog from a hosted Supabase project (public-read RLS).
Without `.env` it fails fast at startup with a clear message.

## Layout

```
src/
├── app/                    # Expo Router routes
│   ├── (tabs)/             # HOME · SALES · SAVED · YOU
│   ├── product/[id].tsx    # PDP
│   ├── brand/[slug].tsx    # brand page
│   └── buy.tsx             # WebView checkout (spec §8)
├── components/             # ProductPin, CampaignBanner, PriceSheet, BrandLogo…
├── lib/                    # supabase client, queries (TanStack), format, wishlist
├── theme/tokens.ts         # design tokens (spec §9)
└── types/db.ts             # DB row types (replace with generated once linked)
```

## Phase status (spec §10)

- **Phase 2 (browse)** — built: Home feed (campaign carousel + countdown, brand
  chips, price-filter sheet with live result count, client-side search, 2-col
  FlashList masonry), PDP (gallery, brand row, stock/sync line, More-like-this,
  Buy CTA), Brand page, Sales & Drops hub with "Joining soon", Saved (local
  wishlist, persisted).
- **Phase 3** — pending: phone-OTP auth, follows, onboarding brand picker,
  Alerts inbox, analytics batching. The Follow button and YOU tab are visible
  stubs.
- **Phase 4** — pending: WebView analytics (clickout/purchase_detected), push.
  The WebView itself ships now so Buy doesn't dead-end (UTM params applied,
  tel:/mailto: handed to OS, no script injection).

## Conventions

- Prices: `Rs 8,000` (PKR) / `USD 35` — no FX conversion (spec §11.2, §11.8).
- Shopify CDN images always request `?width=540` (feed) / `?width=1080` (PDP).
- Deep-link scheme: `kapray://` (spec §6).
