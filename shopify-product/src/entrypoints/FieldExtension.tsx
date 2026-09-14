import type { RenderFieldExtensionCtx } from 'datocms-plugin-sdk';
import { Canvas } from 'datocms-react-ui';
import get from 'lodash-es/get';
import Empty from '../components/Empty';
import Value from '../components/Value';
import {
  type FieldParameters,
  normalizeFieldParameters,
} from '../utils/fieldParameters';
import {
  isProductVariant,
  type Product,
  type ProductVariant,
} from '../utils/ShopifyClient';
import { selectionFromFieldValue, toNumericId } from '../utils/shopifyIds';

type PropTypes = {
  ctx: RenderFieldExtensionCtx;
};

/** Value written to the field for the picked product or variant. */
function fieldValueFor(
  picked: Product | ProductVariant,
  fieldType: string,
  params: FieldParameters,
): string {
  if (fieldType === 'json') {
    return JSON.stringify(picked);
  }

  if (isProductVariant(picked)) {
    return toNumericId(picked.id);
  }

  return params.productStringValue === 'id'
    ? toNumericId(picked.id)
    : picked.handle;
}

export default function FieldExtension({ ctx }: PropTypes) {
  const fieldType = ctx.field.attributes.field_type;
  const params = normalizeFieldParameters(ctx.parameters);
  const rawValue = get(ctx.formValues, ctx.fieldPath);
  const selection = selectionFromFieldValue(rawValue, fieldType, params);

  const handleSelect = (picked: Product | ProductVariant) => {
    ctx.setFieldValue(ctx.fieldPath, fieldValueFor(picked, fieldType, params));
  };

  const handleReset = () => {
    ctx.setFieldValue(ctx.fieldPath, null);
  };

  return (
    <Canvas ctx={ctx}>
      {selection ? (
        <Value selection={selection} onReset={handleReset} />
      ) : (
        <Empty selection={params.selection} onSelect={handleSelect} />
      )}
    </Canvas>
  );
}
