import { Sparkle } from "@boxicons/react";
import * as React from "react";

import { COFFEE_CUSTOM_BUTTON_TEXT_OPTIONS, CUSTOM_BUTTON_TEXT_OPTIONS } from "$app/parsers/product";
import { t } from "$app/utils/i18n";
import { recurrenceIds, recurrenceLabels } from "$app/utils/recurringPricing";

import { CopyToClipboard } from "$app/components/CopyToClipboard";
import { useCurrentSeller } from "$app/components/CurrentSeller";
import CustomDomain from "$app/components/CustomDomain";
import { Layout, useProductUrl } from "$app/components/ProductEdit/Layout";
import { ProductPreview } from "$app/components/ProductEdit/ProductPreview";
import { AttributesEditor } from "$app/components/ProductEdit/ProductTab/AttributesEditor";
import { AvailabilityEditor } from "$app/components/ProductEdit/ProductTab/AvailabilityEditor";
import { BundleConversionNotice } from "$app/components/ProductEdit/ProductTab/BundleConversionNotice";
import { CallLimitationsEditor } from "$app/components/ProductEdit/ProductTab/CallLimitationsEditor";
import { CancellationDiscountSelector } from "$app/components/ProductEdit/ProductTab/CancellationDiscountSelector";
import { CircleIntegrationEditor } from "$app/components/ProductEdit/ProductTab/CircleIntegrationEditor";
import { CoverEditor } from "$app/components/ProductEdit/ProductTab/CoverEditor";
import { CustomButtonTextOptionInput } from "$app/components/ProductEdit/ProductTab/CustomButtonTextOptionInput";
import { CustomPermalinkInput } from "$app/components/ProductEdit/ProductTab/CustomPermalinkInput";
import { CustomSummaryInput } from "$app/components/ProductEdit/ProductTab/CustomSummaryInput";
import { DescriptionEditor, useImageUpload } from "$app/components/ProductEdit/ProductTab/DescriptionEditor";
import { DiscordIntegrationEditor } from "$app/components/ProductEdit/ProductTab/DiscordIntegrationEditor";
import { DurationEditor } from "$app/components/ProductEdit/ProductTab/DurationEditor";
import { DurationsEditor } from "$app/components/ProductEdit/ProductTab/DurationsEditor";
import { FreeTrialSelector } from "$app/components/ProductEdit/ProductTab/FreeTrialSelector";
import { GoogleCalendarIntegrationEditor } from "$app/components/ProductEdit/ProductTab/GoogleCalendarIntegrationEditor";
import { MaxPurchaseCountToggle } from "$app/components/ProductEdit/ProductTab/MaxPurchaseCountToggle";
import { PriceCheckerCard } from "$app/components/ProductEdit/ProductTab/PriceChecker";
import { PriceEditor } from "$app/components/ProductEdit/ProductTab/PriceEditor";
import { ShippingDestinationsEditor } from "$app/components/ProductEdit/ProductTab/ShippingDestinationsEditor";
import { SuggestedAmountsEditor } from "$app/components/ProductEdit/ProductTab/SuggestedAmountsEditor";
import { ThumbnailEditor } from "$app/components/ProductEdit/ProductTab/ThumbnailEditor";
import { TiersEditor } from "$app/components/ProductEdit/ProductTab/TiersEditor";
import { VersionsEditor } from "$app/components/ProductEdit/ProductTab/VersionsEditor";
import { RefundPolicySelector } from "$app/components/ProductEdit/RefundPolicy";
import { hasPaidVariantPricing, useProductEditContext } from "$app/components/ProductEdit/state";
import { ToggleSettingRow } from "$app/components/SettingRow";
import { TypeSafeOptionSelect } from "$app/components/TypeSafeOptionSelect";
import { Alert } from "$app/components/ui/Alert";
import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { LinkButton } from "$app/components/ui/LinkButton";
import { Switch } from "$app/components/ui/Switch";
import { Textarea } from "$app/components/ui/Textarea";

