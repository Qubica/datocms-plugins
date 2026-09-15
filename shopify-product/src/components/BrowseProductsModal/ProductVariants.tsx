import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { Button } from 'datocms-react-ui';
import { useEffect } from 'react';
import type ShopifyClient from '../../utils/ShopifyClient';
import {
  type Product,
  type ProductVariant,
  variantMeta,
} from '../../utils/ShopifyClient';
import useStore, { LOADING_ENTRY } from '../../utils/useStore';
import Price from '../Price';
import ListStatus from './ListStatus';
import s from './styles.module.css';

export type ProductVariantsProps = {
  client: ShopifyClient;
  product: Product;
  onBack: () => void;
  onSelect: (variant: ProductVariant) => void;
};

export default function ProductVariants({
  client,
  product,
  onBack,
  onSelect,
}: ProductVariantsProps) {
  const { result: variants, status } = useStore(
    (state) => state.productVariants[product.handle] ?? LOADING_ENTRY,
  );
  const fetchProductVariants = useStore((state) => state.fetchProductVariants);

  useEffect(() => {
    fetchProductVariants(client, product);
  }, [client, product, fetchProductVariants]);

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
        {variants?.map((variant) => {
          const meta = variantMeta(variant);

          return (
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
                {meta.length > 0 && (
                  <div className={s.variant__meta}>{meta.join(' · ')}</div>
                )}
              </div>
              <div className={s.variant__price}>
                <Price {...variant.price} />
              </div>
            </button>
          );
        })}
        <ListStatus
          status={status}
          isEmpty={!!variants && variants.length === 0}
          emptyMessage="No variants found!"
        />
      </div>
    </div>
  );
}
