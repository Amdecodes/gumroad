import { Link, useForm, usePage } from "@inertiajs/react";
import * as React from "react";
import typia from "typia";

import { SelfServeAffiliateProduct } from "$app/data/affiliates";
import { useTranslate } from "$app/hooks/useTranslate";
import { isUrlValid } from "$app/utils/url";

import { Button } from "$app/components/Button";
import { CopyToClipboard } from "$app/components/CopyToClipboard";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import { NavigationButtonInertia } from "$app/components/NavigationButton";
import { NumberInput } from "$app/components/NumberInput";
import { showAlert } from "$app/components/server-components/Alert";
import { ToggleSettingRow } from "$app/components/SettingRow";
import { Alert } from "$app/components/ui/Alert";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { FormSection } from "$app/components/ui/FormSection";
import { Input } from "$app/components/ui/Input";
import { InputGroup } from "$app/components/ui/InputGroup";
import { Label } from "$app/components/ui/Label";
import { LinkButton } from "$app/components/ui/LinkButton";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Placeholder, PlaceholderImage } from "$app/components/ui/Placeholder";
import { Switch } from "$app/components/ui/Switch";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";
import { Tabs, Tab } from "$app/components/ui/Tabs";
import { WithTooltip } from "$app/components/WithTooltip";

import placeholderImage from "$assets/images/placeholders/affiliate-signup-form.webp";

type InvalidProductAttrs = Set<"commission" | "destination_url">;

type Props = {
  creator_subdomain: string;
  products: SelfServeAffiliateProduct[];
  disable_global_affiliate: boolean;
  global_affiliate_percentage: number;
  affiliates_disabled_reason: string | null;
};

const MIN_FEE_PERCENT = 1;
const MAX_FEE_PERCENT = 75;
const isValidFeePercent = (fee: number | null) => fee !== null && fee >= MIN_FEE_PERCENT && fee <= MAX_FEE_PERCENT;
const validateProduct = (product: SelfServeAffiliateProduct): InvalidProductAttrs => {
  const invalidAttributes: InvalidProductAttrs = new Set();
  const { fee_percent, destination_url, enabled } = product;

  if ((enabled && !fee_percent) || (fee_percent && !isValidFeePercent(fee_percent)))
    invalidAttributes.add("commission");
  if (destination_url && destination_url !== "" && !isUrlValid(destination_url))
    invalidAttributes.add("destination_url");

  return invalidAttributes;
};

const AffiliatesNavigation = () => {
  const { t } = useTranslate();
  return (
    <Tabs>
      <Tab asChild isSelected={false}>
        <Link href={typia.assert<string>(Routes.affiliates_path())}>{t("seller.affiliates.affiliates_tab")}</Link>
      </Tab>
      <Tab asChild isSelected>
        <Link href={typia.assert<string>(Routes.onboarding_affiliates_path())}>
          {t("seller.affiliates.affiliate_signup_form_tab")}
        </Link>
      </Tab>
    </Tabs>
  );
};