export const ProductTab = () => {
  const uid = React.useId();
  const currentSeller = useCurrentSeller();

  const {
    id,
    product,
    updateProduct,
    uniquePermalink,
    thumbnail: initialThumbnail,
    refundPolicies,
    currencyType,
    isPhysical,
    customDomainVerificationStatus,
    seller_refund_policy_enabled,
    cancellationDiscountsEnabled,
    priceCheckerEnabled,
    aiGenerated,
  } = useProductEditContext();
  const [initialProduct] = React.useState(product);

  const [thumbnail, setThumbnail] = React.useState(initialThumbnail);
  const [showAiNotification, setShowAiNotification] = React.useState(aiGenerated);

  const { isUploading, setImagesUploading } = useImageUpload();

  const [showRefundPolicyPreview, setShowRefundPolicyPreview] = React.useState(false);

  const isCoffee = product.native_type === "coffee";

  const url = useProductUrl();

  if (!currentSeller) return null;

  return (
    <Layout preview={<ProductPreview showRefundPolicyModal={showRefundPolicyPreview} />} isLoading={isUploading}>
      <div className="squished">
        <form>
          <section className="grid gap-8 p-4! md:p-8!">
            {showAiNotification ? (
              <Alert role="status" variant="accent">
                <div className="flex items-center gap-4">
                  <Sparkle className="size-5 text-lg" />
                  <div className="flex-1">
                    <strong>{t("seller.productEdit.ai_ready_title")}</strong> {t("seller.productEdit.ai_ready_desc")}
                  </div>
                  <LinkButton className="self-center" onClick={() => setShowAiNotification(false)}>
                    {t("seller.productEdit.close")}
                  </LinkButton>
                </div>
              </Alert>
            ) : null}
            <BundleConversionNotice />
            <Fieldset>
              <Label htmlFor={`${uid}-name`}>
                {isCoffee ? t("seller.productEdit.header") : t("seller.productEdit.name")}
              </Label>
              <Input
                id={`${uid}-name`}
                type="text"
                dir="auto"
                value={product.name}
                aria-describedby={`${uid}-name-description`}
                onChange={(evt) => updateProduct({ name: evt.target.value })}
              />
              <FieldsetDescription id={`${uid}-name-description`}>
                {t("seller.productEdit.name_description")}
              </FieldsetDescription>
            </Fieldset>
            {isCoffee ? (
              <>
                <Fieldset>
                  <Label htmlFor={`${uid}-body`}>{t("seller.productEdit.body")}</Label>
                  <Textarea
                    id={`${uid}-body`}
                    value={product.description}
                    placeholder={t("seller.productEdit.body_placeholder")}
                    onChange={(evt) => updateProduct({ description: evt.target.value, description_changed: true })}
                  />
                </Fieldset>
                <Fieldset>
                  <FieldsetTitle>
                    <Label htmlFor={`${uid}-url`}>{t("seller.productEdit.url")}</Label>
                    <CopyToClipboard text={url}>
                      <LinkButton className="font-normal">{t("seller.productEdit.copy_url")}</LinkButton>
                    </CopyToClipboard>
                  </FieldsetTitle>
                  <Input id={`${uid}-url`} type="text" value={url} disabled />
                </Fieldset>
              </>
            ) : (
              <>
                <DescriptionEditor
                  id={id}
                  initialDescription={initialProduct.description}
                  onChange={(description) => updateProduct({ description, description_changed: true })}
                  setImagesUploading={setImagesUploading}
                  publicFiles={product.public_files}
                  updatePublicFiles={(updater) => updateProduct((product) => updater(product.public_files))}
                />
                <CustomPermalinkInput
                  value={product.custom_permalink}
                  onChange={(value) => updateProduct({ custom_permalink: value })}
                  uniquePermalink={uniquePermalink}
                  url={url}
                />
              </>
            )}
          </section>
          {isCoffee ? (
            <>
              <section className="grid gap-8 border-t border-border p-4 md:p-8">
                <h2>{t("seller.productEdit.pricing_section")}</h2>
                <SuggestedAmountsEditor
                  versions={product.variants}
                  onChange={(variants) => updateProduct({ variants })}
                />
              </section>
              <section className="grid gap-8 border-t border-border p-4 md:p-8">
                <h2>{t("seller.productEdit.settings_section")}</h2>
                <CustomButtonTextOptionInput
                  value={product.custom_button_text_option}
                  onChange={(value) => updateProduct({ custom_button_text_option: value })}
                  options={COFFEE_CUSTOM_BUTTON_TEXT_OPTIONS}
                />
              </section>
            </>
          ) : (
            <>
              <CoverEditor
                covers={product.covers}
                setCovers={(covers) => updateProduct({ covers })}
                permalink={uniquePermalink}
              />
              <ThumbnailEditor
                covers={product.covers}
                thumbnail={thumbnail}
                setThumbnail={setThumbnail}
                permalink={uniquePermalink}
                nativeType={product.native_type}
              />
              <section className="grid gap-8 border-t border-border p-4 md:p-8">
                <h2>{t("seller.productEdit.product_info_section")}</h2>
                {product.native_type !== "membership" ? (
                  <CustomButtonTextOptionInput
                    value={product.custom_button_text_option}
                    onChange={(value) => updateProduct({ custom_button_text_option: value })}
                    options={CUSTOM_BUTTON_TEXT_OPTIONS}
                  />
                ) : null}
                <CustomSummaryInput
                  value={product.custom_summary}
                  onChange={(value) => updateProduct({ custom_summary: value })}
                />
                <AttributesEditor
                  customAttributes={product.custom_attributes}
                  setCustomAttributes={(custom_attributes) => updateProduct({ custom_attributes })}
                  fileAttributes={product.file_attributes}
                  setFileAttributes={(file_attributes) => updateProduct({ file_attributes })}
                />
              </section>
              <section className="grid gap-8 border-t border-border p-4 md:p-8">
                <h2>{t("seller.productEdit.integrations_section")}</h2>
                <Fieldset>
                  <ToggleSettingRow
                    label={t("seller.productEdit.community_chat_label")}
                    value={product.community_chat_enabled}
                    onChange={(newValue) => updateProduct({ community_chat_enabled: newValue })}
                    help={{
                      label: t("seller.productEdit.learn_more"),
                      url: "/help/article/347-gumroad-community",
                    }}
                  />
                  <CircleIntegrationEditor
                    integration={product.integrations.circle}
                    onChange={(newIntegration) =>
                      updateProduct({
                        integrations: {
                          ...product.integrations,
                          circle: newIntegration,
                        },
                      })
                    }
                  />
                  <DiscordIntegrationEditor
                    integration={product.integrations.discord}
                    onChange={(newIntegration) =>
                      updateProduct({
                        integrations: {
                          ...product.integrations,
                          discord: newIntegration,
                        },
                      })
                    }
                  />
                  {product.native_type === "call" ? (
                    <GoogleCalendarIntegrationEditor
                      integration={product.integrations.google_calendar}
                      onChange={(newIntegration) =>
                        updateProduct({
                          integrations: {
                            ...product.integrations,
                            google_calendar: newIntegration,
                          },
                        })
                      }
                    />
                  ) : null}
                </Fieldset>
              </section>
              {product.native_type === "membership" ? (
                <section className="grid gap-8 border-t border-border p-4 md:p-8">
                  <h2>{t("seller.productEdit.tiers_section")}</h2>
                  <TiersEditor tiers={product.variants} onChange={(variants) => updateProduct({ variants })} />
                </section>
              ) : (
                <>
                  <section className="flex flex-col gap-8 border-t border-border p-4 md:p-8 xl:flex-row xl:items-start">
                    <div className="grid gap-4 xl:flex-1">
                      <h2>{t("seller.productEdit.pricing_section")}</h2>
                      <PriceEditor
                        priceCents={product.price_cents}
                        suggestedPriceCents={product.suggested_price_cents}
                        isPWYW={product.customizable_price}
                        setPriceCents={(priceCents) => updateProduct({ price_cents: priceCents })}
                        setSuggestedPriceCents={(suggestedPriceCents) =>
                          updateProduct({ suggested_price_cents: suggestedPriceCents })
                        }
                        setIsPWYW={(isPWYW) => updateProduct({ customizable_price: isPWYW })}
                        currencyType={currencyType}
                        eligibleForInstallmentPlans={product.eligible_for_installment_plans}
                        allowInstallmentPlan={product.allow_installment_plan}
                        numberOfInstallments={product.installment_plan?.number_of_installments ?? null}
                        onAllowInstallmentPlanChange={(allowed) => updateProduct({ allow_installment_plan: allowed })}
                        onNumberOfInstallmentsChange={(value) =>
                          updateProduct({
                            installment_plan: { ...product.installment_plan, number_of_installments: value },
                          })
                        }
                        maxEffectivePriceCents={Math.max(
                          product.price_cents,
                          ...product.variants.map(
                            (v) =>
                              product.price_cents +
                              ("price_difference_cents" in v ? (v.price_difference_cents ?? 0) : 0),
                          ),
                        )}
                        hasPaidVariants={hasPaidVariantPricing(product)}
                      />
                      {product.native_type === "commission" ? (
                        <p
                          style={{
                            marginTop: "var(--spacer-2)",
                            fontSize: "var(--font-size-small)",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {t("seller.productEdit.commission_deposit_notice")}
                        </p>
                      ) : null}
                    </div>
                    {priceCheckerEnabled && !product.customizable_price && product.native_type !== "bundle" ? (
                      <div className="xl:flex-1">
                        <PriceCheckerCard />
                      </div>
                    ) : null}
                  </section>
                  {product.native_type === "call" ? (
                    <>
                      <section className="grid gap-8 border-t border-border p-4 md:p-8">
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <h2>{t("seller.productEdit.durations_section")}</h2>
                          <a href="/help/article/70-can-i-sell-services#call" target="_blank" rel="noreferrer">
                            {t("seller.productEdit.learn_more")}
                          </a>
                        </div>
                        <DurationsEditor
                          durations={product.variants}
                          onChange={(variants) => updateProduct({ variants })}
                        />
                      </section>
                      <section className="grid gap-8 border-t border-border p-4 md:p-8">
                        <h2>{t("seller.productEdit.available_hours_section")}</h2>
                        <AvailabilityEditor
                          availabilities={product.availabilities}
                          onChange={(availabilities) => updateProduct({ availabilities })}
                        />
                      </section>
                      {product.call_limitation_info ? (
                        <section className="grid gap-8 border-t border-border p-4 md:p-8">
                          <h2>{t("seller.productEdit.call_limitations_section")}</h2>
                          <CallLimitationsEditor
                            callLimitations={product.call_limitation_info}
                            onChange={(call_limitation_info) => updateProduct({ call_limitation_info })}
                          />
                        </section>
                      ) : null}
                    </>
                  ) : (
                    <section aria-label="Version editor" className="grid gap-8 border-t border-border p-4 md:p-8">
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <h2>
                          {product.native_type === "physical"
                            ? t("seller.productEdit.variants_section")
                            : t("seller.productEdit.versions_section")}
                        </h2>
                        <a
                          href="/help/article/126-setting-up-versions-on-a-digital-product"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("seller.productEdit.learn_more")}
                        </a>
                      </div>
                      <VersionsEditor
                        versions={product.variants}
                        onChange={(variants) => updateProduct({ variants })}
                      />
                    </section>
                  )}
                </>
              )}
              {isPhysical ? (
                <ShippingDestinationsEditor
                  shippingDestinations={product.shipping_destinations}
                  onChange={(shipping_destinations) => updateProduct({ shipping_destinations })}
                />
              ) : null}
              <section className="grid gap-8 border-t border-border p-4 md:p-8">
                <h2>{t("seller.productEdit.settings_section")}</h2>
                <Fieldset>
                  {product.native_type === "membership" ? (
                    <>
                      <FreeTrialSelector />
                      {cancellationDiscountsEnabled ? <CancellationDiscountSelector /> : null}
                      <Switch
                        checked={product.should_include_last_post}
                        onChange={(e) => updateProduct({ should_include_last_post: e.target.checked })}
                        label={t("seller.productEdit.membership_last_post_label")}
                      />
                      <Switch
                        checked={product.should_show_all_posts}
                        onChange={(e) => updateProduct({ should_show_all_posts: e.target.checked })}
                        label={t("seller.productEdit.membership_all_posts_label")}
                      />
                      <Switch
                        checked={product.block_access_after_membership_cancellation}
                        onChange={(e) =>
                          updateProduct({ block_access_after_membership_cancellation: e.target.checked })
                        }
                        label={t("seller.productEdit.membership_block_access_label")}
                      />
                      <DurationEditor />
                    </>
                  ) : null}
                  {product.can_enable_quantity ? (
                    <>
                      <MaxPurchaseCountToggle
                        maxPurchaseCount={product.max_purchase_count}
                        setMaxPurchaseCount={(value) => updateProduct({ max_purchase_count: value })}
                      />
                      <Switch
                        checked={product.quantity_enabled}
                        onChange={(e) => updateProduct({ quantity_enabled: e.target.checked })}
                        label={t("seller.productEdit.quantity_enabled_label")}
                      />
                    </>
                  ) : null}
                  {product.variants.length > 0 ? (
                    <Switch
                      checked={product.hide_sold_out_variants}
                      onChange={(e) => updateProduct({ hide_sold_out_variants: e.target.checked })}
                      label={t("seller.productEdit.hide_sold_out_label")}
                    />
                  ) : null}
                  <Switch
                    checked={product.should_show_sales_count}
                    onChange={(e) => updateProduct({ should_show_sales_count: e.target.checked })}
                    label={
                      product.native_type === "membership"
                        ? t("seller.productEdit.sales_count_membership_label")
                        : t("seller.productEdit.sales_count_product_label")
                    }
                  />
                  {product.native_type !== "physical" ? (
                    <Switch
                      checked={product.is_epublication}
                      onChange={(e) => updateProduct({ is_epublication: e.target.checked })}
                      label={
                        <>
                          {t("seller.productEdit.epublication_label")}{" "}
                          <a href="/help/article/10-dealing-with-vat" target="_blank" rel="noreferrer">
                            {t("seller.productEdit.learn_more")}
                          </a>
                        </>
                      }
                    />
                  ) : null}
                  {!seller_refund_policy_enabled ? (
                    <RefundPolicySelector
                      refundPolicy={product.refund_policy}
                      setRefundPolicy={(newValue) => updateProduct({ refund_policy: newValue })}
                      refundPolicies={refundPolicies}
                      isEnabled={product.product_refund_policy_enabled}
                      setIsEnabled={(newValue) => updateProduct({ product_refund_policy_enabled: newValue })}
                      setShowPreview={setShowRefundPolicyPreview}
                    />
                  ) : null}
                  {isPhysical || product.require_shipping ? (
                    <Switch
                      checked={product.require_shipping}
                      onChange={(e) => updateProduct({ require_shipping: e.target.checked })}
                      label={t("seller.productEdit.require_shipping_label")}
                    />
                  ) : null}
                </Fieldset>
                {product.native_type === "membership" ? (
                  <Fieldset>
                    <FieldsetTitle>
                      <Label htmlFor={`${uid}-subscription-duration`}>
                        {t("seller.productEdit.default_payment_frequency")}
                      </Label>
                    </FieldsetTitle>
                    <TypeSafeOptionSelect
                      id={`${uid}-subscription-duration`}
                      value={product.subscription_duration || "monthly"}
                      onChange={(subscription_duration) => updateProduct({ subscription_duration })}
                      options={recurrenceIds.map((recurrenceId) => ({
                        id: recurrenceId,
                        label: recurrenceLabels[recurrenceId],
                      }))}
                    />
                  </Fieldset>
                ) : null}
                <CustomDomain
                  verificationStatus={customDomainVerificationStatus}
                  customDomain={product.custom_domain}
                  setCustomDomain={(custom_domain) => updateProduct({ custom_domain })}
                  label={t("seller.productEdit.custom_domain")}
                  productId={id}
                  includeLearnMoreLink
                />
              </section>
            </>
          )}
        </form>
      </div>
    </Layout>
  );
};
