/**
 * Helpers around Shopify global IDs (GIDs) and the values this plugin stores.
 *
 * Shopify's Storefront API identifies objects with GIDs such as
 * `gid://shopify/Product/1234567890` or `gid://shopify/ProductVariant/987`.
 * When configured to store IDs, this plugin writes only the numeric part to
 * the field and re-adds the prefix before querying Shopify.
 */

import type { FieldParameters, ProductStringValue } from './fieldParameters';

export const PRODUCT_GID_PREFIX = 'gid://shopify/Product/';
export const VARIANT_GID_PREFIX = 'gid://shopify/ProductVariant/';

const GID_PATTERN = /^gid:\/\/shopify\/[A-Za-z]+\/(\d+)$/;
const NUMERIC_PATTERN = /^\d+$/;

/** `gid://shopify/Product/123` -> `123`; other values are returned trimmed. */
export function toNumericId(value: string): string {
  const trimmed = value.trim();
  const match = GID_PATTERN.exec(trimmed);
  return match ? match[1] : trimmed;
}

export function toProductGid(id: string): string {
  return id.startsWith('gid://') ? id : `${PRODUCT_GID_PREFIX}${id}`;
}

export function toVariantGid(id: string): string {
  return id.startsWith('gid://') ? id : `${VARIANT_GID_PREFIX}${id}`;
}

export function isNumericId(value: string): boolean {
  return NUMERIC_PATTERN.test(value);
}

/** How to look a product up on Shopify. */
export type ProductLookup = { by: 'handle' | 'id'; value: string };

/** What a field currently references, derived from its stored value. */
export type FieldSelection =
  | { kind: 'product'; lookup: ProductLookup }
  | { kind: 'variant'; id: string };

/**
 * Cache key of a selection in the store. Handles are used as-is so search
 * results (always keyed by handle) share entries with handle lookups; ID and
 * variant lookups get their own namespaces.
 */
export function selectionKey(selection: FieldSelection): string {
  if (selection.kind === 'variant') {
    return `variant:${selection.id}`;
  }

  return selection.lookup.by === 'id'
    ? `id:${selection.lookup.value}`
    : selection.lookup.value;
}

/**
 * Selections to try, in order, when resolving a stored value. The one derived
 * from the field settings comes first; the alternatives cover values saved
 * under a different setting: numeric handles read as IDs, IDs saved before the
 * field was switched back to handles, and product IDs in a field that now
 * holds variants.
 */
export function lookupCandidates(selection: FieldSelection): FieldSelection[] {
  if (selection.kind === 'variant') {
    return [
      selection,
      { kind: 'product', lookup: { by: 'id', value: selection.id } },
    ];
  }

  const { by, value } = selection.lookup;

  if (by === 'id') {
    return [selection, { kind: 'product', lookup: { by: 'handle', value } }];
  }

  if (isNumericId(value)) {
    return [selection, { kind: 'product', lookup: { by: 'id', value } }];
  }

  return [selection];
}

function looksLikeId(value: string): boolean {
  return isNumericId(value) || GID_PATTERN.test(value);
}

/**
 * Decides how to resolve a single-line field value holding a product.
 * In `id` mode, values that are not numeric (or a GID) fall back to a handle
 * lookup so content saved before the setting was switched keeps rendering.
 */
export function resolveProductLookup(
  rawValue: string,
  mode: ProductStringValue,
): ProductLookup {
  const value = rawValue.trim();

  if (mode === 'id' && looksLikeId(value)) {
    return { by: 'id', value: toNumericId(value) };
  }

  return { by: 'handle', value };
}

/**
 * Classifies a single-line field value. A GID prefix is authoritative, a
 * numeric value follows the field settings, anything else is a handle (which
 * can only denote a product, whatever the field is configured for).
 */
function selectionFromString(
  rawValue: string,
  params: FieldParameters,
): FieldSelection {
  const value = rawValue.trim();

  if (value.startsWith(VARIANT_GID_PREFIX)) {
    return { kind: 'variant', id: toNumericId(value) };
  }

  if (value.startsWith(PRODUCT_GID_PREFIX)) {
    return { kind: 'product', lookup: { by: 'id', value: toNumericId(value) } };
  }

  if (params.selection === 'variant' && isNumericId(value)) {
    return { kind: 'variant', id: value };
  }

  return {
    kind: 'product',
    lookup: resolveProductLookup(value, params.productStringValue),
  };
}

/**
 * Classifies a stored JSON object by its shape: variant objects written by
 * this plugin always nest their `product`, product objects never do. The
 * field settings play no part, so switching them never misreads old values.
 */
function selectionFromJson(rawValue: string): FieldSelection | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const handle = typeof record.handle === 'string' ? record.handle : '';
  const isVariant =
    (typeof record.product === 'object' && record.product !== null) ||
    id.startsWith(VARIANT_GID_PREFIX);

  if (isVariant) {
    return id ? { kind: 'variant', id: toNumericId(id) } : null;
  }

  if (handle) {
    return { kind: 'product', lookup: { by: 'handle', value: handle } };
  }

  return id
    ? { kind: 'product', lookup: { by: 'id', value: toNumericId(id) } }
    : null;
}

/**
 * Derives what a field references from its raw stored value, the field type
 * and the field parameters. Returns `null` when nothing is selected.
 */
export function selectionFromFieldValue(
  rawValue: unknown,
  fieldType: string,
  params: FieldParameters,
): FieldSelection | null {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    return null;
  }

  if (fieldType === 'json') {
    return selectionFromJson(rawValue);
  }

  return fieldType === 'string' ? selectionFromString(rawValue, params) : null;
}
