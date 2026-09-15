import { faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import type { RenderFieldExtensionCtx } from 'datocms-plugin-sdk';
import { useCtx } from 'datocms-react-ui';
import { useEffect, useMemo } from 'react';
import { getShopifyClientConfig, parseAndNormalizeConfig } from '../../types';
import ShopifyClient, {
  isProductVariant,
  type Product,
  type ProductVariant,
} from '../../utils/ShopifyClient';
import { type FieldSelection, selectionKey } from '../../utils/shopifyIds';
import useStore, { LOADING_ENTRY } from '../../utils/useStore';
import ProductCard from './ProductCard';
import s from './styles.module.css';

export type ValueProps = {
  /** Memoized by the caller: the effect below refetches when it changes. */
  selection: FieldSelection;
  onReset: () => void;
};

/** Splits a cached entry into the product to show and the variant, if any. */
function splitResult(result: Product | ProductVariant | null) {
  if (!result) {
    return { product: null, variant: null };
  }

  return isProductVariant(result)
    ? { product: result.product, variant: result }
    : { product: result, variant: null };
}

export default function Value({ selection, onReset }: ValueProps) {
  const ctx = useCtx<RenderFieldExtensionCtx>();

  const { storefrontAccessToken, shopifyDomain } = getShopifyClientConfig(
    parseAndNormalizeConfig(ctx.plugin.attributes.parameters),
  );

  const client = useMemo(
    () => new ShopifyClient({ shopifyDomain, storefrontAccessToken }),
    [storefrontAccessToken, shopifyDomain],
  );

  const key = selectionKey(selection);
  const { result, status } = useStore(
    (state) => state.products[key] ?? LOADING_ENTRY,
  );
  const fetchSelection = useStore((state) => state.fetchSelection);

  useEffect(() => {
    fetchSelection(client, selection);
  }, [client, selection, fetchSelection]);

  const { product, variant } = splitResult(result);
  const storedValue =
    selection.kind === 'variant' ? selection.id : selection.lookup.value;

  return (
    <div
      className={classNames(s.value, {
        [s.loading]: status === 'loading',
      })}
    >
      {status === 'error' && (
        <div className={s.product}>
          API Error! Could not fetch details for{' '}
          {selection.kind === 'variant' ? 'product variant' : 'product'}:&nbsp;
          <code>{storedValue}</code>
        </div>
      )}
      {product && <ProductCard product={product} variant={variant} />}
      <button type="button" onClick={onReset} className={s.reset}>
        <FontAwesomeIcon icon={faTimesCircle} />
      </button>
    </div>
  );
}
