/**
 * Per-field parameters of the "Shopify Product" field extension.
 *
 * They are stored on the field's appearance (`ctx.parameters`) and decide what
 * editors can pick (products or product variants) and, for single-line string
 * fields holding a product, whether the handle or the numeric product ID is
 * written. Variants have no handle, so variant fields always store the numeric
 * variant ID. JSON fields always store the full selected object.
 *
 * Fields installed before these parameters existed have an empty parameters
 * object; `normalizeFieldParameters` maps that (and anything invalid) to the
 * historical behaviour: products, stored by handle.
 */

export type SelectionKind = 'product' | 'variant';
export type ProductStringValue = 'handle' | 'id';

export const SELECTION_KINDS: SelectionKind[] = ['product', 'variant'];
export const PRODUCT_STRING_VALUES: ProductStringValue[] = ['handle', 'id'];

export type FieldParameters = {
  paramsVersion: '1';
  /** What the editor picks in the browse modal. */
  selection: SelectionKind;
  /** Value written to single-line fields when `selection` is `product`. */
  productStringValue: ProductStringValue;
};

export const DEFAULT_FIELD_PARAMETERS: FieldParameters = {
  paramsVersion: '1',
  selection: 'product',
  productStringValue: 'handle',
};

export function isSelectionKind(value: unknown): value is SelectionKind {
  return SELECTION_KINDS.includes(value as SelectionKind);
}

export function isProductStringValue(
  value: unknown,
): value is ProductStringValue {
  return PRODUCT_STRING_VALUES.includes(value as ProductStringValue);
}

/** Maps untyped field parameters to a complete, valid `FieldParameters`. */
export function normalizeFieldParameters(
  raw: Record<string, unknown> | null | undefined,
): FieldParameters {
  const selection = raw?.selection;
  const productStringValue = raw?.productStringValue;

  return {
    paramsVersion: '1',
    selection: isSelectionKind(selection)
      ? selection
      : DEFAULT_FIELD_PARAMETERS.selection,
    productStringValue: isProductStringValue(productStringValue)
      ? productStringValue
      : DEFAULT_FIELD_PARAMETERS.productStringValue,
  };
}

/**
 * Validation used by `validateManualFieldExtensionParameters`. An empty
 * parameters object is valid (defaults apply); only present-but-invalid
 * values produce errors.
 */
export function validateFieldParameters(
  raw: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (raw.selection !== undefined && !isSelectionKind(raw.selection)) {
    errors.selection =
      'Choose whether editors pick products or product variants.';
  }

  if (
    raw.productStringValue !== undefined &&
    !isProductStringValue(raw.productStringValue)
  ) {
    errors.productStringValue =
      'Choose whether to store the product handle or the product ID.';
  }

  return errors;
}
