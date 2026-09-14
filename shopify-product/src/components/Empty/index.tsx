import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { RenderFieldExtensionCtx } from 'datocms-plugin-sdk';
import { Button, useCtx } from 'datocms-react-ui';
import type { SelectionKind } from '../../utils/fieldParameters';
import type { Product, ProductVariant } from '../../utils/ShopifyClient';
import s from './styles.module.css';

export type EmptyProps = {
  selection: SelectionKind;
  onSelect: (picked: Product | ProductVariant) => void;
};

const LABELS: Record<SelectionKind, { empty: string; browse: string }> = {
  product: {
    empty: 'No product selected!',
    browse: 'Browse Shopify products',
  },
  variant: {
    empty: 'No product variant selected!',
    browse: 'Browse Shopify product variants',
  },
};

export default function Empty({ selection, onSelect }: EmptyProps) {
  const ctx = useCtx<RenderFieldExtensionCtx>();
  const labels = LABELS[selection];

  const handleOpenModal = async () => {
    const picked = (await ctx.openModal({
      id: 'browseProducts',
      title: labels.browse,
      width: 'xl',
      parameters: { selection },
    })) as Product | ProductVariant | null;

    if (picked) {
      onSelect(picked);
    }
  };

  return (
    <div className={s.empty}>
      <div className={s.empty__label}>{labels.empty}</div>
      <Button
        onClick={handleOpenModal}
        buttonSize="s"
        leftIcon={<FontAwesomeIcon icon={faSearch} />}
      >
        {labels.browse}
      </Button>
    </div>
  );
}
