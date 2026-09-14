import classNames from 'classnames';
import type { Product } from '../../utils/ShopifyClient';
import type { Status } from '../../utils/useStore';
import ListStatus from './ListStatus';
import s from './styles.module.css';

export type ProductListProps = {
  products: Product[] | null;
  status: Status;
  onSelect: (product: Product) => void;
};

export default function ProductList({
  products,
  status,
  onSelect,
}: ProductListProps) {
  return (
    <>
      {!!products?.length && (
        <div
          className={classNames(s.products, {
            [s.products__loading]: status === 'loading',
          })}
        >
          {products.map((product: Product) => (
            <button
              type="button"
              key={product.handle}
              onClick={() => onSelect(product)}
              className={s.product}
            >
              <div
                className={s.product__image}
                style={{
                  backgroundImage: `url(${product.previewImageUrl || product.imageUrl})`,
                }}
              />
              <div className={s.product__content}>
                <div className={s.product__title}>{product.title}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      <ListStatus
        status={status}
        isEmpty={!!products && products.length === 0}
        emptyMessage="No products found!"
      />
    </>
  );
}
