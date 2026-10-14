import { ChevronDown, ChevronUp, LayersAlt, Plus, Trash } from "@boxicons/react";
import { Editor } from "@tiptap/core";
import { format } from "date-fns";
import * as React from "react";

import { sendSamplePriceChangeEmail } from "$app/data/membership_tiers";
import { confirmRemovedVariantPageDeletions, reorderPreservingMembership } from "$app/data/product_save_contract";
import { getIsSingleUnitCurrency } from "$app/utils/currency";
import { useTranslation } from "$app/utils/i18n";
import { priceCentsToUnit } from "$app/utils/price";
import {
  numberOfMonthsInRecurrence,
  perRecurrenceLabels,
  RecurrenceId,
  recurrenceNames,
} from "$app/utils/recurringPricing";
import { assertResponseError } from "$app/utils/request";

import { Button } from "$app/components/Button";
import { DateInput } from "$app/components/DateInput";
import { Dropdown } from "$app/components/Dropdown";
import { Modal } from "$app/components/Modal";
import { NumberInput } from "$app/components/NumberInput";
import { PriceInput } from "$app/components/PriceInput";
import { useProductUrl } from "$app/components/ProductEdit/Layout";
import { RecurrencePriceValue, Tier, useProductEditContext } from "$app/components/ProductEdit/state";
import { RichTextEditor } from "$app/components/RichTextEditor";
import { showAlert } from "$app/components/server-components/Alert";
import { Drawer, ReorderingHandle, SortableList } from "$app/components/SortableList";
import { Alert } from "$app/components/ui/Alert";
import { Details, DetailsToggle } from "$app/components/ui/Details";
import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { InputGroup } from "$app/components/ui/InputGroup";
import { Label } from "$app/components/ui/Label";
import { LinkButton } from "$app/components/ui/LinkButton";
import { Placeholder } from "$app/components/ui/Placeholder";
import { Row, RowActions, RowContent, RowDetails, Rows } from "$app/components/ui/Rows";
import { Switch } from "$app/components/ui/Switch";
import { Textarea } from "$app/components/ui/Textarea";
import { useDebouncedCallback } from "$app/components/useDebouncedCallback";
import { useRunOnce } from "$app/components/useRunOnce";
import { WithTooltip } from "$app/components/WithTooltip";

let newTierId = 0;

const areAllEnabledPricesZero = (recurrencePriceValues: Record<string, RecurrencePriceValue>): boolean => {
  const enabledPrices = Object.values(recurrencePriceValues).filter((value) => value.enabled);
  return enabledPrices.length > 0 && enabledPrices.every((value) => !value.price_cents || value.price_cents === 0);
};

