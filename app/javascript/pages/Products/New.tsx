import { ChevronDown, Sparkle } from "@boxicons/react";
import { Link, useForm, usePage } from "@inertiajs/react";
import * as React from "react";
import { useState } from "react";
import typia from "typia";

import { RecurringProductType } from "$app/data/products";
import { ProductNativeType, ProductServiceType } from "$app/parsers/product";
import { classNames } from "$app/utils/classNames";
import { CurrencyCode, findCurrencyByCode } from "$app/utils/currency";
import { t } from "$app/utils/i18n";
import {
  RecurrenceId,
  durationInMonthsToRecurrenceId,
  recurrenceIds,
  recurrenceLabels,
} from "$app/utils/recurringPricing";
import { assertResponseError, RateLimitError, request } from "$app/utils/request";

import { Button } from "$app/components/Button";
import Errors from "$app/components/Form/Errors";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "$app/components/Popover";
import { showAlert } from "$app/components/server-components/Alert";
import { TypeSafeOptionSelect } from "$app/components/TypeSafeOptionSelect";
import { Alert } from "$app/components/ui/Alert";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { FormSection } from "$app/components/ui/FormSection";
import { Input } from "$app/components/ui/Input";
import { InputGroup } from "$app/components/ui/InputGroup";
import { Label } from "$app/components/ui/Label";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Tab, Tabs } from "$app/components/ui/Tabs";
import { Textarea } from "$app/components/ui/Textarea";
import { WithTooltip } from "$app/components/WithTooltip";

import hands from "$assets/images/illustrations/hands.png";

const rawIcons = import.meta.glob<string>("$assets/images/native_types/*", {
  eager: true,
  query: "?url",
  import: "default",
});
const nativeTypeIcons = Object.fromEntries(
  Object.entries(rawIcons).map(([key, value]) => [`./${key.split("/").pop()}`, value]),
);

const defaultRecurrence: RecurrenceId = "monthly";

const MIN_AI_PROMPT_LENGTH = 10;

type NewProductFormData = {
  link: {
    name: string;
    price_range: string;
    price_currency_type: CurrencyCode;
    native_type: ProductNativeType;
    is_physical: boolean;
    is_recurring_billing: boolean;
    subscription_duration: RecurrenceId | null;
    description: string | null;
    custom_summary: string | null;
    ai_prompt: string;
    number_of_content_pages: number | null;
    release_at_date: string;
  };
};

type FormErrors = {
  "link.base"?: string | undefined;
  "link.name"?: string | undefined;
  "link.price_range"?: string | undefined;
};

type NewProductPageProps = {
  current_seller_currency_code: CurrencyCode;
  native_product_types: ProductNativeType[];
  service_product_types: ProductServiceType[];
  release_at_date: string;
  show_orientation_text: boolean;
  eligible_for_service_products: boolean;
  ai_generation_enabled: boolean;
  ai_promo_dismissed: boolean;
  is_mobile_app_web_view?: boolean;
};

