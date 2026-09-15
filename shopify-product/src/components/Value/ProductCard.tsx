import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import {
  type Product,
  type ProductVariant,
  variantMeta,
} from '../../utils/ShopifyClient';
import { toNumericId } from '../../utils/shopifyIds';
import Price from '../Price';
import s from './styles.module.css';

export type ProductCardProps = {
  product: Product;
  variant?: ProductVariant | null;
};

function storeUrl(product: Product, variant?: ProductVariant | null) {
  if (!product.onlineStoreUrl) {
    return null;
  }

  return variant
    ? `${product.onlineStoreUrl}?variant=${toNumericId(variant.id)}`
    : product.onlineStoreUrl;
}

function ProductPrice({ product }: { product: Product }) {
  const { minVariantPrice, maxVariantPrice } = product.priceRange;

  if (maxVariantPrice.amount === minVariantPrice.amount) {
    return <Price {...maxVariantPrice} />;
  }

  return (
    <span>
      <Price {...minVariantPrice} />
      &nbsp; - &nbsp;
      <Price {...maxVariantPrice} />
    </span>
  );
}

export default function ProductCard({ product, variant }: ProductCardProps) {
  const url = storeUrl(product, variant);
  const imageUrl =
    variant?.imageUrl || product.previewImageUrl || product.imageUrl;

  return (
    <div className={s.product}>
      <div
        className={s.product__image}
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
      <div className={s.product__info}>
        <div className={s.product__title}>
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer">
              {product.title}
              <FontAwesomeIcon icon={faExternalLinkAlt} />
            </a>
          ) : (
            <span>{product.title}</span>
          )}
        </div>
        {variant && (
          <div
            className={classNames(s.product__variant, {
              [s.product__variant_unavailable]: !variant.availableForSale,
            })}
          >
            <strong>Variant:</strong>
            &nbsp;
            {variant.title}
            {variantMeta(variant).map((label) => (
              <span key={label} className={s.product__variant_option}>
                {label}
              </span>
            ))}
          </div>
        )}
        <div className={s.product__description}>{product.description}</div>
        {product.productType && (
          <div className={s.product__producttype}>
            <strong>Product type:</strong>
            &nbsp;
            {product.productType}
          </div>
        )}
        <div className={s.product__price}>
          <strong>Price:</strong>
          &nbsp;
          {variant ? (
            <Price {...variant.price} />
          ) : (
            <ProductPrice product={product} />
          )}
        </div>
      </div>
    </div>
  );
}
