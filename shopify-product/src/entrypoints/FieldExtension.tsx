import type { RenderFieldExtensionCtx } from 'datocms-plugin-sdk';
import { Canvas } from 'datocms-react-ui';
import get from 'lodash-es/get';
import { useMemo } from 'react';
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
  const { selection: selectionKind, productStringValue } =
    normalizeFieldParameters(ctx.parameters);
  const rawValue = get(ctx.formValues, ctx.fieldPath);

  // Memoized on primitives: `ctx` is rebuilt on every SDK update, and a
  // stable selection lets `Value` fetch only when the stored value changes.
  const selection = useMemo(
    () =>
      selectionFromFieldValue(rawValue, fieldType, {
        paramsVersion: '1',
        selection: selectionKind,
        productStringValue,
      }),
    [rawValue, fieldType, selectionKind, productStringValue],
  );

  const handleSelect = (picked: Product | ProductVariant) => {
    ctx.setFieldValue(
      ctx.fieldPath,
      fieldValueFor(picked, fieldType, {
        paramsVersion: '1',
        selection: selectionKind,
        productStringValue,
      }),
    );
  };

  const handleReset = () => {
    ctx.setFieldValue(ctx.fieldPath, null);
  };

  return (
    <Canvas ctx={ctx}>
      {selection ? (
        <Value selection={selection} onReset={handleReset} />
      ) : (
        <Empty selection={selectionKind} onSelect={handleSelect} />
      )}
    </Canvas>
  );
}
