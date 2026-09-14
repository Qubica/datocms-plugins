/**
 * Zustand store for Shopify product data.
 *
 * This store manages three normalized caches, all persisted to localStorage:
 *
 * - `products`  — caches individual Product objects and their fetch status.
 *                 Keyed by product handle (search results and handle lookups)
 *                 or by `id:<numeric id>` for lookups by product ID, see
 *                 `productLookupCacheKey`. Shared between the browse modal and
 *                 the field value display.
 * - `variants`  — keyed by numeric variant ID, caches ProductVariant objects
 *                 (each carrying its parent product) and fetch status.
 * - `searches`  — keyed by search query string, caches the list of matching
 *                 product handles (not full objects) and fetch status.
 *
 * Searches store only handles (not full product data) to avoid duplicating
 * product objects. The full product is always read from `products[handle]`.
 *
 * State updates use Immer (`produce`) so reducers can use mutable syntax
 * while keeping immutable state under the hood.
 *
 * IMPORTANT: Zustand 5 uses React's `useSyncExternalStore`, which requires
 * selectors to return referentially stable values. Methods like `getProduct`
 * create new objects on each call, so consumers MUST use `useShallow` from
 * `zustand/react/shallow` when calling them as selectors to prevent infinite
 * re-render loops. See BrowseProductsModal and Value for examples.
 */

import { produce } from 'immer';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type ShopifyClient from './ShopifyClient';
import type { Product, ProductVariant } from './ShopifyClient';
import { type ProductLookup, productLookupCacheKey } from './shopifyIds';

export type Status = 'loading' | 'success' | 'error';

export type State = {
  /** The current search query displayed in the browse modal. */
  query: string;

  /** Normalized cache of search results, keyed by query string. */
  searches: Record<string, { result: string[] | null; status: Status }>;

  /** Normalized cache of individual products, see `productLookupCacheKey`. */
  products: Record<string, { result: Product | null; status: Status }>;

  /** Normalized cache of individual variants, keyed by numeric variant ID. */
  variants: Record<string, { result: ProductVariant | null; status: Status }>;

  /**
   * Derives a single product's data and fetch status from the cache.
   * Returns a new object — wrap with `useShallow` when used as a selector.
   */
  getProduct(key: string): {
    status: Status;
    product: Product | null;
  };

  /**
   * Derives a single variant's data and fetch status from the cache.
   * Returns a new object — wrap with `useShallow` when used as a selector.
   */
  getVariant(id: string): {
    status: Status;
    variant: ProductVariant | null;
  };

  /** Fetches a single product by handle or ID and caches the result. */
  fetchProduct(client: ShopifyClient, lookup: ProductLookup): Promise<void>;

  /** Fetches a single variant by its numeric ID and caches the result. */
  fetchVariant(client: ShopifyClient, id: string): Promise<void>;

  /** Searches for products matching a query string and caches the results. */
  fetchProductsMatching(client: ShopifyClient, query: string): Promise<void>;
};

const useStore = create(
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
        variants: {},
        searches: {},

        getProduct(key: string) {
          const selectedProduct = (get() as State).products[key];

          return {
            status: selectedProduct?.status
              ? selectedProduct.status
              : 'loading',
            product: selectedProduct?.result,
          };
        },

        getVariant(id: string) {
          const selectedVariant = (get() as State).variants[id];

          return {
            status: selectedVariant?.status
              ? selectedVariant.status
              : 'loading',
            variant: selectedVariant?.result,
          };
        },

        async fetchProduct(client: ShopifyClient, lookup: ProductLookup) {
          const key = productLookupCacheKey(lookup);

          set((state) => {
            state.products[key] = state.products[key] || { result: null };
            state.products[key].status = 'loading';
          });

          try {
            const product =
              lookup.by === 'id'
                ? await client.productById(lookup.value)
                : await client.productByHandle(lookup.value);

            set((state) => {
              state.products[key].result = product;
              state.products[key].status = 'success';
            });
          } catch (_e) {
            set((state) => {
              state.products[key].result = null;
              state.products[key].status = 'error';
            });
          }
        },

        async fetchVariant(client: ShopifyClient, id: string) {
          set((state) => {
            state.variants[id] = state.variants[id] || { result: null };
            state.variants[id].status = 'loading';
          });

          try {
            const variant = await client.variantById(id);

            set((state) => {
              state.variants[id].result = variant;
              state.variants[id].status = 'success';
            });
          } catch (_e) {
            set((state) => {
              state.variants[id].result = null;
              state.variants[id].status = 'error';
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
                state.products[product.handle] =
                  state.products[product.handle] || {};
                state.products[product.handle].result = product;
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
    },
  ),
);

export default useStore;