export default function AffiliatesOnboarding() {
  const { t } = useTranslate();
  const props = typia.assert<Props>(usePage().props);
  const loggedInUser = useLoggedInUser();

  const { data, setData, patch, processing } = useForm({
    products: props.products,
    disable_global_affiliate: props.disable_global_affiliate,
  });

  const enableAffiliateLink = data.products.some(
    ({ enabled, fee_percent }) => enabled && isValidFeePercent(fee_percent),
  );

  const affiliateRequestUrl = Routes.custom_domain_new_affiliate_request_url({ host: props.creator_subdomain });

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();

    const hasErrors = data.products.some((product) => validateProduct(product).size > 0);

    if (hasErrors) {
      showAlert(t("seller.affiliates.page_has_errors_alert"), "error");
      return;
    }

    patch(Routes.affiliate_requests_onboarding_form_path());
  };

  const onToggleDisableGlobalAffiliate = (value: boolean) => {
    setData("disable_global_affiliate", value);
  };

  const onUpdateProductLink = (index: number, updatedValues: Partial<SelfServeAffiliateProduct>) => {
    setData(
      "products",
      data.products.map((product, i) => (i === index ? { ...product, ...updatedValues } : product)),
    );
  };

  return (
    <div>
      <PageHeader
        title={t("seller.affiliates.onboarding_title")}
        actions={
          <>
            <WithTooltip position="bottom" tip={props.affiliates_disabled_reason}>
              <NavigationButtonInertia
                href={typia.assert<string>(Routes.new_affiliate_path())}
                disabled={!loggedInUser?.policies.direct_affiliate.create || props.affiliates_disabled_reason !== null}
              >
                {t("seller.affiliates.add_affiliate")}
              </NavigationButtonInertia>
            </WithTooltip>
            <Button
              onClick={handleSaveChanges}
              disabled={processing || !loggedInUser?.policies.affiliate_requests_onboarding_form.update}
              color="accent"
            >
              {processing ? t("seller.affiliates.saving") : t("seller.affiliates.onboarding_save_changes")}
            </Button>
          </>
        }
      >
        <AffiliatesNavigation />
      </PageHeader>
      {data.products.length === 0 ? (
        <section className="p-4! md:p-8!">
          <Placeholder>
            <PlaceholderImage src={placeholderImage} />
            <h2>{t("seller.affiliates.almost_there")}</h2>
            {t("seller.affiliates.almost_there_desc")}
            <NavigationButtonInertia
              href={Routes.new_product_path()}
              color="accent"
              disabled={!loggedInUser?.policies.product.create}
            >
              {t("seller.affiliates.new_product")}
            </NavigationButtonInertia>
          </Placeholder>
        </section>
      ) : (
        <form onSubmit={handleSaveChanges}>
          <FormSection
            header={
              <>
                <h2>{t("seller.affiliates.affiliate_link_section")}</h2>
                <div>{t("seller.affiliates.affiliate_link_desc")}</div>
                <a href="/help/article/249-affiliate-faq" target="_blank" rel="noreferrer">
                  {t("actions.learn_more")}
                </a>
              </>
            }
          >
            <Fieldset>
              <FieldsetTitle>
                <Label htmlFor="affiliate-link">{t("seller.affiliates.your_affiliate_link")}</Label>
              </FieldsetTitle>
              <InputGroup disabled={!enableAffiliateLink}>
                <Input
                  type="text"
                  id="affiliate-link"
                  readOnly
                  disabled={!enableAffiliateLink}
                  defaultValue={affiliateRequestUrl}
                  className="truncate"
                />
                {enableAffiliateLink ? (
                  <CopyToClipboard text={affiliateRequestUrl}>
                    <LinkButton>{t("seller.affiliates.copy_link")}</LinkButton>
                  </CopyToClipboard>
                ) : null}
              </InputGroup>
              {enableAffiliateLink ? null : (
                <Alert variant="warning">{t("seller.affiliates.affiliate_link_warning")}</Alert>
              )}
            </Fieldset>
          </FormSection>
          <FormSection
            header={
              <>
                <h2>{t("seller.affiliates.affiliate_products_section")}</h2>
                <p>{t("seller.affiliates.affiliate_products_desc")}</p>
              </>
            }
          >
            <Table>
              <TableCaption>{t("seller.affiliates.enable_specific_products_caption")}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("seller.affiliates.col_enable")}</TableHead>
                  <TableHead>{t("seller.affiliates.col_product")}</TableHead>
                  <TableHead>{t("seller.affiliates.col_commission")}</TableHead>
                  <TableHead>{t("seller.affiliates.col_destination_url")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.products.map((product, index) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    disabled={!loggedInUser?.policies.affiliate_requests_onboarding_form.update}
                    onChange={(updatedValues) => onUpdateProductLink(index, updatedValues)}
                  />
                ))}
              </TableBody>
            </Table>
          </FormSection>
          <FormSection
            header={
              <>
                <h2>{t("seller.affiliates.global_affiliate_program")}</h2>
                <div>
                  {t("seller.affiliates.global_affiliate_program_desc", {
                    percent: props.global_affiliate_percentage,
                  })}
                </div>
                <a href="/help/article/249-affiliate-faq" target="_blank" rel="noreferrer">
                  {t("actions.learn_more")}
                </a>
              </>
            }
          >
            <Fieldset>
              <ToggleSettingRow
                label={t("seller.affiliates.opt_out_global_program")}
                value={data.disable_global_affiliate}
                onChange={onToggleDisableGlobalAffiliate}
              />
            </Fieldset>
          </FormSection>
        </form>
      )}
    </div>
  );
}

type ProductRowProps = {
  product: SelfServeAffiliateProduct;
  disabled: boolean;
  onChange: (value: Partial<SelfServeAffiliateProduct>) => void;
};

const ProductRow = ({ product, disabled, onChange }: ProductRowProps) => {
  const { t } = useTranslate();
  const invalidAttrs = validateProduct(product);
  const uid = React.useId();

  return (
    <TableRow>
      <TableCell>
        <Switch
          id={uid}
          checked={product.enabled}
          onChange={(evt) => onChange({ enabled: evt.target.checked })}
          aria-label={t("seller.affiliates.enable_product_aria")}
          disabled={disabled}
        />
      </TableCell>
      <TableCell>
        <Label htmlFor={uid}>{product.name}</Label>
      </TableCell>
      <TableCell>
        <Fieldset state={invalidAttrs.has("commission") ? "danger" : undefined}>
          <NumberInput onChange={(value) => onChange({ fee_percent: value ?? 0 })} value={product.fee_percent}>
            {(inputProps) => (
              <InputGroup disabled={disabled || !product.enabled}>
                <Input
                  type="text"
                  autoComplete="off"
                  aria-label={t("seller.affiliates.col_commission")}
                  disabled={disabled || !product.enabled}
                  {...inputProps}
                />
                <div className="pill">%</div>
              </InputGroup>
            )}
          </NumberInput>
        </Fieldset>
      </TableCell>
      <TableCell>
        <Fieldset state={invalidAttrs.has("destination_url") ? "danger" : undefined}>
          <Input
            type="text"
            aria-label="destination_url"
            disabled={disabled || !product.enabled}
            placeholder="https://link.com"
            value={product.destination_url || ""}
            onChange={(event) => onChange({ destination_url: event.target.value.trim() })}
          />
        </Fieldset>
      </TableCell>
    </TableRow>
  );
};
