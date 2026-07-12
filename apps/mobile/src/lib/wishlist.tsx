/**
 * Local (guest) wishlist — persisted to AsyncStorage. Phase 3 migrates these
 * ids into `wishlist_items` on sign-in (spec §10 Phase 3 acceptance: guest →
 * sign-in upgrade keeps local wishlist).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'kapray.wishlist.v1';

interface WishlistCtx {
  ids: Set<string>;
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
}

const Ctx = createContext<WishlistCtx | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setIds(new Set(JSON.parse(raw) as string[]));
    });
  }, []);

  const toggle = useCallback((productId: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const value = useMemo<WishlistCtx>(
    () => ({ ids, has: (id) => ids.has(id), toggle }),
    [ids, toggle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist(): WishlistCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
