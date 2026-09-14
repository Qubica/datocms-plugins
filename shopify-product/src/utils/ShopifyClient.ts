import type { ValidConfig } from '../types';
import { toProductGid, toVariantGid } from './shopifyIds';

export type Product = {
  id: string;
  handle: string;
  description: string;
  title: string;
  productType: string;
  onlineStoreUrl: string;
  imageUrl: string;
  previewImageUrl: string;
  priceRange: {
    maxVariantPrice: PriceTypes;
    minVariantPrice: PriceTypes;
  };
  images: {
    edges: Array<{
      node: {
        src: string;
        previewSrc: string;
      };
    }>;
  };
};

export type PriceTypes = {
  amount: number;
  currencyCode: string;
};

export type SelectedOption = {
  name: string;
  value: string;
};

/** A product variant together with the product it belongs to. */
export type ProductVariant = {
  id: string;
  title: string;
  sku: string | null;
  availableForSale: boolean;
  selectedOptions: SelectedOption[];
  price: PriceTypes;
  imageUrl: string;
  product: Product;
};

export type Products = {
  edges: [{ node: Product }];
};

/** Narrows a picked object: variants carry their parent `product`. */
export function isProductVariant(
  picked: Product | ProductVariant,
): picked is ProductVariant {
  return 'product' in picked;
}

const productFragment = `
  id
  title
  handle
  description
  onlineStoreUrl
  availableForSale
  productType
  priceRange {
    maxVariantPrice {
      amount
      currencyCode
    }
    minVariantPrice {
      amount
      currencyCode
    }
  }
  images(first: 1) {
    edges {
      node {
        src
        previewSrc: transformedSrc(maxWidth: 200, maxHeight: 200)
      }
    }
  }
`;

const variantFragment = `
  id
  title
  sku
  availableForSale
  selectedOptions {
    name
    value
  }
  price {
    amount
    currencyCode
  }
  image {
    url
  }
`;

/** Shopify lists at most this many variants per product in the browse modal. */
export const MAX_VARIANTS_PER_PRODUCT = 100;

type RawProductNode = Omit<Product, 'imageUrl' | 'previewImageUrl'> & {
  images: {
    edges: Array<{ node: { src: string; previewSrc: string } }>;
  };
};

type RawVariantNode = Omit<ProductVariant, 'imageUrl' | 'product'> & {
  image: { url: string } | null;
};

type RawEdges<Node> = {
  edges: Array<{ node: Node }>;
};

const normalizeProduct = (product: RawProductNode): Product => {
  if (!product || typeof product !== 'object') {
    throw new Error('Invalid product');
  }

  return {
    ...product,
    imageUrl: product.images.edges[0]?.node.src || '',
    previewImageUrl:
      product.images.edges[0]?.node.previewSrc ||
      product.images.edges[0]?.node.src ||
      '',
  };
};

const normalizeProducts = (products: RawEdges<RawProductNode>): Product[] =>
  products.edges.map((edge) => normalizeProduct(edge.node));

const normalizeVariant = (
  variant: RawVariantNode | null,
  product: Product,
): ProductVariant => {
  if (
    !variant ||
    typeof variant !== 'object' ||
    typeof variant.id !== 'string'
  ) {
    throw new Error('Invalid variant');
  }

  const { image, ...rest } = variant;

  return {
    ...rest,
    imageUrl: image?.url || product.previewImageUrl || product.imageUrl,
    product,
  };
};

export default class ShopifyClient {
  storefrontAccessToken: string;
  shopifyDomain: string;

  constructor({
    storefrontAccessToken,
    shopifyDomain,
  }: Pick<ValidConfig, 'shopifyDomain' | 'storefrontAccessToken'>) {
    this.storefrontAccessToken = storefrontAccessToken;
    this.shopifyDomain = shopifyDomain;
  }

  async productsMatching(query: string): Promise<Product[]> {
    const response = await this.fetch({
      query: `
        query getProducts($query: String) {
            products(first: 10, query: $query) {
              edges {
                node {
                  ${productFragment}
                }
              }
          }
        }
      `,
      variables: { query: query || null },
    });
    return normalizeProducts(response.products);
  }

  async productByHandle(handle: string): Promise<Product> {
    const response = await this.fetch({
      query: `
        query getProduct($handle: String!) {
          product: productByHandle(handle: $handle) {
            ${productFragment}
          }
        }
      `,
      variables: { handle },
    });

    return normalizeProduct(response.product);
  }

  /** Looks a product up by its numeric ID or full `gid://shopify/Product/…`. */
  async productById(id: string): Promise<Product> {
    const response = await this.fetch({
      query: `
        query getProductById($id: ID!) {
          product(id: $id) {
            ${productFragment}
          }
        }
      `,
      variables: { id: toProductGid(id) },
    });

    return normalizeProduct(response.product);
  }

  /** Lists the first `MAX_VARIANTS_PER_PRODUCT` variants of a product. */
  async variantsOfProduct(handle: string): Promise<ProductVariant[]> {
    const response = await this.fetch({
      query: `
        query getProductVariants($handle: String!, $first: Int!) {
          product: productByHandle(handle: $handle) {
            ${productFragment}
            variants(first: $first) {
              edges {
                node {
                  ${variantFragment}
                }
              }
            }
          }
        }
      `,
      variables: { handle, first: MAX_VARIANTS_PER_PRODUCT },
    });

    if (!response.product) {
      throw new Error('Invalid product');
    }

    // Keep the raw variant list out of the product object so stored JSON
    // values only contain the selected variant, not all its siblings.
    const { variants, ...rawProduct } = response.product as RawProductNode & {
      variants: RawEdges<RawVariantNode>;
    };
    const product = normalizeProduct(rawProduct);

    return variants.edges.map((edge) => normalizeVariant(edge.node, product));
  }

  /** Looks a variant up by its numeric ID or full `gid://shopify/ProductVariant/…`. */
  async variantById(id: string): Promise<ProductVariant> {
    const response = await this.fetch({
      query: `
        query getVariant($id: ID!) {
          node(id: $id) {
            ... on ProductVariant {
              ${variantFragment}
              product {
                ${productFragment}
              }
            }
          }
        }
      `,
      variables: { id: toVariantGid(id) },
    });

    const node = response.node as
      | (RawVariantNode & { product: RawProductNode })
      | null;

    if (!node || typeof node.id !== 'string') {
      throw new Error('Invalid variant');
    }

    const { product, ...rawVariant } = node;

    return normalizeVariant(rawVariant, normalizeProduct(product));
  }

  async fetch(requestBody: {
    query: string;
    variables?: Record<string, unknown>;
  }) {
    const res = await fetch(
      `https://${this.shopifyDomain}.myshopify.com/api/graphql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': this.storefrontAccessToken,
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (res.status !== 200) {
      throw new Error(`Invalid status code: ${res.status}`);
    }

    const contentType = res.headers.get('content-type');

    if (!contentType?.includes('application/json')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const body = await res.json();

    return body.data;
  }
}
