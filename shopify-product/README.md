
# DatoCMS Shopify product plugin

A plugin that allows users to search and select Shopify products.

## Configuration

Please specify your Shopify Shop ID and Storefront access token on the plugin global settings. The Shop ID is the prefix of your `*.myshopify.com` domain — for example, if your shop is `foo-bar.myshopify.com`, enter `foo-bar`.

![Demo](https://raw.githubusercontent.com/datocms/plugins/master/shopify-product/docs/settings.png)

You can either hook this plugin manually to your Single-line and JSON fields, or have it auto-applied based on a regular expression matched against the field's API identifier (configured on the same settings screen).

### Field settings

When you hook the plugin to a field manually, the field's editor settings let you choose:

- **Editors can pick**: *Products* (default) or *Product variants*. In variant mode the browse modal lists matching products; clicking one reveals its variants (title, options, SKU and price) and clicking a variant selects it. Only the first 100 variants of a product are listed.
- **Value stored in the field** (single-line fields holding products): the *product handle* (default, e.g. `my-product`) or the *product ID*, the numeric part of Shopify's global ID (`gid://shopify/Product/1234567890` is stored as `1234567890`).

Single-line fields holding variants always store the numeric variant ID (`gid://shopify/ProductVariant/987654321` is stored as `987654321`), since variants have no handle.

Changing these settings does not rewrite values that are already saved, and values saved under a previous setting keep resolving: the plugin tries the configured lookup first and falls back to the other interpretation (handle or ID, product or variant) when Shopify returns nothing.

For fields the plugin is auto-applied to, the same two choices are configured once on the plugin settings screen ("Auto-applied fields let editors pick" and "Auto-applied single-line fields store").

If you hook it to a JSON field, it will save a JSON containing all the product's info. Like this:

```
{
  "id": "gid://shopify/Product/1234567890",
  "title": "My product",
  "handle": "my-product",
  "description": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed pharetra consequat diam. In metus risus, aliquam non massa tempus, gravida commodo orci.",
  "onlineStoreUrl": "https://graphql.myshopify.com/products/my-product",
  "productType": "T-Shirts",
  "priceRange": {
    "maxVariantPrice": {
      "amount": "40.0",
      "currencyCode": "CAD"
    },
    "minVariantPrice": {
      "amount": "40.0",
      "currencyCode": "CAD"
    }
  },
  "images": {
    "edges": [
      {
        "node": {
          "src": "https://cdn.shopify.com/s/files/1/1312/0893/products/001_39681e15-ce94-48ca-830f-980b11868856.jpg?v=1491851133",
          "previewSrc": "https://cdn.shopify.com/s/files/1/1312/0893/products/001_39681e15-ce94-48ca-830f-980b11868856_200x200.jpg?v=1491851133"
        }
      }
    ]
  },
  "imageUrl": "https://cdn.shopify.com/s/files/1/1312/0893/products/001_39681e15-ce94-48ca-830f-980b11868856.jpg?v=1491851133",
  "previewImageUrl": "https://cdn.shopify.com/s/files/1/1312/0893/products/001_39681e15-ce94-48ca-830f-980b11868856_200x200.jpg?v=1491851133"
}
```

When the field is configured for variants, the JSON contains the variant's info plus its product under `product`:

```
{
  "id": "gid://shopify/ProductVariant/987654321",
  "title": "Small / Red",
  "sku": "TS-S-RED",
  "availableForSale": true,
  "selectedOptions": [
    { "name": "Size", "value": "Small" },
    { "name": "Color", "value": "Red" }
  ],
  "price": {
    "amount": "40.0",
    "currencyCode": "CAD"
  },
  "imageUrl": "https://cdn.shopify.com/s/files/1/1312/0893/products/001_39681e15-ce94-48ca-830f-980b11868856.jpg?v=1491851133",
  "product": {
    "id": "gid://shopify/Product/1234567890",
    "title": "My product",
    "handle": "my-product",
    "...": "same fields as the product JSON above"
  }
}
```

## Obtain a Shopify API key

To request a Storefront API access token follow [these instructions](https://www.shopify.com/partners/blog/storefront-api-learning-kit).

Remember to give products read permissions.
![Demo](https://raw.githubusercontent.com/datocms/plugins/master/shopify-product/docs/shopify-storefront-key.png)

## Changelog

### 1.1.0

- Single-line fields can store the numeric product ID instead of the handle. This is a per-field setting in the field's editor configuration; auto-applied fields take their default from the plugin settings screen.
- Editors can select product variants: the browse modal expands a product into its variants. Single-line fields store the numeric variant ID, JSON fields the variant object including its product.
- Plugin settings migrate to `paramsVersion: '3'` automatically on boot.

### 1.0.16
- Fixed minor typo

### 1.0.10

- New selections save full-size `imageUrl` plus `previewImageUrl` for the 200x200 preview. Existing JSON field values are not rewritten; reselect products or update stored JSON to refresh old `_200x200` `imageUrl` values.