export const TiersEditor = ({ tiers, onChange }: { tiers: Tier[]; onChange: (tiers: Tier[]) => void }) => {
  const { t } = useTranslation();
  const { updateProduct, canCloseMembershipTiers } = useProductEditContext();
  const updateVersion = (id: string, update: Partial<Tier>) => {
    onChange(tiers.map((version) => (version.id === id ? { ...version, ...update } : version)));
  };

  const [deletionModalVersionId, setDeletionModalVersionId] = React.useState<string | null>(null);
  const deletionModalVersion = tiers.find(({ id }) => id === deletionModalVersionId);

  // Records that the seller explicitly confirmed removing this tier, so the
  // server-side wipe guard allows deleting it even if it still has content.
  const confirmRemoval = (tier: Tier) => {
    updateProduct((product) => {
      // Recorded even when newly added: an in-flight save may be creating it,
      // and reconciliation remaps the id; unknown ids are inert server-side.
      product.confirmed_removed_variant_ids = [...(product.confirmed_removed_variant_ids ?? []), tier.id];
      const survivingPageIds = new Set(
        [
          ...product.rich_content,
          ...product.variants
            .filter((existing) => existing.id !== tier.id)
            .flatMap((existing) => existing.rich_content),
        ].map(({ id }) => id),
      );
      confirmRemovedVariantPageDeletions(product, tier.rich_content, survivingPageIds);
    });
    onChange(tiers.filter(({ id }) => id !== tier.id));
  };

  const addButton = (
    <Button
      color="primary"
      onClick={() => {
        onChange([
          ...tiers,
          {
            id: (newTierId++).toString(),
            name: "Untitled",
            description: "",
            max_purchase_count: null,
            customizable_price: false,
            apply_price_changes_to_existing_memberships: false,
            ...(canCloseMembershipTiers && { closed_to_new_purchases: false }),
            subscription_price_change_effective_date: null,
            subscription_price_change_message: null,
            recurrence_price_values: {
              monthly: { enabled: false },
              quarterly: { enabled: false },
              biannually: { enabled: false },
              yearly: { enabled: false },
              every_two_years: { enabled: false },
            },
            integrations: { discord: false, circle: false, google_calendar: false },
            newlyAdded: true,
            rich_content: [],
          },
        ]);
      }}
    >
      <Plus className="size-5" />
      {t("seller.productEdit.add_tier", "Add tier")}
    </Button>
  );

  return tiers.length === 0 ? (
    <Placeholder>
      <h2>{t("seller.productEdit.tiers_empty_title", "Offer different tiers of this membership")}</h2>
      {t(
        "seller.productEdit.tiers_empty_desc",
        "Sweeten the deal for your customers with different levels of access. Every membership needs at least one tier.",
      )}
      {addButton}
    </Placeholder>
  ) : (
    <>
      {deletionModalVersion ? (
        <Modal
          open={!!deletionModalVersion}
          onClose={() => setDeletionModalVersionId(null)}
          title={t("seller.productEdit.remove_tier_modal_title", "Remove %{name}?", {
            name: deletionModalVersion.name,
          })}
          footer={
            <>
              <Button onClick={() => setDeletionModalVersionId(null)}>
                {t("seller.productEdit.no_cancel", "No, cancel")}
              </Button>
              <Button color="accent" onClick={() => confirmRemoval(deletionModalVersion)}>
                {t("seller.productEdit.yes_remove", "Yes, remove")}
              </Button>
            </>
          }
        >
          {t(
            "seller.productEdit.remove_tier_modal_desc",
            "If you delete this tier, its associated content will be removed as well. Your existing customers who purchased it will see the content from the current cheapest tier as a fallback. If no tier exists, they will see the product-level content.",
          )}
        </Modal>
      ) : null}
      <SortableList
        currentOrder={tiers.map(({ id }) => id)}
        onReorder={(newOrder) => onChange(reorderPreservingMembership(tiers, newOrder))}
        tag={SortableTierEditors}
      >
        {tiers.map((version) => (
          <TierEditor
            key={version.id}
            tier={version}
            canCloseTiers={canCloseMembershipTiers}
            updateTier={(update) => updateVersion(version.id, update)}
            onDelete={() => setDeletionModalVersionId(version.id)}
          />
        ))}
      </SortableList>
      {addButton}
    </>
  );
};

const PLACEHOLDER_VALUES = { monthly: "5", quarterly: "15", biannually: "30", yearly: "60", every_two_years: "120" };

