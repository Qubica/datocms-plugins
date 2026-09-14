/** Option lists shared by the plugin and field configuration screens. */

import type { ProductStringValue, SelectionKind } from './fieldParameters';

export type Option<Value extends string> = {
  value: Value;
  label: string;
};

export const SELECTION_OPTIONS: Option<SelectionKind>[] = [
  { value: 'product', label: 'Products' },
  { value: 'variant', label: 'Product variants' },
];

export const PRODUCT_STRING_VALUE_OPTIONS: Option<ProductStringValue>[] = [
  { value: 'handle', label: 'Product handle (e.g. my-product)' },
  { value: 'id', label: 'Product ID (e.g. 1234567890)' },
];

export function isOption<Value extends string>(
  value: unknown,
): value is Option<Value> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof value.value === 'string'
  );
}

export function findOption<Value extends string>(
  options: Option<Value>[],
  value: unknown,
): Option<Value> | undefined {
  return options.find((option) => option.value === value);
}
