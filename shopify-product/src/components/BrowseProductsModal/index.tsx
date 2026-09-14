import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { RenderModalCtx } from 'datocms-plugin-sdk';
import { Button, Canvas, TextInput } from 'datocms-react-ui';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getShopifyClientConfig, parseAndNormalizeConfig } from '../../types';
import ShopifyClient, {
  isProductVariant,
  type Product,
} from '../../utils/ShopifyClient';
import useStore from '../../utils/useStore';
import ProductList from './ProductList';
import ProductVariants from './ProductVariants';
import s from './styles.module.css';

export default function BrowseProductsModal({ ctx }: { ctx: RenderModalCtx }) {
  // In variant mode a product click reveals its variants instead of
  // resolving the modal right away.
  const pickVariants = ctx.parameters.selection === 'variant';

  const performSearch = useStore((state) => state.fetchProductsMatching);

  // Select primitives directly — these are referentially stable and safe
  // to use as zustand selectors without useShallow.
  const query = useStore((state) => state.query);
  const status = useStore(
    (state) => state.searches[state.query]?.status ?? 'loading',
  );

  // Derives the product list by joining search result handles against the
  // products cache. Returns a new array each time, so useShallow is required
  // to compare elements by reference and avoid infinite re-renders.
  const products = useStore(
    useShallow((state) => {
      const result = state.searches[state.query]?.result;
      if (!result) return null;
      return result
        .map((handle: string) => state.products[handle]?.result)
        .filter((p): p is Product => !!p && !isProductVariant(p));
    }),
  );

  const [sku, setSku] = useState<string>('');
  const [expandedProduct, setExpandedProduct] = useState<Product | null>(null);

  const { storefrontAccessToken, shopifyDomain } = getShopifyClientConfig(
    parseAndNormalizeConfig(ctx.plugin.attributes.parameters),
  );

  const client = useMemo(() => {
    return new ShopifyClient({ shopifyDomain, storefrontAccessToken });
  }, [storefrontAccessToken, shopifyDomain]);

  useEffect(() => {
    performSearch(client, query);
  }, [performSearch, query, client]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setExpandedProduct(null);
    performSearch(client, sku);
  };

  const handleProductClick = (product: Product) => {
    if (pickVariants) {
      setExpandedProduct(product);
    } else {
      ctx.resolve(product);
    }
  };

  return (
    <Canvas ctx={ctx}>
      <div className={s.browse}>
        <form className={s.search} onSubmit={handleSubmit}>
          <TextInput
            placeholder="Search products... (e.g. mens shirts)"
            id="sku"
            name="sku"
            value={sku}
            onChange={setSku}
            className={s.search__input}
          />

          <Button
            type="submit"
            buttonType="primary"
            buttonSize="s"
            leftIcon={<FontAwesomeIcon icon={faSearch} />}
            disabled={status === 'loading'}
          >
            Search
          </Button>
        </form>
        <div className={s.container}>
          {expandedProduct ? (
            <ProductVariants
              client={client}
              product={expandedProduct}
              onBack={() => setExpandedProduct(null)}
              onSelect={(variant) => ctx.resolve(variant)}
            />
          ) : (
            <ProductList
              products={products}
              status={status}
              onSelect={handleProductClick}
            />
          )}
        </div>
      </div>
    </Canvas>
  );
}