const TierEditor = ({
  tier,
  canCloseTiers,
  updateTier,
  onDelete,
}: {
  tier: Tier;
  canCloseTiers: boolean;
  updateTier: (update: Partial<Tier>) => void;
  onDelete: () => void;
}) => {
  const { t } = useTranslation();
  const uid = React.useId();
  const { product, currencyType } = useProductEditContext();

  const [isOpen, setIsOpen] = React.useState(true);

  const url = useProductUrl({ option: tier.id });

  const updateRecurrencePriceValue = (recurrence: RecurrenceId, update: Partial<RecurrencePriceValue>) => {
    const updatedRecurrencePriceValues = {
      ...tier.recurrence_price_values,
      [recurrence]: { ...tier.recurrence_price_values[recurrence], ...update },
    };

    updateTier({
      recurrence_price_values: updatedRecurrencePriceValues,
      ...(areAllEnabledPricesZero(updatedRecurrencePriceValues) && { customizable_price: true }),
    });
  };

  const defaultRecurrencePriceValue = product.subscription_duration
    ? tier.recurrence_price_values[product.subscription_duration]
    : null;
  React.useEffect(() => {
    if (product.subscription_duration) {
      if (defaultRecurrencePriceValue?.price_cents) {
        const defaultPriceProratedPerMonth =
          defaultRecurrencePriceValue.price_cents / numberOfMonthsInRecurrence(product.subscription_duration);
        updateTier({
          recurrence_price_values: Object.fromEntries(
            Object.entries(tier.recurrence_price_values).map(([r, v]) => [
              r,
              {
                ...v,
                price_cents: v.enabled ? v.price_cents : defaultPriceProratedPerMonth * numberOfMonthsInRecurrence(r),
              },
            ]),
          ),
        });
      }
    }
  }, [defaultRecurrencePriceValue?.price_cents]);

  const integrations = Object.entries(product.integrations)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name);

  const allEnabledPricesAreZero = areAllEnabledPricesZero(tier.recurrence_price_values);

  return (
    <Row role="listitem">
      <RowContent>
        <ReorderingHandle />
        <LayersAlt pack="filled" className="size-5" />
        <div>
          <h3>{tier.name || t("seller.productEdit.untitled", "Untitled")}</h3>
          {tier.active_subscribers_count ? (
            <small className="block">
              {t("seller.productEdit.supporters", { count: tier.active_subscribers_count })}
            </small>
          ) : null}
        </div>
      </RowContent>
      <RowActions>
        <WithTooltip
          tip={
            isOpen
              ? t("seller.productEdit.close_drawer", "Close drawer")
              : t("seller.productEdit.open_drawer", "Open drawer")
          }
        >
          <Button size="icon" onClick={() => setIsOpen((prevIsOpen) => !prevIsOpen)}>
            {isOpen ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
          </Button>
        </WithTooltip>
        <WithTooltip tip={t("actions.remove", "Remove")}>
          <Button size="icon" onClick={onDelete} aria-label={t("actions.remove", "Remove")}>
            <Trash className="size-5" />
          </Button>
        </WithTooltip>
      </RowActions>
      {isOpen ? (
        <RowDetails asChild>
          <Drawer className="grid gap-6">
            <Fieldset>
              <Label htmlFor={`${uid}-name`}>{t("seller.productEdit.field_name", "Name")}</Label>
              <InputGroup>
                <Input
                  id={`${uid}-name`}
                  type="text"
                  value={tier.name}
                  onChange={(evt) => updateTier({ name: evt.target.value })}
                />
                <a href={url} target="_blank" rel="noreferrer">
                  {t("seller.productEdit.share_title", "Share")}
                </a>
              </InputGroup>
            </Fieldset>
            <Fieldset>
              <Label htmlFor={`${uid}-description`}>{t("seller.productEdit.field_description", "Description")}</Label>
              <Textarea
                id={`${uid}-description`}
                value={tier.description}
                onChange={(evt) => updateTier({ description: evt.target.value })}
              />
            </Fieldset>
            <Fieldset>
              <Label htmlFor={`${uid}-max-purchase-count`}>
                {t("seller.productEdit.max_active_supporters", "Maximum number of active supporters")}
              </Label>
              <NumberInput
                onChange={(value) => updateTier({ max_purchase_count: value })}
                value={tier.max_purchase_count}
              >
                {(inputProps) => (
                  <Input id={`${uid}-max-purchase-count`} type="number" placeholder="∞" {...inputProps} />
                )}
              </NumberInput>
            </Fieldset>
            {canCloseTiers ? (
              <Switch
                checked={tier.closed_to_new_purchases === true}
                onChange={(e) => updateTier({ closed_to_new_purchases: e.target.checked })}
                label={t("seller.productEdit.stop_accepting_new_supporters", "Stop accepting new supporters")}
              />
            ) : null}
            <Fieldset
              style={{
                display: "grid",
                gap: "var(--spacer-3)",
                gridTemplateColumns: "repeat(auto-fit, max(var(--dynamic-grid), 50% - var(--spacer-3) / 2))",
              }}
            >
              <FieldsetTitle>{t("seller.productEdit.pricing_section", "Pricing")}</FieldsetTitle>
              {Object.entries(tier.recurrence_price_values).map(([recurrence, value]) => (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "max-content 1fr",
                    alignItems: "center",
                    gap: "var(--spacer-2)",
                  }}
                  key={recurrence}
                >
                  <Switch
                    checked={value.enabled}
                    aria-label={`Toggle recurrence option: ${recurrenceNames[recurrence]}`}
                    onChange={() => updateRecurrencePriceValue(recurrence, { enabled: !value.enabled })}
                  />
                  <PriceInput
                    id={`${uid}-price`}
                    currencyCode={currencyType}
                    cents={value.price_cents ?? null}
                    onChange={(price_cents) => updateRecurrencePriceValue(recurrence, { price_cents })}
                    placeholder={PLACEHOLDER_VALUES[recurrence]}
                    suffix={perRecurrenceLabels[recurrence]}
                    disabled={!value.enabled}
                    ariaLabel={`Amount ${perRecurrenceLabels[recurrence]}`}
                  />
                </div>
              ))}
            </Fieldset>
            {allEnabledPricesAreZero ? (
              <Alert variant="info">
                {t("seller.productEdit.free_tier_pwyw_alert", "Free tiers require a pay what they want price.")}
              </Alert>
            ) : null}
            <Details open={tier.customizable_price}>
              <DetailsToggle chevronPosition="none" className="mb-0">
                <Switch
                  checked={tier.customizable_price}
                  onChange={(e) => updateTier({ customizable_price: e.target.checked })}
                  disabled={allEnabledPricesAreZero}
                  label={t("seller.productEdit.allow_pwyw", "Allow customers to pay what they want")}
                />
              </DetailsToggle>
              <Dropdown>
                <div
                  style={{
                    display: "grid",
                    gap: "var(--spacer-3)",
                    gridTemplateColumns: "repeat(auto-fit, max(var(--dynamic-grid), 50% - var(--spacer-3) / 2))",
                  }}
                >
                  {Object.entries(tier.recurrence_price_values).flatMap(([recurrence, value]) =>
                    value.enabled ? (
                      <React.Fragment key={recurrence}>
                        <Fieldset>
                          <Label htmlFor={`${uid}-${recurrence}-minimum-price`}>
                            {t("seller.productEdit.minimum_amount", "Minimum amount")} {perRecurrenceLabels[recurrence]}
                          </Label>
                          <PriceInput
                            id={`${uid}-${recurrence}-minimum-price`}
                            currencyCode={currencyType}
                            cents={value.price_cents}
                            disabled
                          />
                        </Fieldset>
                        <Fieldset>
                          <Label htmlFor={`${uid}-${recurrence}-suggested-price`}>
                            {t("seller.productEdit.suggested_amount", "Suggested amount")}{" "}
                            {perRecurrenceLabels[recurrence]}
                          </Label>
                          <PriceInput
                            id={`${uid}-${recurrence}-suggested-price`}
                            currencyCode={currencyType}
                            cents={value.suggested_price_cents}
                            onChange={(suggested_price_cents) =>
                              updateRecurrencePriceValue(recurrence, { suggested_price_cents })
                            }
                            placeholder={PLACEHOLDER_VALUES[recurrence]}
                          />
                        </Fieldset>
                      </React.Fragment>
                    ) : (
                      []
                    ),
                  )}
                </div>
              </Dropdown>
            </Details>
            <PriceChangeSettings tier={tier} updateTier={updateTier} />
            {integrations.length > 0 ? (
              <Fieldset>
                <FieldsetTitle>{t("seller.productEdit.integrations_section", "Integrations")}</FieldsetTitle>
                {integrations.map((integration) => (
                  <Switch
                    checked={tier.integrations[integration]}
                    onChange={(e) =>
                      updateTier({ integrations: { ...tier.integrations, [integration]: e.target.checked } })
                    }
                    key={integration}
                    label={
                      integration === "circle"
                        ? t("seller.productEdit.circle_enable_access", "Enable access to Circle community")
                        : t("seller.productEdit.discord_enable_access", "Enable access to Discord server")
                    }
                  />
                ))}
              </Fieldset>
            ) : null}
          </Drawer>
        </RowDetails>
      ) : null}
    </Row>
  );
};

