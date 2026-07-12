# Kapray Mobile (Expo)

React Native + Expo (managed workflow, TypeScript) app. **Not scaffolded yet** —
Phase 2+ (spec §10).

## Deferred pending the prototype

Per the owner's decision, the app UI is built against the approved prototype
(`kapray-prototype.html`) for exact visual fidelity + the launch seed data. That
file isn't in the workspace yet, so Phase 2 starts once it arrives. The design
tokens are captured in spec §9 in the meantime.

## Planned shape (spec §3, §7)

```
apps/mobile/
├── app/                 # Expo Router routes (file-based)
├── src/
│   ├── components/
│   ├── features/        # feed, brand, pdp, wishlist, alerts, search, webview
│   ├── lib/             # supabase client, analytics (track), push
│   ├── theme/           # design tokens (§9)
│   └── types/           # database.ts (generated from Supabase schema)
└── app.json
```

Screens: Onboarding · Home (feed) · PDP · Sales & Drops · Brand · Saved · Alerts.
State via TanStack Query over Supabase PostgREST; WebView checkout (spec §8);
Expo push (spec §6).
