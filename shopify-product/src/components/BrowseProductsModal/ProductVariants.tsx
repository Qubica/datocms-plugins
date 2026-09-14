import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { Button, Spinner } from 'datocms-react-ui';
import { useEffect, useState } from 'react';
import type ShopifyClient from '../../utils/ShopifyClient';
import type { Product, ProductVariant } from '../../utils/ShopifyClient';
import type { Status } from '../../utils/useStore';
import Price from '../Price';
import s from './styles.module.css';

export type ProductVariantsProps = {
  client: ShopifyClient;
  product: Product;
  onBack: () => void;
  onSelect: (variant: ProductVariant) => void;
};

type VariantsState = {
  status: Status;
  variants: ProductVariant[];
};

/** Option pairs worth showing; Shopify's placeholder option is skipped. */
function variantMeta(variant: ProductVariant): string[] {
  const options = variant.selectedOptions
    .filter(
      (option) => option.name !== 'Title' || option.value !== 'Default Title',
    )
    .map((option) => `${option.name}: ${option.value}`);

  if (variant.sku) {
    options.push(`SKU: ${variant.sku}`);
  }

  if (!variant.availableForSale) {
    options.push('Unavailable');
  }

  return options;
}

export default function ProductVariants({
  client,
  product,
  onBack,
  onSelect,
}: ProductVariantsProps) {
  const [{ status, variants }, setState] = useState<VariantsState>({
    status: 'loading',
    variants: [],
  });

  useEffect(() => {
    let cancelled = false;

    setState({ status: 'loading', variants: [] });

    client
      .variantsOfProduct(product.handle)
      .then((result) => {
        if (!cancelled) {
          setState({ status: 'success', variants: result });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: 'error', variants: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, product.handle]);

  return (
    <div className={s.variants}>
      <div className={s.variants__header}>
        <Button
          type="button"
          buttonSize="s"
          onClick={onBack}
          leftIcon={<FontAwesomeIcon icon={faArrowLeft} />}
        >
          Back to products
        </Button>
        <div className={s.variants__title}>
          Variants of <strong>{product.title}</strong>
        </div>
      </div>
      <div className={s.variants__list}>
        {variants.map((variant) => (
          <button
            type="button"
            key={variant.id}
            onClick={() => onSelect(variant)}
            className={classNames(s.variant, {
              [s.variant__unavailable]: !variant.availableForSale,
            })}
          >
            <div
              className={s.variant__image}
              style={{ backgroundImage: `url(${variant.imageUrl})` }}
            />
            <div className={s.variant__content}>
              <div className={s.variant__title}>{variant.title}</div>
              {variantMeta(variant).length > 0 && (
                <div className={s.variant__meta}>
                  {variantMeta(variant).join(' · ')}
                </div>
              )}
            </div>
            <div className={s.variant__price}>
              <Price {...variant.price} />
            </div>
          </button>
        ))}
        {status === 'loading' && <Spinner size={25} placement="centered" />}
        {status === 'success' && variants.length === 0 && (
          <div className={s.empty}>No variants found!</div>
        )}
        {status === 'error' && <div className={s.empty}>API call failed!</div>}
      </div>
    </div>
  );
}
