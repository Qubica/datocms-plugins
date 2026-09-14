import { faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import type { RenderFieldExtensionCtx } from 'datocms-plugin-sdk';
import { useCtx } from 'datocms-react-ui';
import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getShopifyClientConfig, parseAndNormalizeConfig } from '../../types';
import ShopifyClient from '../../utils/ShopifyClient';
import {
  type FieldSelection,
  productLookupCacheKey,
} from '../../utils/shopifyIds';
import useStore, { type State } from '../../utils/useStore';
import ProductCard from './ProductCard';
import s from './styles.module.css';

export type ValueProps = {
  selection: FieldSelection;
  onReset: () => void;
};

/** Reads whatever the field references (product or variant) from the cache. */
function resolveSelection(state: State, selection: FieldSelection) {
  if (selection.kind === 'variant') {
    const { status, variant } = state.getVariant(selection.id);

    return {
      status,
      product: variant?.product ?? null,
      variant: variant ?? null,
    };
  }

  const { status, product } = state.getProduct(
    productLookupCacheKey(selection.lookup),
  );

  return { status, product: product ?? null, variant: null };
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

  // resolveSelection() returns a new object each call; useShallow prevents
  // infinite re-renders by comparing its fields shallowly.
  const { product, variant, status } = useStore(
    useShallow((state) => resolveSelection(state as State, selection)),
  );

  const fetchProduct = useStore((state) => (state as State).fetchProduct);
  const fetchVariant = useStore((state) => (state as State).fetchVariant);

  // `selection` is rebuilt on every render, so the effect depends on its
  // primitive parts to avoid refetching in a loop.
  const kind = selection.kind;
  const by = selection.kind === 'product' ? selection.lookup.by : 'id';
  const value =
    selection.kind === 'product' ? selection.lookup.value : selection.id;

  useEffect(() => {
    if (kind === 'variant') {
      fetchVariant(client, value);
    } else {
      fetchProduct(client, { by, value });
    }
  }, [client, kind, by, value, fetchProduct, fetchVariant]);

  return (
    <div
      className={classNames(s.value, {
        [s.loading]: status === 'loading',
      })}
    >
      {status === 'error' && (
        <div className={s.product}>
          API Error! Could not fetch details for{' '}
          {kind === 'variant' ? 'product variant' : 'product'}:&nbsp;
          <code>{value}</code>
        </div>
      )}
      {product && <ProductCard product={product} variant={variant} />}
      <button type="button" onClick={onReset} className={s.reset}>
        <FontAwesomeIcon icon={faTimesCircle} />
      </button>
    </div>
  );
}
