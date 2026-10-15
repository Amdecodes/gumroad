import { ChevronDown, ChevronUp, Envelope, Plus, Trash } from "@boxicons/react";
import * as React from "react";

import { useTranslate } from "$app/utils/i18n";

import { Button } from "$app/components/Button";
import { TagInput } from "$app/components/TagInput";
import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { Placeholder } from "$app/components/ui/Placeholder";
import { Row, RowActions, RowContent, RowDetails, Rows } from "$app/components/ui/Rows";

type ProductLevelSupportEmail = {
  email: string;
  product_ids: string[];
};

type Product = {
  id: string;
  name: string;
};

const AddProductLevelSupportEmailButton = React.memo(({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslate();
  return (
    <Button color="primary" onClick={onClick}>
      <Plus className="size-5" />
      {t("seller.settings.main.add_product_specific_email")}
    </Button>
  );
});

AddProductLevelSupportEmailButton.displayName = "AddProductLevelSupportEmailButton";

const ProductLevelSupportEmailRow = React.memo(
  ({
    index,
    supportEmail,
    availableProducts,
    isDisabled,
    onUpdate,
    onRemove,
  }: {
    index: number;
    supportEmail: ProductLevelSupportEmail;
    availableProducts: { id: string; label: string }[];
    isDisabled?: boolean;
    onUpdate: (index: number, email: ProductLevelSupportEmail) => void;
    onRemove: (index: number) => void;
  }) => {
    const { t } = useTranslate();
    const uid = React.useId();
    const [expanded, setExpanded] = React.useState(!supportEmail.email);

    const handleEmailChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(index, { ...supportEmail, email: evt.target.value });
    };

    const handleProductIdsChange = (product_ids: string[]) => {
      onUpdate(index, { ...supportEmail, product_ids });
    };

    const handleToggleExpandedState = () => setExpanded((prev) => !prev);
    const handleRemove = () => onRemove(index);

    return (
      <Row role="listitem">
        <RowContent>
          <Envelope pack="filled" className="type-icon size-5" />
          <div className="ml-1">
            <h4>{supportEmail.email || t("seller.settings.main.no_email_set")}</h4>
            <span>{t("seller.settings.main.products_count", { count: supportEmail.product_ids.length })}</span>
          </div>
        </RowContent>
        <RowActions>
          <Button
            size="icon"
            onClick={handleToggleExpandedState}
            aria-label={t("seller.settings.main.edit_email_aria")}
          >
            {expanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
          </Button>
          <Button size="icon" onClick={handleRemove} aria-label={t("seller.settings.main.delete_email_aria")}>
            <Trash className="size-5" />
          </Button>
        </RowActions>
        {expanded ? (
          <RowDetails className="flex flex-col gap-4">
            <Fieldset>
              <Label htmlFor={`${uid}email`}>{t("seller.settings.main.email")}</Label>
              <Input
                id={`${uid}email`}
                type="email"
                value={supportEmail.email}
                disabled={isDisabled}
                required={supportEmail.product_ids.length > 0}
                onChange={handleEmailChange}
              />
              <FieldsetDescription>{t("seller.settings.main.reply_to_receipts_desc")}</FieldsetDescription>
            </Fieldset>
            <Fieldset>
              <FieldsetTitle>
                <Label htmlFor={`${uid}-products`}>{t("seller.products.field_products")}</Label>
              </FieldsetTitle>
              <TagInput
                inputId={`${uid}-products`}
                tagIds={supportEmail.product_ids}
                tagList={availableProducts}
                isDisabled={isDisabled}
                onChangeTagIds={handleProductIdsChange}
              />
            </Fieldset>
          </RowDetails>
        ) : null}
      </Row>
    );
  },
);

ProductLevelSupportEmailRow.displayName = "ProductLevelSupportEmailRow";

export const ProductLevelSupportEmailsForm = React.memo(
  ({
    productLevelSupportEmails,
    products,
    isDisabled = false,
    onChange,
  }: {
    productLevelSupportEmails: ProductLevelSupportEmail[];
    products: Product[];
    isDisabled?: boolean;
    onChange: (emails: ProductLevelSupportEmail[]) => void;
  }) => {
    const { t } = useTranslate();
    const productIdToEmail = React.useMemo(
      () =>
        productLevelSupportEmails.reduce((acc, supportEmail, index) => {
          supportEmail.product_ids.forEach((id) => {
            acc.set(id, index);
          });
          return acc;
        }, new Map<string, number>()),
      [productLevelSupportEmails],
    );
    const getAvailableProductsForIndex = (index: number) =>
      products
        .filter(({ id }) => productIdToEmail.get(id) === index || productIdToEmail.get(id) === undefined)
        .map(({ id, name }) => ({ id, label: name }));

    const handleAddEmail = () => onChange([...productLevelSupportEmails, { email: "", product_ids: [] }]);

    const handleUpdateEmail = (index: number, updatedEmail: ProductLevelSupportEmail) => {
      const newEmails = [...productLevelSupportEmails];
      newEmails[index] = updatedEmail;
      onChange(newEmails);
    };

    const handleRemoveEmail = (index: number) => {
      onChange(productLevelSupportEmails.filter((_, i) => i !== index));
    };

    if (productLevelSupportEmails.length === 0) {
      return (
        <Placeholder>
          <AddProductLevelSupportEmailButton onClick={handleAddEmail} />
          <div>{t("seller.settings.main.different_reply_to_desc")}</div>
        </Placeholder>
      );
    }

    return (
      <>
        <Rows role="list">
          {productLevelSupportEmails.map((supportEmail, index) => (
            <ProductLevelSupportEmailRow
              key={index}
              index={index}
              supportEmail={supportEmail}
              availableProducts={getAvailableProductsForIndex(index)}
              isDisabled={isDisabled}
              onUpdate={handleUpdateEmail}
              onRemove={handleRemoveEmail}
            />
          ))}
        </Rows>
        <AddProductLevelSupportEmailButton onClick={handleAddEmail} />
      </>
    );
  },
);

ProductLevelSupportEmailsForm.displayName = "ProductLevelSupportEmailsForm";
