import * as React from "react";

import { useTranslate } from "$app/hooks/useTranslate";

import { NumberInput } from "$app/components/NumberInput";
import { Fieldset } from "$app/components/ui/Fieldset";
import { FormSection } from "$app/components/ui/FormSection";
import { Input } from "$app/components/ui/Input";
import { InputGroup } from "$app/components/ui/InputGroup";
import { Label } from "$app/components/ui/Label";
import { Switch } from "$app/components/ui/Switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";

export type AffiliateProduct = {
  id: number;
  name: string;
  enabled: boolean;
  fee_percent: number | null;
  destination_url: string | null;
  referral_url: string;
};

export type AffiliateFormData = {
  email: string;
  products: AffiliateProduct[];
  fee_percent: number | null;
  apply_to_all_products: boolean;
  destination_url: string | null;
};

type Props = {
  data: AffiliateFormData;
  errors: Record<string, string>;
  processing: boolean;
  applyToAllProducts: boolean;
  uid: string;
  emailField: React.ReactNode;
  headerText: string;
  onToggleAllProducts: (checked: boolean) => void;
  onUpdateFeePercent: (value: number | null) => void;
  onUpdateDestinationUrl: (value: string) => void;
  onUpdateProduct: (productId: number, updates: Partial<AffiliateProduct>) => void;
};

export const AffiliateForm = ({
  data,
  errors,
  processing,
  applyToAllProducts,
  uid,
  emailField,
  headerText,
  onToggleAllProducts,
  onUpdateFeePercent,
  onUpdateDestinationUrl,
  onUpdateProduct,
}: Props) => {
  const { t } = useTranslate();
  return (
    <FormSection
      header={
        <span>
          {headerText}{" "}
          <a href="/help/article/333-affiliates-on-gumroad" target="_blank" rel="noreferrer">
            {t("actions.learn_more")}
          </a>
        </span>
      }
    >
      {emailField}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("seller.affiliates.col_enable")}</TableHead>
            <TableHead>{t("seller.affiliates.col_product")}</TableHead>
            <TableHead>{t("seller.affiliates.col_commission")}</TableHead>
            <TableHead>
              <a href="/help/article/333-affiliates-on-gumroad" target="_blank" rel="noreferrer">
                {t("seller.affiliates.col_destination_url")}
              </a>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>
              <Switch
                id={`${uid}enableAllProducts`}
                checked={applyToAllProducts}
                onChange={(e) => onToggleAllProducts(e.target.checked)}
                aria-label={t("seller.affiliates.enable_all_products_aria")}
              />
            </TableCell>
            <TableCell>
              <Label htmlFor={`${uid}enableAllProducts`}>{t("seller.affiliates.all_products")}</Label>
            </TableCell>
            <TableCell>
              <Fieldset state={errors["affiliate.fee_percent"] ? "danger" : undefined}>
                <NumberInput onChange={(value) => onUpdateFeePercent(value)} value={data.fee_percent}>
                  {(inputProps) => (
                    <InputGroup disabled={processing || !applyToAllProducts}>
                      <Input
                        type="text"
                        autoComplete="off"
                        aria-label={t("seller.affiliates.col_commission")}
                        disabled={processing || !applyToAllProducts}
                        {...inputProps}
                      />
                      <div className="pill">%</div>
                    </InputGroup>
                  )}
                </NumberInput>
              </Fieldset>
            </TableCell>
            <TableCell>
              <Fieldset state={errors["affiliate.destination_url"] ? "danger" : undefined}>
                <Input
                  type="url"
                  value={data.destination_url || ""}
                  placeholder="https://link.com"
                  onChange={(e) => onUpdateDestinationUrl(e.target.value)}
                  disabled={processing || !applyToAllProducts}
                />
              </Fieldset>
            </TableCell>
          </TableRow>
          {data.products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <Switch
                  checked={product.enabled}
                  onChange={(e) => onUpdateProduct(product.id, { enabled: e.target.checked })}
                  disabled={processing}
                  aria-label={t("seller.affiliates.enable_product_aria")}
                />
              </TableCell>
              <TableCell>{product.name}</TableCell>
              <TableCell>
                <NumberInput
                  onChange={(value) => onUpdateProduct(product.id, { fee_percent: value })}
                  value={product.fee_percent}
                >
                  {(inputProps) => (
                    <InputGroup disabled={processing || !product.enabled}>
                      <Input
                        type="text"
                        autoComplete="off"
                        aria-label={t("seller.affiliates.col_commission")}
                        disabled={processing || !product.enabled}
                        {...inputProps}
                      />
                      <div className="pill">%</div>
                    </InputGroup>
                  )}
                </NumberInput>
              </TableCell>
              <TableCell>
                <Input
                  type="text"
                  placeholder="https://link.com"
                  value={product.destination_url || ""}
                  onChange={(e) => onUpdateProduct(product.id, { destination_url: e.target.value })}
                  disabled={processing || !product.enabled}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </FormSection>
  );
};