const NewProductPage = () => {
  const {
    current_seller_currency_code,
    native_product_types,
    service_product_types,
    release_at_date,
    show_orientation_text,
    eligible_for_service_products,
    ai_generation_enabled,
    ai_promo_dismissed,
    is_mobile_app_web_view,
  } = typia.assert<NewProductPageProps>(usePage().props);

  const isMobileAppWebView =
    Boolean(is_mobile_app_web_view) ||
    (typeof window !== "undefined" &&
      (Boolean(window.ReactNativeWebView) ||
        new URLSearchParams(window.location.search).get("display") === "mobile_app"));

  const formUID = React.useId();

  const form = useForm<NewProductFormData>("CreateProduct", {
    link: {
      name: "",
      price_range: "",
      price_currency_type: current_seller_currency_code || "etb",
      native_type: "digital",
      is_physical: false,
      is_recurring_billing: false,
      subscription_duration: null,
      description: null,
      custom_summary: null,
      ai_prompt: "",
      number_of_content_pages: null,
      release_at_date,
    },
  });

  const errors = typia.assert<FormErrors>(form.errors);

  const [aiPromoVisible, setAiPromoVisible] = useState(ai_generation_enabled && !ai_promo_dismissed);
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
  const [isGeneratingUsingAi, setIsGeneratingUsingAi] = useState(false);

  const isRecurringBilling = typia.is<RecurringProductType>(form.data.link.native_type);

  const selectedCurrency = findCurrencyByCode(form.data.link.price_currency_type);

  const handleProductTypeChange = (type: ProductNativeType) => {
    form.setData("link", {
      ...form.data.link,
      native_type: type,
      is_physical: type === "physical",
      is_recurring_billing: typia.is<RecurringProductType>(type),
      subscription_duration: typia.is<RecurringProductType>(type)
        ? form.data.link.subscription_duration || defaultRecurrence
        : null,
    });
  };

  const dismissAiPromo = async () => {
    try {
      await request({
        method: "POST",
        url: Routes.settings_dismiss_ai_product_generation_promo_path(),
        accept: "json",
      });
      setAiPromoVisible(false);
    } catch (e) {
      assertResponseError(e);
      showAlert(t("seller.products.ai_dismiss_failed"), "error");
    }
  };

  const generateWithAi = async () => {
    if (form.data.link.ai_prompt.trim().length < MIN_AI_PROMPT_LENGTH) {
      showAlert(t("seller.products.ai_min_chars", { count: MIN_AI_PROMPT_LENGTH }), "error");
      return;
    }

    setIsGeneratingUsingAi(true);
    try {
      const response = await request({
        method: "POST",
        url: Routes.internal_ai_product_details_generations_path(),
        accept: "json",
        data: { prompt: form.data.link.ai_prompt.trim() },
      });

      const result = typia.assert<
        | {
            success: true;
            data: {
              name: string;
              description: string;
              summary: string;
              price: number;
              currency_code: string;
              price_frequency_in_months: number | null;
              native_type: ProductNativeType;
              number_of_content_pages: number | null;
            };
          }
        | {
            success: false;
            error: string;
          }
      >(await response.json());

      if (result.success) {
        const aiData = result.data;
        const subscriptionDuration =
          aiData.native_type === "membership" && aiData.price_frequency_in_months
            ? durationInMonthsToRecurrenceId[aiData.price_frequency_in_months] || defaultRecurrence
            : null;

        form.setData("link", {
          ...form.data.link,
          name: aiData.name,
          description: aiData.description,
          custom_summary: aiData.summary,
          native_type: aiData.native_type,
          number_of_content_pages: aiData.number_of_content_pages,
          price_range: aiData.price.toString(),
          price_currency_type: typia.is<CurrencyCode>(aiData.currency_code)
            ? aiData.currency_code
            : form.data.link.price_currency_type,
          is_physical: aiData.native_type === "physical",
          is_recurring_billing: typia.is<RecurringProductType>(aiData.native_type),
          subscription_duration: subscriptionDuration,
        });

        setAiPopoverOpen(false);
        setAiPromoVisible(false);

        showAlert(t("seller.products.ai_success"), "success");
      } else {
        showAlert(result.error, "error");
      }
    } catch (e) {
      assertResponseError(e);
      if (e instanceof RateLimitError) {
        showAlert(e.message, "warning");
      } else {
        showAlert(t("seller.products.ai_generate_failed"), "error");
      }
    } finally {
      setIsGeneratingUsingAi(false);
    }
  };

  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const priceInputRef = React.useRef<HTMLInputElement>(null);

  const saveProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let hasErrors = false;
    let hasFocused = false;
    if (form.data.link.name.trim() === "") {
      form.setError("link.name", "is required");
      nameInputRef.current?.focus();
      hasErrors = true;
      hasFocused = true;
    } else {
      form.clearErrors("link.name");
    }

    if (form.data.link.price_range.trim() === "") {
      form.setError("link.price_range", "is required");
      if (!hasFocused) {
        priceInputRef.current?.focus();
      }
      hasErrors = true;
    } else {
      form.clearErrors("link.price_range");
    }

    if (!hasErrors) {
      form.post(Routes.links_path());
    }
  };

  return (
    <>
      <PageHeader
        className="sticky-top"
        title={
          show_orientation_text ? t("seller.products.new_header_first") : t("seller.products.new_header_subsequent")
        }
        actions={
          <>
            {isMobileAppWebView ? null : (
              <Button asChild>
                <Link href={Routes.products_path()}>
                  <span>{t("seller.products.cancel")}</span>
                </Link>
              </Button>
            )}
            {ai_generation_enabled ? (
              <Popover open={aiPopoverOpen} onOpenChange={setAiPopoverOpen}>
                <PopoverAnchor>
                  <PopoverTrigger aria-label={t("seller.products.ai_modal_title")} asChild>
                    <Button size="icon" color="primary" outline>
                      <Sparkle className="size-5" />
                    </Button>
                  </PopoverTrigger>
                </PopoverAnchor>
                <PopoverContent>
                  <div className="w-96 max-w-full">
                    <Fieldset>
                      <FieldsetTitle>
                        <Label htmlFor={`ai-prompt-${formUID}`}>{t("seller.products.ai_modal_title")}</Label>
                      </FieldsetTitle>
                      <p>{t("seller.products.ai_modal_description")}</p>
                      <Textarea
                        id={`ai-prompt-${formUID}`}
                        placeholder={t("seller.products.ai_prompt_placeholder")}
                        value={form.data.link.ai_prompt}
                        onChange={(e) => form.setData("link.ai_prompt", e.target.value)}
                        rows={4}
                        maxLength={500}
                        className="w-full resize-y"
                        autoFocus
                      />
                    </Fieldset>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button onClick={() => setAiPopoverOpen(false)} disabled={isGeneratingUsingAi}>
                        {t("seller.products.cancel")}
                      </Button>
                      <Button
                        color="primary"
                        onClick={() => void generateWithAi()}
                        disabled={isGeneratingUsingAi || !form.data.link.ai_prompt.trim()}
                      >
                        {isGeneratingUsingAi ? t("seller.products.ai_generating") : t("seller.products.ai_generate")}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
            <Button color="accent" type="submit" form={`new-product-form-${formUID}`} disabled={form.processing}>
              {form.processing ? t("seller.products.adding") : t("seller.products.next_customize")}
            </Button>
          </>
        }
      />
      <div>
        <div>
          <form id={`new-product-form-${formUID}`} className="row" onSubmit={saveProduct}>
            <FormSection
              header={
                <p>
                  {t("seller.products.intro_text")}
                  <br />
                  <br />
                  <a href="/help/article/64-is-gumroad-for-me" target="_blank" rel="noreferrer">
                    {t("seller.products.need_help")}
                  </a>
                </p>
              }
            >
              {ai_generation_enabled && aiPromoVisible ? (
                <Alert className="gap-4 p-6" role="status" variant="accent">
                  <div className="flex items-center gap-4">
                    <img src={hands} alt="Hands" className="size-12" />
                    <div className="flex-1">
                      <strong>{t("seller.products.ai_banner_title")}</strong>{" "}
                      {t("seller.products.ai_banner_description")}
                      <br />
                      <a href="/help/article/149-adding-a-product" target="_blank" rel="noreferrer">
                        {t("seller.productEdit.learn_more")}
                      </a>
                    </div>
                    <button className="underline" onClick={() => void dismissAiPromo()}>
                      {t("seller.productEdit.close")}
                    </button>
                  </div>
                </Alert>
              ) : null}

              <Fieldset state={errors["link.name"] ? "danger" : undefined}>
                <FieldsetTitle>
                  <Label htmlFor={`name-${formUID}`}>{t("seller.products.field_name")}</Label>
                </FieldsetTitle>

                <Input
                  id={`name-${formUID}`}
                  type="text"
                  value={form.data.link.name}
                  onChange={(e) => form.setData("link.name", e.target.value)}
                  aria-invalid={!!errors["link.name"]}
                  ref={nameInputRef}
                  className="border-foreground/40"
                />
                <Errors errors={errors["link.name"]} label={t("seller.products.field_name")} />
              </Fieldset>

              <Fieldset>
                <FieldsetTitle>{t("seller.products.field_products")}</FieldsetTitle>
                <ProductTypeSelector
                  selectedType={form.data.link.native_type}
                  types={native_product_types}
                  onChange={handleProductTypeChange}
                />
              </Fieldset>
              {service_product_types.length > 0 ? (
                <Fieldset>
                  <FieldsetTitle>{t("seller.products.field_services")}</FieldsetTitle>
                  <ProductTypeSelector
                    selectedType={form.data.link.native_type}
                    types={service_product_types}
                    onChange={handleProductTypeChange}
                    disabled={!eligible_for_service_products}
                  />
                </Fieldset>
              ) : null}

              <Fieldset state={errors["link.price_range"] || errors["link.base"] ? "danger" : undefined}>
                <FieldsetTitle>
                  <Label htmlFor={`price-${formUID}`}>
                    {form.data.link.native_type === "coffee"
                      ? t("seller.products.field_suggested_amount")
                      : t("seller.products.field_price")}
                  </Label>
                </FieldsetTitle>

                <InputGroup>
                  <Pill className="relative -ml-2 shrink-0">
                    <span>{selectedCurrency.longSymbol}</span>
                  </Pill>

                  <Input
                    id={`price-${formUID}`}
                    type="text"
                    inputMode="decimal"
                    maxLength={10}
                    value={form.data.link.price_range}
                    onChange={(e) => {
                      let newValue = e.target.value;
                      newValue = newValue.replace(/[.,]+/gu, ".");
                      newValue = newValue.replace(/[^0-9.]/gu, "");
                      const firstDotIndex = newValue.indexOf(".");
                      if (firstDotIndex !== -1) {
                        newValue =
                          newValue.slice(0, firstDotIndex + 1) + newValue.slice(firstDotIndex + 1).replace(/\./gu, "");
                      }
                      form.setData("link.price_range", newValue);
                      form.clearErrors("link.price_range");
                    }}
                    autoComplete="off"
                    aria-invalid={!!errors["link.price_range"] || !!errors["link.base"]}
                    ref={priceInputRef}
                  />

                  {isRecurringBilling ? (
                    <Pill asChild className="relative -mr-2 shrink-0 cursor-pointer">
                      <Label>
                        <span>{recurrenceLabels[form.data.link.subscription_duration || defaultRecurrence]}</span>
                        <TypeSafeOptionSelect
                          onChange={(newSubscriptionDuration) => {
                            form.setData("link.subscription_duration", newSubscriptionDuration);
                          }}
                          value={form.data.link.subscription_duration || defaultRecurrence}
                          aria-label={t("seller.products.default_subscription_duration")}
                          options={recurrenceIds.map((recurrence) => ({
                            id: recurrence,
                            label: recurrenceLabels[recurrence],
                          }))}
                          className="absolute inset-0 z-1 m-0! cursor-pointer opacity-0"
                        />
                        <ChevronDown className="ml-auto size-5" />
                      </Label>
                    </Pill>
                  ) : null}
                </InputGroup>
                <Errors errors={errors["link.price_range"]} label={t("seller.products.field_price")} />
                <Errors errors={errors["link.base"]} label="" />
              </Fieldset>
            </FormSection>
          </form>
        </div>
      </div>
    </>
  );
};

const PRODUCT_TYPES: Record<ProductNativeType, { title: string; description: string }> = {
  audiobook: {
    get description() {
      return t("seller.products.type_audiobook_desc");
    },
    get title() {
      return t("seller.products.type_audiobook_title");
    },
  },
  bundle: {
    get description() {
      return t("seller.products.type_bundle_desc");
    },
    get title() {
      return t("seller.products.type_bundle_title");
    },
  },
  call: {
    get description() {
      return t("seller.products.type_call_desc");
    },
    get title() {
      return t("seller.products.type_call_title");
    },
  },
  coffee: {
    get description() {
      return t("seller.products.type_coffee_desc");
    },
    get title() {
      return t("seller.products.type_coffee_title");
    },
  },
  commission: {
    get description() {
      return t("seller.products.type_commission_desc");
    },
    get title() {
      return t("seller.products.type_commission_title");
    },
  },
  course: {
    get description() {
      return t("seller.products.type_course_desc");
    },
    get title() {
      return t("seller.products.type_course_title");
    },
  },
  digital: {
    get description() {
      return t("seller.products.type_digital_desc");
    },
    get title() {
      return t("seller.products.type_digital_title");
    },
  },
  ebook: {
    get description() {
      return t("seller.products.type_ebook_desc");
    },
    get title() {
      return t("seller.products.type_ebook_title");
    },
  },
  membership: {
    get description() {
      return t("seller.products.type_membership_desc");
    },
    get title() {
      return t("seller.products.type_membership_title");
    },
  },
  newsletter: {
    get description() {
      return t("seller.products.type_newsletter_desc");
    },
    get title() {
      return t("seller.products.type_newsletter_title");
    },
  },
  physical: {
    get description() {
      return t("seller.products.type_physical_desc");
    },
    get title() {
      return t("seller.products.type_physical_title");
    },
  },
  podcast: {
    get description() {
      return t("seller.products.type_podcast_desc");
    },
    get title() {
      return t("seller.products.type_podcast_title");
    },
  },
};

const ProductTypeSelector = ({
  selectedType,
  types,
  onChange,
  disabled,
}: {
  selectedType: ProductNativeType;
  types: ProductNativeType[];
  onChange: (type: ProductNativeType) => void;
  disabled?: boolean;
}) => (
  <Tabs
    variant="buttons"
    className="gap-4 sm:grid-cols-2 md:grid-flow-row md:grid-cols-3 2xl:grid-cols-5"
    role="radiogroup"
  >
    {types.map((type) => {
      const isSelected = type === selectedType;
      const typeButton = (
        <Tab
          key={type}
          isSelected={isSelected}
          asChild
          className="not-active:hover:translate-0 not-active:hover:shadow-none"
        >
          <Button
            className={classNames("flex-col hover:translate-0 hover:shadow-none", isSelected && "shadow-none")}
            role="radio"
            aria-checked={isSelected}
            data-type={type}
            onClick={() => onChange(type)}
            disabled={disabled}
          >
            <img
              src={nativeTypeIcons[`./${type}.png`]}
              alt={PRODUCT_TYPES[type].title}
              className="shrink-0"
              width="40"
              height="40"
            />
            <div>
              <h4 className="font-bold">{PRODUCT_TYPES[type].title}</h4>
              {PRODUCT_TYPES[type].description}
            </div>
          </Button>
        </Tab>
      );
      return disabled ? (
        <WithTooltip tip={t("seller.products.service_tooltip")} key={type}>
          {typeButton}
        </WithTooltip>
      ) : (
        typeButton
      );
    })}
    {/* Grid spacers: keep the button grid visually balanced when fewer than 3 product types are available. */}
    {types.length < 2 ? <div /> : null}
    {types.length < 3 ? <div /> : null}
  </Tabs>
);

export default NewProductPage;