const getDateWithUTCOffset = (date: Date): Date => new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
const PriceChangeSettings = ({ tier, updateTier }: { tier: Tier; updateTier: (update: Partial<Tier>) => void }) => {
  const { t } = useTranslation();
  const uid = React.useId();

  const [isMounted, setIsMounted] = React.useState(false);
  useRunOnce(() => setIsMounted(true));

  const { product, uniquePermalink, currencyType, earliestMembershipPriceChangeDate } = useProductEditContext();

  const [effectiveDate, setEffectiveDate] = React.useState<{ value: Date; error?: boolean }>(() => ({
    value: getDateWithUTCOffset(
      tier.subscription_price_change_effective_date
        ? new Date(tier.subscription_price_change_effective_date)
        : earliestMembershipPriceChangeDate,
    ),
  }));
  React.useEffect(
    () => updateTier({ subscription_price_change_effective_date: effectiveDate.value.toISOString() }),
    [effectiveDate],
  );
  const [initialEffectiveDate] = React.useState(
    tier.subscription_price_change_effective_date
      ? getDateWithUTCOffset(new Date(tier.subscription_price_change_effective_date))
      : null,
  );

  const enabledPrice = Object.entries(tier.recurrence_price_values).find(([_, value]) => value.enabled);
  const newPrice = enabledPrice?.[1]?.enabled
    ? {
        recurrence: enabledPrice[0],
        amount: priceCentsToUnit(enabledPrice[1].price_cents ?? 0, getIsSingleUnitCurrency(currencyType)).toString(),
      }
    : { recurrence: "monthly" as const, amount: "10" };

  const [editorContent] = React.useState(tier.subscription_price_change_message);
  const [editor, setEditor] = React.useState<Editor | null>(null);

  const formattedEffectiveDate = format(effectiveDate.value, "yyyy-MM-dd");
  const placeholder = t(
    "seller.productEdit.price_change_placeholder",
    `The price of your membership to "${product.name}" is changing on ${formattedEffectiveDate}.\n\nYou can modify or cancel your membership at any time.`,
    { name: product.name, date: formattedEffectiveDate },
  );

  React.useEffect(() => {
    if (editor) {
      editor.view.dispatch(editor.state.tr);
      const placeholderExtension = editor.extensionManager.extensions.find(({ name }) => name === "placeholder");
      if (placeholderExtension) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        placeholderExtension.options.placeholder = placeholder;
        editor.view.dispatch(editor.state.tr);
      }
    }
  }, [placeholder, editor]);

  const onMessageChange = useDebouncedCallback((message: string) => {
    updateTier({ subscription_price_change_message: message });
  }, 500);

  return (
    <Details open={tier.apply_price_changes_to_existing_memberships}>
      <DetailsToggle chevronPosition="none" className="mb-0">
        <Switch
          checked={tier.apply_price_changes_to_existing_memberships}
          onChange={(e) =>
            updateTier({
              apply_price_changes_to_existing_memberships: e.target.checked,
              subscription_price_change_effective_date: effectiveDate.value.toISOString(),
            })
          }
          label={t("seller.productEdit.apply_price_changes_existing", "Apply price changes to existing customers")}
        />
      </DetailsToggle>
      <Dropdown>
        <div className="grid gap-6">
          {initialEffectiveDate ? (
            <Alert variant="warning">
              {t(
                "seller.productEdit.price_change_scheduled",
                "You have scheduled a pricing update for existing customers on %{date}",
                { date: format(initialEffectiveDate, "MMMM d, y") },
              )}
            </Alert>
          ) : null}
          <div>
            <strong>
              {t(
                "seller.productEdit.price_change_notice",
                "We'll send an email reminder to your active members stating the new price 7 days prior to their next scheduled payment.",
              )}
            </strong>{" "}
            <LinkButton
              onClick={() =>
                void sendSamplePriceChangeEmail({
                  productPermalink: uniquePermalink,
                  tierId: tier.id,
                  newPrice,
                  customMessage: tier.subscription_price_change_message,
                  effectiveDate: formattedEffectiveDate,
                }).then(
                  () => {
                    showAlert(
                      t("seller.productEdit.email_sample_sent", "Email sample sent! Check your email"),
                      "success",
                    );
                  },
                  (e: unknown) => {
                    assertResponseError(e);
                    showAlert(t("seller.productEdit.error_sending_email", "Error sending email"), "error");
                  },
                )
              }
            >
              {t("seller.productEdit.get_a_sample", "Get a sample")}
            </LinkButton>
          </div>
          <Fieldset state={effectiveDate.error ? "danger" : undefined}>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-date`}>
                {t("seller.productEdit.effective_date_label", "Effective date for existing customers")}
              </Label>
            </FieldsetTitle>
            <DateInput
              id={`${uid}-date`}
              value={effectiveDate.value}
              onChange={(value) => {
                if (!value) return;
                setEffectiveDate({ value, error: value < earliestMembershipPriceChangeDate });
              }}
            />

            {effectiveDate.error ? (
              <FieldsetDescription>
                {t(
                  "seller.productEdit.effective_date_min_warning",
                  "The effective date must be at least 7 days from today",
                )}
              </FieldsetDescription>
            ) : null}
          </Fieldset>
          <Fieldset>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-custom-message`}>
                {t("seller.productEdit.custom_message", "Custom message")}
              </Label>
            </FieldsetTitle>
            {isMounted ? (
              <RichTextEditor
                id={`${uid}-custom-message`}
                className="textarea rounded border border-border px-4 py-3"
                placeholder={placeholder}
                ariaLabel={t("seller.productEdit.custom_message", "Custom message")}
                initialValue={editorContent}
                onChange={onMessageChange}
                onCreate={setEditor}
              />
            ) : null}
          </Fieldset>
        </div>
      </Dropdown>
    </Details>
  );
};

export const SortableTierEditors = React.forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
  ({ children }, ref) => (
    <Rows ref={ref} role="list" aria-label="Tier editor">
      {children}
    </Rows>
  ),
);
SortableTierEditors.displayName = "SortableTierEditors";
