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

/** How to look a product up on Shopify. */
export type ProductLookup = { by: 'handle' | 'id'; value: string };

/** What a field currently references, derived from its stored value. */
export type FieldSelection =
  | { kind: 'product'; lookup: ProductLookup }
  | { kind: 'variant'; id: string };

/**
 * Cache key for the products store. Handles are used as-is so search results
 * (always keyed by handle) share entries with handle lookups; ID lookups get a
 * distinct namespace.
 */
export function productLookupCacheKey(lookup: ProductLookup): string {
  return lookup.by === 'id' ? `id:${lookup.value}` : lookup.value;
}

function looksLikeId(value: string): boolean {
  return NUMERIC_PATTERN.test(value) || GID_PATTERN.test(value);
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

function kindFromGid(id: string, fallback: FieldParameters['selection']) {
  if (id.startsWith(VARIANT_GID_PREFIX)) {
    return 'variant';
  }

  if (id.startsWith(PRODUCT_GID_PREFIX)) {
    return 'product';
  }

  return fallback;
}

function selectionFromJson(
  rawValue: string,
  params: FieldParameters,
): FieldSelection | null {
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

  // Stored JSON objects carry a full GID, so the object itself tells us
  // whether it is a product or a variant regardless of the current setting.
  if (kindFromGid(id, params.selection) === 'variant') {
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
    return selectionFromJson(rawValue, params);
  }

  if (fieldType !== 'string') {
    return null;
  }

  if (params.selection === 'variant') {
    return { kind: 'variant', id: toNumericId(rawValue) };
  }

  return {
    kind: 'product',
    lookup: resolveProductLookup(rawValue, params.productStringValue),
  };
}
