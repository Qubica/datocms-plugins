/**
 * Zustand store for Shopify product data.
 *
 * - `products`        — products and variants referenced by fields plus
 *                       search results, keyed by `selectionKey` (search
 *                       results use the bare handle). Persisted to
 *                       localStorage: only successful entries, capped.
 * - `productVariants` — variants of a product listed in the browse modal,
 *                       keyed by handle. In-memory only.
 * - `searches`        — keyed by search query string, caches the list of
 *                       matching product handles (not full objects). Persisted.
 *
 * Searches store only handles (not full product data) to avoid duplicating
 * product objects. The full product is always read from `products[handle]`.
 *
 * State updates use Immer (`produce`) so reducers can use mutable syntax
 * while keeping immutable state under the hood.
 *
 * IMPORTANT: Zustand 5 uses React's `useSyncExternalStore`, which requires
 * selectors to return referentially stable values. Entries are returned as
 * stored (or the shared `LOADING_ENTRY`), so plain selectors are safe;
 * selectors that build new arrays or objects must use `useShallow` from
 * `zustand/react/shallow`. See BrowseProductsModal for an example.
 */

import { produce } from 'immer';
import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';
import type ShopifyClient from './ShopifyClient';
import type { Product, ProductVariant } from './ShopifyClient';
import {
  type FieldSelection,
  lookupCandidates,
  selectionKey,
} from './shopifyIds';

export type Status = 'loading' | 'success' | 'error';

export type Entry<T> = { result: T | null; status: Status };

/** Entry returned for keys not in the cache yet. */
export const LOADING_ENTRY: Entry<never> = { result: null, status: 'loading' };

export type State = {
  /** The current search query displayed in the browse modal. */
  query: string;

  /** Normalized cache of search results, keyed by query string. */
  searches: Record<string, Entry<string[]>>;

  /** Products and variants, keyed by `selectionKey`. */
  products: Record<string, Entry<Product | ProductVariant>>;

  /** Variants per product handle, for the browse modal. */
  productVariants: Record<string, Entry<ProductVariant[]>>;

  /** Resolves what a field references and caches it under its key. */
  fetchSelection(
    client: ShopifyClient,
    selection: FieldSelection,
  ): Promise<void>;

  /** Lists a product's variants, reusing the cache when already loaded. */
  fetchProductVariants(client: ShopifyClient, product: Product): Promise<void>;

  /** Searches for products matching a query string and caches the results. */
  fetchProductsMatching(client: ShopifyClient, query: string): Promise<void>;
};

async function lookup(
  client: ShopifyClient,
  selection: FieldSelection,
): Promise<Product | ProductVariant | null> {
  try {
    if (selection.kind === 'variant') {
      return await client.variantById(selection.id);
    }

    return selection.lookup.by === 'id'
      ? await client.productById(selection.lookup.value)
      : await client.productByHandle(selection.lookup.value);
  } catch (_e) {
    return null;
  }
}

/** Tries each candidate lookup in order and returns the first hit. */
async function resolveSelection(
  client: ShopifyClient,
  selection: FieldSelection,
): Promise<Product | ProductVariant | null> {
  for (const candidate of lookupCandidates(selection)) {
    // biome-ignore lint/performance/noAwaitInLoops: candidates are fallbacks, tried one at a time
    const result = await lookup(client, candidate);

    if (result) {
      return result;
    }
  }

  return null;
}

/** Keep the persisted cache bounded: successful entries only, most recent last. */
const MAX_PERSISTED_ENTRIES = 200;

function persistedProducts(products: State['products']): State['products'] {
  const entries = Object.entries(products).filter(
    ([, entry]) => entry.status === 'success' && entry.result,
  );

  return Object.fromEntries(entries.slice(-MAX_PERSISTED_ENTRIES));
}

/** localStorage that never throws: a full quota or a blocked store only disables persistence. */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch (_e) {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (_e) {
      // Quota exceeded or storage unavailable: keep the in-memory cache only.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch (_e) {
      // Nothing to do.
    }
  },
};

const useStore = create<State>()(
  persist(
    (rawSet, get) => {
      // Wraps zustand's `set` with Immer's `produce` so state updates
      // can use mutable syntax while remaining immutable under the hood.
      const set = (setFn: (s: State) => void) => {
        return rawSet(produce(setFn));
      };

      return {
        query: '',
        products: {},
        productVariants: {},
        searches: {},

        async fetchSelection(client: ShopifyClient, selection: FieldSelection) {
          const key = selectionKey(selection);

          set((state) => {
            state.products[key] = {
              result: state.products[key]?.result ?? null,
              status: 'loading',
            };
          });

          const result = await resolveSelection(client, selection);

          set((state) => {
            state.products[key] = {
              result,
              status: result ? 'success' : 'error',
            };
          });
        },

        async fetchProductVariants(client: ShopifyClient, product: Product) {
          const { handle } = product;

          if (get().productVariants[handle]?.status === 'success') {
            return;
          }

          set((state) => {
            state.productVariants[handle] = { result: null, status: 'loading' };
          });

          try {
            const variants = await client.variantsOfProduct(product);

            set((state) => {
              state.productVariants[handle] = {
                result: variants,
                status: 'success',
              };
            });
          } catch (_e) {
            set((state) => {
              state.productVariants[handle] = { result: null, status: 'error' };
            });
          }
        },

        async fetchProductsMatching(client: ShopifyClient, query: string) {
          set((state) => {
            state.searches[query] = state.searches[query] || { result: [] };
            state.searches[query].status = 'loading';
            state.query = query;
          });

          try {
            const products = await client.productsMatching(query);

            set((state) => {
              state.searches[query].status = 'success';
              // Store only handles in the search result; full product data
              // lives in the products cache to avoid duplication.
              state.searches[query].result = products.map((p) => p.handle);

              for (const product of products) {
                state.products[product.handle] = {
                  result: product,
                  status: 'success',
                };
              }
            });
          } catch (_e) {
            set((state) => {
              state.searches[query].status = 'error';
              state.searches[query].result = null;
            });
          }
        },
      };
    },
    {
      name: 'datocms-plugin-shopify-product',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        products: persistedProducts(state.products),
        searches: state.searches,
      }),
    },
  ),
);

export default useStore;
