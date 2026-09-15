import type { RenderManualFieldExtensionConfigScreenCtx } from 'datocms-plugin-sdk';
import { Canvas, Form, SelectField } from 'datocms-react-ui';
import {
  type FieldParameters,
  normalizeFieldParameters,
  type ProductStringValue,
  type SelectionKind,
} from '../utils/fieldParameters';
import {
  findOption,
  isOption,
  PRODUCT_STRING_VALUE_OPTIONS,
  SELECTION_OPTIONS,
} from '../utils/selectOptions';

type Props = {
  ctx: RenderManualFieldExtensionConfigScreenCtx;
};

function errorMessage(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function storedValueHint(isStringField: boolean, selection: SelectionKind) {
  if (!isStringField) {
    return 'JSON fields store the full product or variant object as returned by Shopify.';
  }

  if (selection === 'variant') {
    return 'Single-line fields store the numeric variant ID (the gid://shopify/ProductVariant/ prefix is stripped).';
  }

  return undefined;
}

export default function FieldConfigScreen({ ctx }: Props) {
  const parameters = normalizeFieldParameters(ctx.parameters);
  const isStringField = ctx.pendingField.attributes.field_type === 'string';
  const hint = storedValueHint(isStringField, parameters.selection);

  const updateParameters = (patch: Partial<FieldParameters>) => {
    void ctx.setParameters({ ...parameters, ...patch });
  };

  return (
    <Canvas ctx={ctx}>
      <Form>
        <SelectField
          id="selection"
          name="selection"
          label="Editors can pick"
          hint={hint}
          required
          value={findOption(SELECTION_OPTIONS, parameters.selection)}
          onChange={(value) => {
            if (isOption<SelectionKind>(value)) {
              updateParameters({ selection: value.value });
            }
          }}
          error={errorMessage(ctx.errors.selection)}
          selectInputProps={{
            isMulti: false,
            options: SELECTION_OPTIONS,
          }}
        />

        {isStringField && parameters.selection === 'product' && (
          <SelectField
            id="productStringValue"
            name="productStringValue"
            label="Value stored in the field"
            hint="The product ID is the numeric part of the Shopify GID (the gid://shopify/Product/ prefix is stripped). Changing this does not rewrite values already saved; stored handles keep resolving."
            required
            value={findOption(
              PRODUCT_STRING_VALUE_OPTIONS,
              parameters.productStringValue,
            )}
            onChange={(value) => {
              if (isOption<ProductStringValue>(value)) {
                updateParameters({ productStringValue: value.value });
              }
            }}
            error={errorMessage(ctx.errors.productStringValue)}
            selectInputProps={{
              isMulti: false,
              options: PRODUCT_STRING_VALUE_OPTIONS,
            }}
          />
        )}
      </Form>
    </Canvas>
  );
}
