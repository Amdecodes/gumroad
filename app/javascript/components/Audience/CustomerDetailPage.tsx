import { ArrowDown, ArrowUpRightSquare, Envelope, Paperclip, Trash } from "@boxicons/react";
import { Deferred, Link } from "@inertiajs/react";
import { Blob, DirectUpload } from "@rails/activestorage";
import * as React from "react";

import {
  Address,
  Call,
  Charge,
  Commission,
  Customer,
  CustomerEmail,
  Discount,
  File,
  License,
  MissedPost,
  Option,
  Review,
  ReviewVideo,
  Tracking,
  adjustLicenseUses,
  approveReviewVideo,
  cancelSubscription,
  changeCanContact,
  completeCommission,
  getCharges,
  getOptions,
  markShipped,
  refund,
  rejectReviewVideo,
  resendPing,
  resendPost,
  resendReceipt,
  revokeAccess,
  setLicenseUses,
  undoRevokeAccess,
  updateCallUrl,
  updateCommission,
  updateLicense,
  updateOption,
  updatePurchase,
} from "$app/data/customers";
import {
  CurrencyCode,
  formatPriceCentsWithCurrencySymbol,
  formatPriceCentsWithoutCurrencySymbol,
  getIsSingleUnitCurrency,
} from "$app/utils/currency";
import { formatCallDate } from "$app/utils/date";
import { isValidEmail } from "$app/utils/email";
import FileUtils from "$app/utils/file";
import { t } from "$app/utils/i18n";
import { priceCentsToUnit } from "$app/utils/price";
import { asyncVoid } from "$app/utils/promise";
import { RecurrenceId, recurrenceLabels } from "$app/utils/recurringPricing";
import { assertResponseError, ResponseError } from "$app/utils/request";

import { Button, NavigationButton, buttonVariants } from "$app/components/Button";
import { CopyToClipboard } from "$app/components/CopyToClipboard";
import { useCurrentSeller } from "$app/components/CurrentSeller";
import { FileKindIcon } from "$app/components/FileRowContent";
import { LoadingSpinner } from "$app/components/LoadingSpinner";
import { Modal } from "$app/components/Modal";
import { NavigationButtonInertia } from "$app/components/NavigationButton";
import { NumberInput } from "$app/components/NumberInput";
import { PriceInput } from "$app/components/PriceInput";
import { RatingStars } from "$app/components/RatingStars";
import { ReviewResponseForm } from "$app/components/ReviewResponseForm";
import { ReviewVideoPlayer } from "$app/components/ReviewVideoPlayer";
import { showAlert } from "$app/components/server-components/Alert";
import { Alert } from "$app/components/ui/Alert";
import { Card, CardContent } from "$app/components/ui/Card";
import { Checkbox } from "$app/components/ui/Checkbox";
import { DefinitionList } from "$app/components/ui/DefinitionList";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { InlineList } from "$app/components/ui/InlineList";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { LinkButton } from "$app/components/ui/LinkButton";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Row, RowActions, RowContent, Rows } from "$app/components/ui/Rows";
import { Select as FormSelect } from "$app/components/ui/Select";
import { useUserAgentInfo } from "$app/components/UserAgent";
import { useRunOnce } from "$app/components/useRunOnce";
import { WithTooltip } from "$app/components/WithTooltip";

export type CustomerDetailPageProps = {
  customer: Customer;
  countries: string[];
  can_ping: boolean;
  can_email: boolean;
  show_refund_fee_notice: boolean;
  emails: CustomerEmail[];
  missed_posts?: MissedPost[];
  charges: Charge[];
  product_purchases: Customer[];
};

const year = new Date().getFullYear();

const formatPrice = (priceCents: number, currencyType: CurrencyCode, recurrence?: RecurrenceId | null) =>
  `${formatPriceCentsWithCurrencySymbol(currencyType, priceCents, { symbolFormat: "long" })}${
    recurrence ? ` ${recurrenceLabels[recurrence]}` : ""
  }`;

const formatDiscount = (discount: Discount, currencyType: CurrencyCode) =>
  discount.type === "fixed"
    ? formatPriceCentsWithCurrencySymbol(currencyType, discount.cents, {
        symbolFormat: "short",
      })
    : `${discount.percents}%`;

const getMembershipStatusLabel = (status: string) => {
  switch (status) {
    case "alive":
      return t("seller.customerDetail.membership_status_alive");
    case "cancelled":
      return t("seller.customerDetail.membership_status_cancelled");
    case "failed_payment":
      return t("seller.customerDetail.membership_status_failed_payment");
    case "fixed_subscription_period_ended":
      return t("seller.customerDetail.membership_status_ended");
    case "payment_method_update_required":
      return t("seller.customerDetail.membership_status_payment_method_update_required");
    case "pending_cancellation":
      return t("seller.customerDetail.membership_status_pending_cancellation");
    case "pending_failure":
      return t("seller.customerDetail.membership_status_pending_failure");
    default:
      return status;
  }
};

const getInstallmentPlanStatusLabel = (status: string) => {
  switch (status) {
    case "alive":
      return t("seller.customerDetail.installment_status_alive");
    case "cancelled":
      return t("seller.customerDetail.installment_status_cancelled");
    case "failed_payment":
      return t("seller.customerDetail.installment_status_failed_payment");
    case "fixed_subscription_period_ended":
      return t("seller.customerDetail.installment_status_paid_in_full");
    case "payment_method_update_required":
      return t("seller.customerDetail.installment_status_payment_method_update_required");
    case "pending_cancellation":
      return t("seller.customerDetail.installment_status_pending_cancellation");
    case "pending_failure":
      return t("seller.customerDetail.installment_status_pending_failure");
    default:
      return status;
  }
};

const PAGE_SIZE = 10;

const CustomerDetailPage = ({
  customer: initialCustomer,
  countries,
  can_ping: canPing,
  can_email: canEmail,
  show_refund_fee_notice: showRefundFeeNotice,
  emails: initialEmails,
  missed_posts: initialMissedPosts,
  charges: initialCharges,
  product_purchases: initialProductPurchases,
}: CustomerDetailPageProps) => {
  const userAgentInfo = useUserAgentInfo();
  const currentSeller = useCurrentSeller();

  const [canGoBackToCustomers] = React.useState(() => {
    if (typeof window === "undefined") return false;
    const flag = window.sessionStorage.getItem("CustomersPage:canGoBack") === "1";
    if (flag) window.sessionStorage.removeItem("CustomersPage:canGoBack");
    return flag;
  });

  const [customer, setCustomer] = React.useState(initialCustomer);
  const updateCustomer = (update: Partial<Customer>) => setCustomer((prev) => ({ ...prev, ...update }));

  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const missedPosts = initialMissedPosts ?? [];
  const [shownMissedPosts, setShownMissedPosts] = React.useState(PAGE_SIZE);
  const emails = initialEmails;
  const [shownEmails, setShownEmails] = React.useState(PAGE_SIZE);
  const sentEmailIds = React.useRef<Set<string>>(new Set());

  const onSend = async (id: string, type: "receipt" | "post") => {
    setLoadingId(id);
    try {
      await (type === "receipt" ? resendReceipt(id) : resendPost(customer.id, id));
      sentEmailIds.current.add(id);
      showAlert(
        type === "receipt" ? t("seller.customerDetail.receipt_resent") : t("seller.customerDetail.email_sent"),
        "success",
      );
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    }
    setLoadingId(null);
  };

  const [productPurchases, setProductPurchases] = React.useState<Customer[]>(initialProductPurchases);

  const { subscription, commission, license, shipping } = customer;

  const showCharges = subscription || commission;
  const [charges, setCharges] = React.useState<Charge[]>(initialCharges);

  const isCoffee = customer.product.native_type === "coffee";
  const canEmailCustomer =
    canEmail && isValidEmail(customer.email) && customer.can_contact && !customer.is_gift_sender_purchase;

  const formatDateWithoutTime = (date: Date) =>
    date.toLocaleDateString(userAgentInfo.locale, {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== year ? "numeric" : undefined,
      timeZone: currentSeller?.timeZone.name,
    });

  const statusPills = (
    <>
      {commission ? <CommissionStatusPill commission={commission} /> : null}
      {customer.refunded ? (
        <Pill size="small" color="danger">
          {t("seller.customers.badge_refunded")}
        </Pill>
      ) : null}
      {customer.partially_refunded ? <Pill size="small">{t("seller.customers.badge_partially_refunded")}</Pill> : null}
      {customer.chargedback ? (
        <Pill size="small" color="danger">
          {t("seller.customers.badge_chargedback")}
        </Pill>
      ) : null}
      {customer.is_preorder ? <Pill size="small">{t("seller.customerDetail.pill_preorder")}</Pill> : null}
      {customer.is_additional_contribution ? (
        <Pill size="small">{t("seller.customerDetail.pill_additional_contribution")}</Pill>
      ) : null}
      {customer.is_bundle_purchase ? <Pill size="small">{t("seller.customers.badge_bundle")}</Pill> : null}
      {subscription?.is_installment_plan ? <Pill size="small">{t("seller.customers.badge_installments")}</Pill> : null}
      {subscription && !subscription.is_installment_plan && subscription.status !== "alive" ? (
        <Pill size="small">
          {subscription.status === "payment_method_update_required"
            ? t("seller.customers.badge_payment_update_required")
            : t("seller.customers.badge_inactive")}
        </Pill>
      ) : null}
    </>
  );

  return (
    <div className="h-full">
      <PageHeader
        showTitleOnMobile
        title={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/customers"
              aria-label={t("seller.customerDetail.back_to_customers")}
              className="mr-4 hidden no-underline sm:inline"
              onClick={(e) => {
                if (!canGoBackToCustomers) return;
                e.preventDefault();
                window.history.back();
              }}
            >
              ←
            </Link>
            {customer.product.name}
            {statusPills}
          </div>
        }
        actions={
          canEmailCustomer ? (
            <NavigationButton
              color="accent"
              href={Routes.new_email_path({
                template: "single_customer",
                purchase_id: customer.id,
              })}
            >
              <Envelope aria-hidden="true" className="size-5" />
              {t("seller.customerDetail.email_customer")}
            </NavigationButton>
          ) : null
        }
      />

      <ColumnLayout className="flex flex-col gap-8 p-4 md:p-8">
        {customer.is_additional_contribution ? (
          <div className="break-inside-avoid">
            <Alert role="status" variant="info">
              <strong>{t("seller.customerDetail.additional_amount_title")} </strong>
              {t("seller.customerDetail.additional_amount_desc")}
            </Alert>
          </div>
        ) : null}
        {customer.ppp ? (
          <div className="break-inside-avoid">
            <Alert role="status" variant="info">
              {t("seller.customerDetail.ppp_notice", {
                discount: customer.ppp.discount,
                country: customer.ppp.country,
              })}
            </Alert>
          </div>
        ) : null}
        {customer.giftee_email ? (
          <div className="break-inside-avoid">
            <Alert role="status" variant="info">
              {t("seller.customerDetail.gift_notice", {
                email: customer.email,
                giftee_email: customer.giftee_email,
              })}
            </Alert>
          </div>
        ) : null}
        {customer.is_preorder ? (
          <div className="break-inside-avoid">
            <Alert role="status" variant="info">
              <strong>{t("seller.customerDetail.preorder_notice_title")} </strong>
              {t("seller.customerDetail.preorder_notice_desc")}
            </Alert>
          </div>
        ) : null}
        {customer.affiliate && customer.affiliate.type !== "Collaborator" ? (
          <div className="break-inside-avoid">
            <Alert role="status" variant="info">
              <strong>{t("seller.customerDetail.affiliate_notice_title")} </strong>
              {t("seller.customerDetail.affiliate_notice_desc", {
                email: customer.affiliate.email,
                amount: customer.affiliate.amount,
              })}
            </Alert>
          </div>
        ) : null}
        <div className="break-inside-avoid">
          <EmailSection
            label={t("seller.customerDetail.email_label")}
            email={customer.email}
            onSave={
              customer.is_existing_user
                ? null
                : (email) =>
                    updatePurchase(customer.id, { email }).then(
                      () => {
                        showAlert(t("seller.customerDetail.email_updated"), "success");
                        updateCustomer({ email });
                        if (productPurchases.length)
                          setProductPurchases((prevProductPurchases) =>
                            prevProductPurchases.map((productPurchase) => ({ ...productPurchase, email })),
                          );
                      },
                      (e: unknown) => {
                        assertResponseError(e);
                        showAlert(e.message, "error");
                      },
                    )
            }
            canContact={customer.can_contact}
            onChangeCanContact={(canContact) =>
              changeCanContact(customer.id, canContact).then(
                () => {
                  showAlert(
                    canContact
                      ? t("seller.customerDetail.posts_subscribed")
                      : t("seller.customerDetail.posts_unsubscribed"),
                    "success",
                  );
                  updateCustomer({ can_contact: canContact });
                },
                (e: unknown) => {
                  assertResponseError(e);
                  showAlert(e.message, "error");
                },
              )
            }
          />
        </div>
        {customer.giftee_email ? (
          <div className="break-inside-avoid">
            <EmailSection
              label={t("seller.customerDetail.giftee_email_label")}
              email={customer.giftee_email}
              onSave={(email) =>
                updatePurchase(customer.id, { giftee_email: email }).then(
                  () => {
                    showAlert(t("seller.customerDetail.email_updated"), "success");
                    updateCustomer({ giftee_email: email });
                  },
                  (e: unknown) => {
                    assertResponseError(e);
                    showAlert(e.message, "error");
                  },
                )
              }
            />
          </div>
        ) : null}
        <Card asChild>
          <section className="break-inside-avoid">
            <CardContent asChild>
              <h3 className="flex gap-1">
                {t("seller.customerDetail.order_information")}
                {!subscription && customer.transaction_url_for_seller ? (
                  <a
                    href={customer.transaction_url_for_seller}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Transaction"
                    className="grow"
                  >
                    <ArrowUpRightSquare className="size-5" />
                  </a>
                ) : null}
              </h3>
            </CardContent>
            <CardContent>
              <h5 className="grow font-bold">{t("seller.customerDetail.customer_name")}</h5>
              {customer.name || customer.email}
            </CardContent>
            <CardContent>
              <h5 className="grow font-bold">
                {customer.is_multiseat_license ? t("seller.customerDetail.seats") : t("seller.customerDetail.quantity")}
              </h5>
              {customer.quantity}
            </CardContent>
            {customer.download_count ? (
              <CardContent>
                <h5 className="grow font-bold">{t("seller.customerDetail.times_opened")}</h5>
                {customer.download_count}
              </CardContent>
            ) : null}
            <CardContent>
              <h5 className="grow font-bold">{t("seller.customerDetail.price")}</h5>
              <div>
                {customer.price.cents_before_offer_code > customer.price.cents ? (
                  <>
                    <s>
                      {formatPrice(
                        customer.price.cents_before_offer_code,
                        customer.price.currency_type,
                        customer.price.recurrence,
                      )}
                    </s>{" "}
                  </>
                ) : null}
                {formatPrice(
                  customer.price.cents - (customer.price.tip_cents ?? 0),
                  customer.price.currency_type,
                  customer.price.recurrence,
                )}
              </div>
            </CardContent>
            {customer.price.tip_cents ? (
              <CardContent>
                <h5 className="grow font-bold">{t("seller.customerDetail.tip")}</h5>
                {formatPrice(customer.price.tip_cents, customer.price.currency_type, customer.price.recurrence)}
              </CardContent>
            ) : null}
            {customer.discount && !customer.upsell ? (
              <CardContent>
                <h5 className="grow font-bold">{t("seller.customerDetail.discount")}</h5>
                {customer.discount.code ? (
                  <div>
                    {t("seller.customerDetail.discount_off_with_code", {
                      amount: formatDiscount(customer.discount, customer.price.currency_type),
                    })}{" "}
                    <Pill size="small">{customer.discount.code.toUpperCase()}</Pill>
                  </div>
                ) : (
                  t("seller.customerDetail.discount_off", {
                    amount: formatDiscount(customer.discount, customer.price.currency_type),
                  })
                )}
              </CardContent>
            ) : null}
            {customer.upsell ? (
              <CardContent>
                <h5 className="grow font-bold">{t("seller.customerDetail.upsell")}</h5>
                {`${customer.upsell}${
                  customer.discount
                    ? ` (${t("seller.customerDetail.discount_off", { amount: formatDiscount(customer.discount, customer.price.currency_type) })})`
                    : ""
                }`}
              </CardContent>
            ) : null}
            {subscription?.status ? (
              <CardContent>
                <h5 className="grow font-bold">
                  {subscription.is_installment_plan
                    ? t("seller.customerDetail.installment_plan_status")
                    : t("seller.customerDetail.membership_status")}
                </h5>
                <div
                  style={{
                    color:
                      subscription.status === "alive" || subscription.status === "fixed_subscription_period_ended"
                        ? undefined
                        : "var(--red)",
                  }}
                >
                  {subscription.is_installment_plan
                    ? getInstallmentPlanStatusLabel(subscription.status)
                    : getMembershipStatusLabel(subscription.status)}
                </div>
              </CardContent>
            ) : null}
            {customer.referrer ? (
              <CardContent>
                <h5 className="grow font-bold">{t("seller.customerDetail.referrer")}</h5>
                {customer.referrer}
              </CardContent>
            ) : null}
            {customer.physical ? (
              <>
                <CardContent>
                  <h5 className="grow font-bold">{t("seller.customerDetail.sku")}</h5>
                  {customer.physical.sku}
                </CardContent>
                <CardContent>
                  <h5 className="grow font-bold">{t("seller.customerDetail.order_number")}</h5>
                  {customer.physical.order_number}
                </CardContent>
              </>
            ) : null}
          </section>
        </Card>
        {customer.utm_link ? (
          <div className="break-inside-avoid">
            <UtmLinkCard link={customer.utm_link} />
          </div>
        ) : null}
        {customer.review ? (
          <div className="break-inside-avoid">
            <ReviewSection
              review={customer.review}
              purchaseId={customer.id}
              onChange={(updatedReview) => updateCustomer({ review: updatedReview })}
            />
          </div>
        ) : null}
        {customer.custom_fields.length > 0 ? (
          <Card asChild>
            <section className="break-inside-avoid">
              <CardContent asChild>
                <header>
                  <h3 className="grow">{t("seller.customerDetail.information_provided")}</h3>
                </header>
              </CardContent>
              {customer.custom_fields.map((field, idx) => {
                const content = (
                  <CardContent asChild>
                    <section key={idx}>
                      <h5 className="grow font-bold">{field.attribute}</h5>
                      {field.type === "text" ? (
                        field.value
                      ) : (
                        <Rows role="list" className="mt-2">
                          {field.files.map((file) => (
                            <FileRow file={file} key={file.key} />
                          ))}
                        </Rows>
                      )}
                    </section>
                  </CardContent>
                );
                return field.type === "file" ? <div key={idx}>{content}</div> : content;
              })}
            </section>
          </Card>
        ) : null}
        {customer.has_options && !isCoffee && customer.product.native_type !== "call" ? (
          <div className="break-inside-avoid">
            <OptionSection
              option={customer.option}
              onChange={(option) => updateCustomer({ option })}
              purchaseId={customer.id}
              productPermalink={customer.product.permalink}
              isSubscription={!!subscription}
              quantity={customer.quantity}
            />
          </div>
        ) : null}
        {customer.is_bundle_purchase ? (
          <Card asChild>
            <section className="break-inside-avoid">
              <CardContent asChild>
                <header>
                  <h3 className="grow">{t("seller.customerDetail.content")}</h3>
                </header>
              </CardContent>
              {productPurchases.length > 0 ? (
                productPurchases.map((productPurchase) => (
                  <CardContent asChild key={productPurchase.id}>
                    <section>
                      <h5 className="grow font-bold">{productPurchase.product.name}</h5>
                      <NavigationButtonInertia href={Routes.customer_sale_path(productPurchase.id)}>
                        {t("seller.customerDetail.manage")}
                      </NavigationButtonInertia>
                    </section>
                  </CardContent>
                ))
              ) : (
                <CardContent asChild>
                  <section>
                    <div className="grow text-center">
                      <LoadingSpinner className="size-8" />
                    </div>
                  </section>
                </CardContent>
              )}
            </section>
          </Card>
        ) : null}
        {license ? (
          <div className="break-inside-avoid">
            <LicenseSection
              license={license}
              onSave={(enabled) =>
                updateLicense(license.id, enabled).then(
                  () => {
                    showAlert(t("seller.customerDetail.changes_saved"), "success");
                    updateCustomer({ license: { ...license, enabled } });
                  },
                  (e: unknown) => {
                    assertResponseError(e);
                    showAlert(e.message, "error");
                  },
                )
              }
              onSetUses={(uses) =>
                setLicenseUses(license.id, uses).then(
                  (updatedUses) => {
                    showAlert(t("seller.customerDetail.license_uses_updated"), "success");
                    updateCustomer({ license: { ...license, uses: updatedUses } });
                  },
                  (e: unknown) => {
                    assertResponseError(e);
                    showAlert(e.message, "error");
                    throw e;
                  },
                )
              }
              onAdjustUses={(delta) =>
                adjustLicenseUses(license.id, delta).then(
                  (updatedUses) => {
                    showAlert(t("seller.customerDetail.license_uses_updated"), "success");
                    updateCustomer({ license: { ...license, uses: updatedUses } });
                  },
                  (e: unknown) => {
                    assertResponseError(e);
                    showAlert(e.message, "error");
                  },
                )
              }
            />
          </div>
        ) : null}
        {customer.is_multiseat_license ? (
          <div className="break-inside-avoid">
            <SeatSection
              seats={customer.quantity}
              onSave={(quantity) =>
                updatePurchase(customer.id, { quantity }).then(
                  () => {
                    showAlert(t("seller.customerDetail.seats_updated"), "success");
                    updateCustomer({ quantity });
                  },
                  (e: unknown) => {
                    assertResponseError(e);
                    showAlert(e.message, "error");
                  },
                )
              }
            />
          </div>
        ) : null}
        {shipping ? (
          <Card className="break-inside-avoid">
            {shipping.tracking ? (
              <CardContent>
                <TrackingSection
                  tracking={shipping.tracking}
                  onMarkShipped={(url) =>
                    markShipped(customer.id, url).then(
                      () => {
                        showAlert(t("seller.customerDetail.changes_saved"), "success");
                        updateCustomer({ shipping: { ...shipping, tracking: { url, shipped: true } } });
                      },
                      (e: unknown) => {
                        assertResponseError(e);
                        showAlert(e.message, "error");
                      },
                    )
                  }
                />
              </CardContent>
            ) : null}
            <CardContent>
              <AddressSection
                address={shipping.address}
                price={shipping.price}
                onSave={(address) =>
                  updatePurchase(customer.id, address).then(
                    () => {
                      showAlert(t("seller.customerDetail.changes_saved"), "success");
                      updateCustomer({ shipping: { ...shipping, address } });
                    },
                    (e: unknown) => {
                      assertResponseError(e);
                      showAlert(e.message, "error");
                    },
                  )
                }
                countries={countries}
              />
            </CardContent>
          </Card>
        ) : null}
        {customer.call ? (
          <div className="break-inside-avoid">
            <CallSection call={customer.call} onChange={(call) => updateCustomer({ call })} />
          </div>
        ) : null}
        {!showCharges && !customer.refunded && !customer.chargedback && customer.price.cents_refundable > 0 ? (
          <Card asChild>
            <section className="break-inside-avoid">
              <CardContent asChild>
                <header>
                  <h3 className="grow">{t("seller.customerDetail.refund")}</h3>
                </header>
              </CardContent>
              <CardContent asChild>
                <section>
                  <RefundForm
                    purchaseId={customer.id}
                    currencyType={customer.price.currency_type}
                    amountRefundable={customer.price.cents_refundable}
                    showRefundFeeNotice={showRefundFeeNotice}
                    paypalRefundExpired={customer.paypal_refund_expired}
                    modalTitle={t("seller.customerDetail.purchase_refund")}
                    modalText={t("seller.customerDetail.confirm_purchase_refund")}
                    onChange={(amountRefundable) =>
                      updateCustomer({
                        price: { ...customer.price, cents_refundable: amountRefundable },
                        refunded: amountRefundable === 0,
                        partially_refunded: amountRefundable > 0 && amountRefundable < customer.price.cents_refundable,
                      })
                    }
                    className="grow basis-0"
                  />
                </section>
              </CardContent>
            </section>
          </Card>
        ) : null}
        {subscription?.status === "alive" || subscription?.status === "payment_method_update_required" ? (
          <div className="break-inside-avoid">
            <SubscriptionCancellationSection
              isInstallmentPlan={subscription.is_installment_plan}
              onCancel={() =>
                void cancelSubscription(subscription.id).then(
                  () => {
                    showAlert(t("seller.customerDetail.changes_saved"), "success");
                    updateCustomer({ subscription: { ...subscription, status: "pending_cancellation" } });
                  },
                  (e: unknown) => {
                    assertResponseError(e);
                    showAlert(e.message, "error");
                  },
                )
              }
            />
          </div>
        ) : null}
        {canPing && !subscription ? (
          <Card asChild>
            <section className="break-inside-avoid">
              <CardContent>
                <PingButton purchaseId={customer.id} className="grow basis-0" />
              </CardContent>
            </section>
          </Card>
        ) : null}
        {customer.is_access_revoked !== null && !isCoffee && !commission ? (
          <div className="break-inside-avoid">
            <AccessSection
              purchaseId={customer.id}
              onChange={(isAccessRevoked) => updateCustomer({ is_access_revoked: isAccessRevoked })}
              isAccessRevoked={customer.is_access_revoked}
            />
          </div>
        ) : null}
        {showCharges ? (
          <div className="break-inside-avoid">
            <ChargesSection
              charges={charges}
              remainingCharges={subscription?.remaining_charges ?? null}
              onChange={setCharges}
              showRefundFeeNotice={showRefundFeeNotice}
              canPing={canPing}
              customerEmail={customer.email}
              loading={false}
            />
          </div>
        ) : null}
        {commission ? (
          <div className="break-inside-avoid">
            <CommissionSection
              commission={commission}
              onChange={(commission) => {
                updateCustomer({ commission });
                if (commission.status === "completed") {
                  void getCharges(customer.id, customer.email).then(setCharges);
                }
              }}
            />
          </div>
        ) : null}
        {emails.length !== 0 ? (
          <Card asChild>
            <section className="break-inside-avoid">
              <CardContent asChild>
                <header>
                  <h3 className="grow">{t("seller.customerDetail.emails_received")}</h3>
                </header>
              </CardContent>
              {emails.slice(0, shownEmails).map((email) => (
                <CardContent asChild key={email.id}>
                  <section>
                    <div className="grow">
                      <h5>
                        {email.type === "receipt" ? (
                          <a href={email.url} target="_blank" rel="noreferrer">
                            {email.name}
                          </a>
                        ) : (
                          email.name
                        )}
                      </h5>
                      <small className="block text-muted">{`${email.state} ${formatDateWithoutTime(new Date(email.state_at))}`}</small>
                    </div>
                    {email.type === "receipt" ? (
                      <Button
                        color="primary"
                        onClick={() => void onSend(email.id, "receipt")}
                        disabled={!!loadingId || sentEmailIds.current.has(email.id)}
                      >
                        {sentEmailIds.current.has(email.id)
                          ? t("seller.customerDetail.receipt_resent")
                          : loadingId === email.id
                            ? t("seller.customerDetail.resending_receipt")
                            : t("seller.customerDetail.resend_receipt")}
                      </Button>
                    ) : (
                      <Button
                        color="primary"
                        onClick={() => void onSend(email.id, "post")}
                        disabled={!!loadingId || sentEmailIds.current.has(email.id)}
                      >
                        {sentEmailIds.current.has(email.id)
                          ? t("seller.customerDetail.sent")
                          : loadingId === email.id
                            ? t("seller.customerDetail.sending")
                            : t("seller.customerDetail.resend_email")}
                      </Button>
                    )}
                  </section>
                </CardContent>
              ))}
              {shownEmails < emails.length ? (
                <CardContent asChild>
                  <section>
                    <Button onClick={() => setShownEmails((prev) => prev + PAGE_SIZE)} className="grow basis-0">
                      {t("seller.customerDetail.load_more")}
                    </Button>
                  </section>
                </CardContent>
              ) : null}
            </section>
          </Card>
        ) : null}
        <div className="break-inside-avoid">
          <Deferred
            data={["missed_posts"]}
            fallback={
              <Card asChild>
                <section>
                  <CardContent asChild>
                    <header>
                      <h3 className="grow">{t("seller.customerDetail.send_missed_posts")}</h3>
                    </header>
                  </CardContent>
                  <CardContent>
                    <LoadingSpinner className="mx-auto size-8" />
                  </CardContent>
                </section>
              </Card>
            }
          >
            {missedPosts.length !== 0 ? (
              <Card asChild>
                <section>
                  <CardContent asChild>
                    <header>
                      <h3 className="grow">{t("seller.customerDetail.send_missed_posts")}</h3>
                    </header>
                  </CardContent>
                  {missedPosts.slice(0, shownMissedPosts).map((post) => (
                    <CardContent asChild key={post.id}>
                      <section>
                        <div className="grow">
                          <h5 className="font-bold">
                            <a href={post.url} target="_blank" rel="noreferrer">
                              {post.name}
                            </a>
                          </h5>
                          <small className="block text-muted">
                            {t("seller.customerDetail.originally_sent_on", {
                              date: formatDateWithoutTime(new Date(post.published_at)),
                            })}
                          </small>
                        </div>
                        <Button
                          color="primary"
                          disabled={!!loadingId || sentEmailIds.current.has(post.id)}
                          onClick={() => void onSend(post.id, "post")}
                        >
                          {sentEmailIds.current.has(post.id)
                            ? t("seller.customerDetail.sent")
                            : loadingId === post.id
                              ? t("seller.customerDetail.sending")
                              : t("seller.customerDetail.send_email")}
                        </Button>
                      </section>
                    </CardContent>
                  ))}
                  {shownMissedPosts < missedPosts.length ? (
                    <CardContent asChild>
                      <section>
                        <Button
                          onClick={() => setShownMissedPosts((prev) => prev + PAGE_SIZE)}
                          className="grow basis-0"
                        >
                          {t("seller.analytics.show_more")}
                        </Button>
                      </section>
                    </CardContent>
                  ) : null}
                </section>
              </Card>
            ) : null}
          </Deferred>
        </div>
      </ColumnLayout>
    </div>
  );
};

const CommissionStatusPill = ({ commission }: { commission: Commission }) => (
  <Pill
    size="small"
    color={commission.status === "completed" ? "primary" : commission.status === "cancelled" ? "danger" : undefined}
  >
    {commission.status === "in_progress"
      ? t("seller.customerDetail.commission_in_progress")
      : commission.status === "completed"
        ? t("seller.customerDetail.commission_completed_badge")
        : t("seller.customerDetail.commission_cancelled")}
  </Pill>
);

const UtmLinkCard = ({ link }: { link: Customer["utm_link"] }) => {
  if (!link) return null;

  return (
    <Card asChild>
      <section>
        <CardContent asChild>
          <section>
            <h3 className="grow">{t("seller.customerDetail.utm_link")}</h3>
          </section>
        </CardContent>
        <CardContent>
          <Alert className="grow text-sm" role="status" variant="info">
            {t("seller.customerDetail.utm_alert")}{" "}
            <a href={link.utm_url} target="_blank" rel="noreferrer">
              {t("seller.customerDetail.utm_link_text")}
            </a>
            .
          </Alert>
        </CardContent>
        <CardContent>
          <DefinitionList>
            <dt>{t("seller.customerDetail.utm_title")}</dt>
            <dd>
              <a href={Routes.dashboard_utm_links_path({ query: link.title })} target="_blank" rel="noreferrer">
                {link.title}
              </a>
            </dd>
            <dt>{t("seller.customerDetail.utm_source")}</dt>
            <dd>{link.source}</dd>
            <dt>{t("seller.customerDetail.utm_medium")}</dt>
            <dd>{link.medium}</dd>
            <dt>{t("seller.customerDetail.utm_campaign")}</dt>
            <dd>{link.campaign}</dd>
            {link.term ? (
              <>
                <dt>{t("seller.customerDetail.utm_term")}</dt>
                <dd>{link.term}</dd>
              </>
            ) : null}
            {link.content ? (
              <>
                <dt>{t("seller.customerDetail.utm_content")}</dt>
                <dd>{link.content}</dd>
              </>
            ) : null}
          </DefinitionList>
        </CardContent>
      </section>
    </Card>
  );
};

const AddressSection = ({
  address: currentAddress,
  price,
  onSave,
  countries,
}: {
  address: Address;
  price: string;
  onSave: (address: Address) => Promise<void>;
  countries: string[];
}) => {
  const uid = React.useId();
  const [address, setAddress] = React.useState(currentAddress);
  const updateShipping = (update: Partial<Address>) => setAddress((prev) => ({ ...prev, ...update }));
  const [isEditing, setIsEditing] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    await onSave(address);
    setIsLoading(false);
    setIsEditing(false);
  };

  return (
    <section className="grow">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="grow">{t("seller.customerDetail.shipping_address")}</h3>
        {!isEditing ? (
          <LinkButton className="text-sm" onClick={() => setIsEditing(true)}>
            {t("actions.edit")}
          </LinkButton>
        ) : null}
      </div>
      {isEditing ? (
        <div className="flex flex-col gap-4">
          <Fieldset>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-full-name`}>{t("seller.customerDetail.full_name")}</Label>
            </FieldsetTitle>
            <Input
              id={`${uid}-full-name`}
              type="text"
              value={address.full_name}
              onChange={(evt) => updateShipping({ full_name: evt.target.value })}
            />
          </Fieldset>
          <Fieldset>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-street-address`}>{t("seller.customerDetail.street_address")}</Label>
            </FieldsetTitle>
            <Input
              id={`${uid}-street-address`}
              type="text"
              value={address.street_address}
              onChange={(evt) => updateShipping({ street_address: evt.target.value })}
            />
          </Fieldset>
          <div className="grid grid-cols-3 gap-2">
            <Fieldset>
              <FieldsetTitle>
                <Label htmlFor={`${uid}-city`}>{t("seller.customerDetail.city")}</Label>
              </FieldsetTitle>
              <Input
                id={`${uid}-city`}
                type="text"
                value={address.city}
                onChange={(evt) => updateShipping({ city: evt.target.value })}
              />
            </Fieldset>
            <Fieldset>
              <FieldsetTitle>
                <Label htmlFor={`${uid}-state`}>{t("seller.customerDetail.state")}</Label>
              </FieldsetTitle>
              <Input
                id={`${uid}-state`}
                type="text"
                value={address.state}
                onChange={(evt) => updateShipping({ state: evt.target.value })}
              />
            </Fieldset>
            <Fieldset>
              <FieldsetTitle>
                <Label htmlFor={`${uid}-zip-code`}>{t("seller.customerDetail.zip_code")}</Label>
              </FieldsetTitle>
              <Input
                id={`${uid}-zip-code`}
                type="text"
                value={address.zip_code}
                onChange={(evt) => updateShipping({ zip_code: evt.target.value })}
              />
            </Fieldset>
          </div>
          <Fieldset>
            <Label htmlFor={`${uid}-country`}>{t("seller.customerDetail.country")}</Label>
            <FormSelect
              id={`${uid}-country`}
              value={address.country}
              onChange={(evt) => updateShipping({ country: evt.target.value })}
            >
              {countries.map((country) => (
                <option value={country} key={country}>
                  {country}
                </option>
              ))}
            </FormSelect>
          </Fieldset>
          <div className="flex gap-2">
            <Button onClick={() => setIsEditing(false)} disabled={isLoading} className="flex-1">
              {t("actions.cancel")}
            </Button>
            <Button color="primary" onClick={() => void handleSave()} disabled={isLoading} className="flex-1">
              {t("actions.save")}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p>
            {currentAddress.full_name}
            <br />
            {currentAddress.street_address}
            <br />
            {`${currentAddress.city}, ${currentAddress.state} ${currentAddress.zip_code}`}
            <br />
            {currentAddress.country}
          </p>
          <p className="mt-2 text-sm text-muted">{t("seller.customerDetail.shipping_charged", { price })}</p>
        </div>
      )}
    </section>
  );
};

const TrackingSection = ({
  tracking,
  onMarkShipped,
}: {
  tracking: Tracking;
  onMarkShipped: (url: string) => Promise<void>;
}) => {
  const [url, setUrl] = React.useState((tracking.shipped ? tracking.url : "") ?? "");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    await onMarkShipped(url);
    setIsLoading(false);
  };

  return (
    <section className="grow">
      <h3 className="mb-4">{t("seller.customerDetail.tracking_information")}</h3>
      {tracking.shipped ? (
        tracking.url ? (
          <NavigationButton color="primary" href={tracking.url} target="_blank" className="w-full">
            {t("seller.customerDetail.track_shipment")}
          </NavigationButton>
        ) : (
          <Alert role="status" variant="success">
            {t("seller.customerDetail.shipped")}
          </Alert>
        )
      ) : (
        <Fieldset>
          <Input
            type="text"
            placeholder={t("seller.customerDetail.tracking_url_placeholder")}
            value={url}
            onChange={(evt) => setUrl(evt.target.value)}
          />
          <Button color="primary" disabled={isLoading} onClick={() => void handleSave()}>
            {t("seller.customerDetail.mark_as_shipped")}
          </Button>
        </Fieldset>
      )}
    </section>
  );
};

const EmailSection = ({
  label,
  email: currentEmail,
  onSave,
  canContact,
  onChangeCanContact,
}: {
  label: string;
  email: string;
  onSave: ((email: string) => Promise<void>) | null;
  canContact?: boolean;
  onChangeCanContact?: (canContact: boolean) => Promise<void>;
}) => {
  const [email, setEmail] = React.useState(currentEmail);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSave = async () => {
    if (!onSave) return;

    const emailError =
      email.length === 0
        ? t("seller.customerDetail.email_required")
        : !isValidEmail(email)
          ? t("seller.customerDetail.email_invalid")
          : null;

    if (emailError) {
      showAlert(emailError, "error");
      return;
    }

    setIsLoading(true);
    await onSave(email);
    setIsLoading(false);
    setIsEditing(false);
  };

  return (
    <Card asChild>
      <section>
        <CardContent asChild>
          <header>
            <h3 className="grow">{label}</h3>
          </header>
        </CardContent>
        {isEditing ? (
          <CardContent asChild>
            <Fieldset>
              <Input
                type="text"
                value={email}
                onChange={(evt) => setEmail(evt.target.value)}
                disabled={isLoading}
                placeholder={label}
                className="grow"
              />
              <div className="flex w-full gap-2">
                <Button
                  onClick={() => {
                    setEmail(currentEmail);
                    setIsEditing(false);
                  }}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {t("actions.cancel")}
                </Button>
                <Button color="primary" onClick={() => void handleSave()} disabled={isLoading} className="flex-1">
                  {t("actions.save")}
                </Button>
              </div>
            </Fieldset>
          </CardContent>
        ) : (
          <CardContent asChild>
            <section>
              <h5 className="grow font-bold">{currentEmail}</h5>
              {onSave ? (
                <LinkButton onClick={() => setIsEditing(true)}>{t("actions.edit")}</LinkButton>
              ) : (
                <small className="block text-muted">{t("seller.customerDetail.cannot_change_existing_email")}</small>
              )}
            </section>
          </CardContent>
        )}
        {onChangeCanContact ? (
          <CardContent asChild>
            <section>
              <Fieldset role="group" className="grow basis-0">
                <Label>
                  {t("seller.customerDetail.receives_emails")}
                  <Checkbox
                    wrapperClassName="ml-auto"
                    checked={canContact}
                    onChange={(evt) => {
                      setIsLoading(true);
                      void onChangeCanContact(evt.target.checked).then(() => setIsLoading(false));
                    }}
                    disabled={isLoading}
                  />
                </Label>
              </Fieldset>
            </section>
          </CardContent>
        ) : null}
      </section>
    </Card>
  );
};

const ReviewVideosSubsections = ({
  review,
  onChange,
  className,
}: {
  review: Review;
  className?: string;
  onChange: (review: Review) => void;
}) => {
  const [loading, setLoading] = React.useState(false);
  const [approvedVideoRemovalModalOpen, setApprovedVideoRemovalModalOpen] = React.useState(false);

  const approvedVideo = review.videos.find((video) => video.approval_status === "approved");
  const pendingVideo = review.videos.find((video) => video.approval_status === "pending_review");

  const approveVideo = async (video: ReviewVideo) => {
    setLoading(true);
    try {
      await approveReviewVideo(video.id);
      onChange({ ...review, videos: [{ ...video, approval_status: "approved" }] });
      showAlert(t("seller.customerDetail.video_live"), "success");
    } catch (e) {
      assertResponseError(e);
      showAlert(t("seller.customerDetail.generic_error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const rejectVideo = async (video: ReviewVideo) => {
    setLoading(true);
    try {
      await rejectReviewVideo(video.id);
      const otherVideos = review.videos.filter((v) => v.id !== video.id);
      onChange({ ...review, videos: [{ ...video, approval_status: "rejected" }, ...otherVideos] });
      showAlert(t("seller.customerDetail.video_removed"), "success");
      setApprovedVideoRemovalModalOpen(false);
    } catch (e) {
      assertResponseError(e);
      showAlert(t("seller.customerDetail.generic_error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const approvedVideoSubsection = approvedVideo ? (
    <section className={className}>
      <div className="flex flex-col gap-4">
        <h5>{t("seller.customerDetail.approved_video")}</h5>
        <ReviewVideoPlayer videoId={approvedVideo.id} thumbnail={approvedVideo.thumbnail_url} />
        <Button onClick={() => setApprovedVideoRemovalModalOpen(true)} disabled={loading}>
          {t("seller.customerDetail.remove")}
        </Button>
        <Modal
          open={approvedVideoRemovalModalOpen}
          onClose={() => setApprovedVideoRemovalModalOpen(false)}
          title={t("seller.customerDetail.remove_approved_video_title")}
          footer={
            <>
              <Button onClick={() => setApprovedVideoRemovalModalOpen(false)} disabled={loading}>
                {t("actions.cancel")}
              </Button>
              <Button color="danger" onClick={() => void rejectVideo(approvedVideo)} disabled={loading}>
                {t("seller.customerDetail.remove_video")}
              </Button>
            </>
          }
        >
          <p>{t("seller.customerDetail.remove_approved_video_desc")}</p>
        </Modal>
      </div>
    </section>
  ) : null;

  const pendingVideoSubsection = pendingVideo ? (
    <section>
      <div className="flex flex-col gap-4">
        <h5>{t("seller.customerDetail.pending_video")}</h5>
        <ReviewVideoPlayer videoId={pendingVideo.id} thumbnail={pendingVideo.thumbnail_url} />
        <div className="flex flex-row gap-2">
          {pendingVideo.can_approve ? (
            <Button
              color="primary"
              className="flex-1"
              onClick={() => void approveVideo(pendingVideo)}
              disabled={loading}
            >
              {t("seller.customerDetail.approve")}
            </Button>
          ) : null}
          {pendingVideo.can_reject ? (
            <Button color="danger" className="flex-1" onClick={() => void rejectVideo(pendingVideo)} disabled={loading}>
              {t("seller.customerDetail.reject")}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  ) : null;

  return approvedVideoSubsection || pendingVideoSubsection ? (
    <>
      {approvedVideoSubsection}
      {pendingVideoSubsection}
    </>
  ) : null;
};

const ReviewSection = ({
  review,
  purchaseId,
  onChange,
}: {
  review: Review;
  purchaseId: string;
  onChange: (review: Review) => void;
}) => (
  <Card asChild>
    <section>
      <CardContent asChild>
        <h3>{t("seller.customerDetail.review")}</h3>
      </CardContent>
      <CardContent asChild>
        <section>
          <h5 className="grow font-bold">{t("seller.customerDetail.rating")}</h5>
          <div aria-label={t("seller.customerDetail.stars", { count: review.rating })}>
            <RatingStars rating={review.rating} />
          </div>
        </section>
      </CardContent>
      {review.message ? (
        <CardContent asChild>
          <section>
            <h5 className="grow font-bold">{t("seller.customerDetail.message")}</h5>
            {review.message}
          </section>
        </CardContent>
      ) : null}
      <CardContent asChild>
        <ReviewVideosSubsections review={review} onChange={onChange} className="grow" />
      </CardContent>
      {review.response ? (
        <CardContent asChild>
          <section>
            <h5 className="grow font-bold">{t("seller.customerDetail.response")}</h5>
            {review.response.message}
          </section>
        </CardContent>
      ) : null}
      <CardContent>
        <ReviewResponseForm
          message={review.response?.message}
          purchaseId={purchaseId}
          onChange={(response) => onChange({ ...review, response })}
          className="w-full"
        />
      </CardContent>
    </section>
  </Card>
);

const OptionSection = ({
  option,
  onChange,
  purchaseId,
  productPermalink,
  isSubscription,
  quantity,
}: {
  option: Option | null;
  onChange: (option: Option) => void;
  purchaseId: string;
  productPermalink: string;
  isSubscription: boolean;
  quantity: number;
}) => {
  const [options, setOptions] = React.useState<Option[]>([]);
  const [selectedOptionId, setSelectedOptionId] = React.useState<{ value: string | null; error?: boolean }>({
    value: option?.id ?? null,
  });
  const [isEditing, setIsEditing] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  useRunOnce(
    () =>
      void getOptions(productPermalink).then(
        (options) => setOptions(option && !options.some(({ id }) => id === option.id) ? [option, ...options] : options),
        (e: unknown) => {
          assertResponseError(e);
          showAlert(e.message, "error");
        },
      ),
  );

  const handleSave = async () => {
    const option = options.find(({ id }) => id === selectedOptionId.value);
    if (!option) return setSelectedOptionId((prev) => ({ ...prev, error: true }));
    try {
      setIsLoading(true);
      await updateOption(purchaseId, option.id, quantity);
      showAlert(t("seller.customerDetail.saved_variant"), "success");
      onChange(option);
      setIsEditing(false);
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    }
    setIsLoading(false);
  };

  const title = isSubscription ? t("seller.customerDetail.tier") : t("seller.customerDetail.version");

  return (
    <Card asChild>
      <section>
        <CardContent asChild>
          <header>
            <h3 className="grow">{title}</h3>
          </header>
        </CardContent>
        <CardContent asChild>
          <section>
            {isEditing && options.length > 0 ? (
              <Fieldset state={selectedOptionId.error ? "danger" : undefined} className="grow basis-0">
                <FormSelect
                  value={selectedOptionId.value ?? t("seller.customerDetail.none_selected")}
                  name={title}
                  onChange={(evt) => setSelectedOptionId({ value: evt.target.value })}
                  aria-invalid={selectedOptionId.error}
                >
                  {!selectedOptionId.value ? <option>{t("seller.customerDetail.none_selected")}</option> : null}
                  {options.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.name}
                    </option>
                  ))}
                </FormSelect>
                <div className="flex w-full gap-2">
                  <Button onClick={() => setIsEditing(false)} disabled={isLoading} className="flex-1">
                    {t("actions.cancel")}
                  </Button>
                  <Button color="primary" onClick={() => void handleSave()} disabled={isLoading} className="flex-1">
                    {t("actions.save")}
                  </Button>
                </div>
              </Fieldset>
            ) : (
              <>
                <h5>{option?.name ?? t("seller.customerDetail.none_selected")}</h5>
                <LinkButton onClick={() => setIsEditing(true)}>{t("actions.edit")}</LinkButton>
              </>
            )}
          </section>
        </CardContent>
      </section>
    </Card>
  );
};

const LicenseSection = ({
  license,
  onSave,
  onSetUses,
  onAdjustUses,
}: {
  license: License;
  onSave: (enabled: boolean) => Promise<void>;
  onSetUses: (uses: number) => Promise<void>;
  onAdjustUses: (delta: number) => Promise<void>;
}) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [confirmingReset, setConfirmingReset] = React.useState(false);
  const [isEditingUses, setIsEditingUses] = React.useState(false);
  const [usesDraft, setUsesDraft] = React.useState<number | null>(license.uses);

  const handleSave = async (enabled: boolean) => {
    setIsLoading(true);
    await onSave(enabled);
    setIsLoading(false);
  };

  const handleSetUses = async (uses: number) => {
    setIsLoading(true);
    try {
      const succeeded = await onSetUses(uses).then(
        () => true,
        () => false,
      );
      return succeeded;
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdjustUses = async (delta: number) => {
    setIsLoading(true);
    try {
      await onAdjustUses(delta);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    // A failed reset keeps the confirmation open so the seller can retry without reopening the flow.
    if (await handleSetUses(0)) setConfirmingReset(false);
  };

  const handleSaveUses = async () => {
    if (usesDraft === null) return;
    // A rejected value stays in the open editor so the seller can correct it instead of retyping.
    if (await handleSetUses(usesDraft)) setIsEditingUses(false);
  };

  const startEditingUses = () => {
    setUsesDraft(license.uses);
    setIsEditingUses(true);
  };

  return (
    <Card asChild>
      <section>
        <CardContent asChild>
          <header>
            <h3 className="grow">{t("seller.customerDetail.license_key")}</h3>
          </header>
        </CardContent>
        <CardContent>
          <pre className="grow break-all whitespace-pre-wrap">
            <code>{license.key}</code>
          </pre>
          {/* Creators pass license keys to buyers manually as part of routine support, so make the
              key copyable in one tap instead of requiring them to select the text — which is
              especially awkward on a phone. */}
          <span className="ml-auto">
            <CopyToClipboard
              text={license.key}
              copyTooltip={t("seller.customerDetail.copy_license_key")}
              tooltipPosition="left"
            >
              <Button outline aria-label={t("seller.customerDetail.copy_license_key")}>
                {t("seller.customerDetail.copy")}
              </Button>
            </CopyToClipboard>
          </span>
        </CardContent>
        {isEditingUses ? (
          <CardContent asChild>
            <Fieldset>
              <NumberInput value={usesDraft} onChange={setUsesDraft}>
                {(props) => (
                  <Input
                    type="number"
                    {...props}
                    min={0}
                    aria-label={t("seller.customerDetail.uses")}
                    className="grow"
                  />
                )}
              </NumberInput>
              <div className="flex w-full gap-2">
                <Button onClick={() => setIsEditingUses(false)} disabled={isLoading} className="flex-1">
                  {t("actions.cancel")}
                </Button>
                <Button
                  color="primary"
                  onClick={() => void handleSaveUses()}
                  disabled={isLoading || usesDraft === null}
                  className="flex-1"
                >
                  {t("actions.save")}
                </Button>
              </div>
            </Fieldset>
          </CardContent>
        ) : (
          <CardContent>
            <h5 className="grow font-bold">{t("seller.customerDetail.uses")}</h5>
            {license.uses}
            <Button
              outline
              disabled={isLoading || license.uses === 0}
              onClick={() => void handleAdjustUses(-1)}
              aria-label={t("seller.customerDetail.decrease_uses")}
              title={t("seller.customerDetail.decrease_uses_by_1")}
            >
              −
            </Button>
            <Button
              outline
              disabled={isLoading}
              onClick={() => void handleAdjustUses(1)}
              aria-label={t("seller.customerDetail.increase_uses")}
              title={t("seller.customerDetail.increase_uses_by_1")}
            >
              +
            </Button>
            <LinkButton onClick={startEditingUses}>{t("actions.edit")}</LinkButton>
            {license.uses > 0 ? (
              <Button
                outline
                disabled={isLoading}
                onClick={() => setConfirmingReset(true)}
                aria-label={t("seller.customerDetail.reset_uses")}
                title={t("seller.customerDetail.reset_uses_to_0")}
              >
                {t("seller.customerDetail.reset")}
              </Button>
            ) : null}
          </CardContent>
        )}
        <Modal
          open={confirmingReset}
          onClose={() => setConfirmingReset(false)}
          title={t("seller.customerDetail.reset_modal_title")}
          footer={
            <>
              <Button disabled={isLoading} onClick={() => setConfirmingReset(false)}>
                {t("actions.cancel")}
              </Button>
              <Button color="primary" disabled={isLoading} onClick={() => void handleReset()}>
                {t("seller.customerDetail.reset")}
              </Button>
            </>
          }
        >
          <p>{t("seller.customerDetail.reset_modal_desc")}</p>
        </Modal>
        <CardContent>
          {license.enabled ? (
            <Button color="danger" disabled={isLoading} onClick={() => void handleSave(false)} className="grow basis-0">
              {t("seller.customerDetail.disable")}
            </Button>
          ) : (
            <Button disabled={isLoading} onClick={() => void handleSave(true)} className="grow basis-0">
              {t("seller.customerDetail.enable")}
            </Button>
          )}
        </CardContent>
      </section>
    </Card>
  );
};

const SeatSection = ({ seats: currentSeats, onSave }: { seats: number; onSave: (seats: number) => Promise<void> }) => {
  const [seats, setSeats] = React.useState(currentSeats);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    await onSave(seats);
    setIsLoading(false);
    setIsEditing(false);
  };

  return (
    <Card asChild>
      <section>
        <CardContent asChild>
          <header>
            <h3 className="grow">{t("seller.customerDetail.seats")}</h3>
          </header>
        </CardContent>
        {isEditing ? (
          <CardContent asChild>
            <Fieldset>
              <NumberInput value={seats} onChange={(seats) => setSeats(seats ?? 0)}>
                {(props) => (
                  <Input
                    type="number"
                    {...props}
                    min={1}
                    aria-label={t("seller.customerDetail.seats")}
                    className="grow"
                  />
                )}
              </NumberInput>
              <div className="flex w-full gap-2">
                <Button onClick={() => setIsEditing(false)} disabled={isLoading} className="flex-1">
                  {t("actions.cancel")}
                </Button>
                <Button color="primary" onClick={() => void handleSave()} disabled={isLoading} className="flex-1">
                  {t("actions.save")}
                </Button>
              </div>
            </Fieldset>
          </CardContent>
        ) : (
          <CardContent asChild>
            <section>
              <h5 className="grow font-bold">{seats}</h5>
              <LinkButton onClick={() => setIsEditing(true)}>{t("actions.edit")}</LinkButton>
            </section>
          </CardContent>
        )}
      </section>
    </Card>
  );
};

const SubscriptionCancellationSection = ({
  onCancel,
  isInstallmentPlan,
}: {
  onCancel: () => void;
  isInstallmentPlan: boolean;
}) => {
  const [open, setOpen] = React.useState(false);
  const constructor = isInstallmentPlan
    ? t("seller.customerDetail.installment_plan")
    : t("seller.customerDetail.subscription");
  return (
    <>
      <Button color="danger" onClick={() => setOpen(true)} className="w-full">
        {t("seller.customerDetail.cancel_item", { name: constructor })}
      </Button>
      <Modal
        open={open}
        title={t("seller.customerDetail.cancel_modal_title", { name: constructor })}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>{t("actions.cancel")}</Button>
            <Button color="accent" onClick={onCancel}>
              {t("seller.customerDetail.cancel_item", { name: constructor })}
            </Button>
          </>
        }
      >
        {t("seller.customerDetail.cancel_modal_desc", { name: constructor })}
      </Modal>
    </>
  );
};

const PingButton = ({ purchaseId, className }: { purchaseId: string; className?: string }) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await resendPing(purchaseId);
      showAlert(t("seller.customerDetail.ping_resent"), "success");
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button color="primary" disabled={isLoading} onClick={() => void handleClick()} className={className}>
      {isLoading ? t("seller.customerDetail.resending_ping") : t("seller.customerDetail.resend_ping")}
    </Button>
  );
};

const AccessSection = ({
  purchaseId,
  isAccessRevoked,
  onChange,
}: {
  purchaseId: string;
  isAccessRevoked: boolean;
  onChange: (accessRevoked: boolean) => void;
}) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = async (revoke: boolean) => {
    setIsLoading(true);
    try {
      if (revoke) {
        await revokeAccess(purchaseId);
        showAlert(t("seller.customerDetail.access_revoked"), "success");
        onChange(true);
      } else {
        await undoRevokeAccess(purchaseId);
        showAlert(t("seller.customerDetail.access_re_enabled"), "success");
        onChange(false);
      }
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    }
    setIsLoading(false);
  };

  return isAccessRevoked ? (
    <Button disabled={isLoading} onClick={() => void handleClick(false)} className="w-full">
      {t("seller.customerDetail.re_enable_access")}
    </Button>
  ) : (
    <Button color="primary" disabled={isLoading} onClick={() => void handleClick(true)} className="w-full">
      {t("seller.customerDetail.revoke_access")}
    </Button>
  );
};

const RefundForm = ({
  purchaseId,
  currencyType,
  amountRefundable,
  showRefundFeeNotice,
  paypalRefundExpired,
  modalTitle,
  modalText,
  onChange,
  onClose,
  className,
}: {
  purchaseId: string;
  currencyType: CurrencyCode;
  amountRefundable: number;
  showRefundFeeNotice: boolean;
  paypalRefundExpired: boolean;
  modalTitle: string;
  modalText: string;
  onChange: (amountRefundable: number) => void;
  onClose?: () => void;
  className?: string;
}) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isModalShowing, setIsModalShowing] = React.useState(false);
  const [refundAmountCents, setRefundAmountCents] = React.useState<{ value: number | null; error?: boolean }>({
    value: amountRefundable,
  });

  const refundAmountRemaining = amountRefundable - (refundAmountCents.value ?? 0);
  const isPartialRefund = refundAmountRemaining > 0;

  const handleRefund = async () => {
    if (!refundAmountCents.value) {
      setIsModalShowing(false);
      return setRefundAmountCents((prev) => ({ ...prev, error: true }));
    }
    try {
      setIsLoading(true);
      await refund(purchaseId, priceCentsToUnit(refundAmountCents.value, getIsSingleUnitCurrency(currencyType)));
      const refundAmountRemaining = amountRefundable - refundAmountCents.value;
      onChange(refundAmountRemaining);
      setRefundAmountCents({ value: refundAmountRemaining });
      showAlert(t("seller.customerDetail.refund_success"), "success");
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    }
    setIsLoading(false);
    setIsModalShowing(false);
  };

  const refundButton = (
    <Button
      color="primary"
      onClick={() => setIsModalShowing(true)}
      disabled={isLoading || paypalRefundExpired}
      className="w-full"
    >
      {isLoading
        ? t("seller.customerDetail.refunding")
        : isPartialRefund
          ? t("seller.customerDetail.issue_partial_refund")
          : t("seller.customerDetail.refund_fully")}
    </Button>
  );

  return (
    <>
      <Fieldset state={refundAmountCents.error ? "danger" : undefined} className={className}>
        <PriceInput
          cents={refundAmountCents.value}
          onChange={(value) => setRefundAmountCents({ value })}
          currencyCode={currencyType}
          placeholder={formatPriceCentsWithoutCurrencySymbol(currencyType, amountRefundable)}
          hasError={refundAmountCents.error ?? false}
        />
        <div className="flex w-full gap-2">
          {onClose ? (
            <Button onClick={onClose} disabled={isLoading} className="flex-1">
              {t("actions.cancel")}
            </Button>
          ) : null}
          <div className="flex-1">
            {paypalRefundExpired ? (
              <WithTooltip tip={t("seller.customerDetail.paypal_refund_expired_tip")} position="top">
                {refundButton}
              </WithTooltip>
            ) : (
              refundButton
            )}
          </div>
        </div>
        {showRefundFeeNotice ? (
          <Alert role="status" variant="info">
            {t("seller.customerDetail.refund_fee_notice")}{" "}
            <a href="/help/article/47-how-to-refund-a-customer" target="_blank" rel="noreferrer">
              {t("actions.learn_more")}
            </a>
          </Alert>
        ) : null}
      </Fieldset>
      <div style={{ display: "contents" }}>
        <Modal
          open={isModalShowing}
          onClose={() => setIsModalShowing(false)}
          title={modalTitle}
          footer={
            <>
              <Button onClick={() => setIsModalShowing(false)} disabled={isLoading}>
                {t("actions.cancel")}
              </Button>
              <Button color="accent" onClick={() => void handleRefund()} disabled={isLoading}>
                {isLoading ? t("seller.customerDetail.refunding") : t("seller.customerDetail.confirm_refund")}
              </Button>
            </>
          }
        >
          {modalText}
        </Modal>
      </div>
    </>
  );
};

const ChargeRow = ({
  purchase,
  customerEmail,
  onChange,
  showRefundFeeNotice,
  canPing,
  className,
}: {
  purchase: Charge;
  customerEmail: string;
  onChange: (update: Partial<Charge>) => void;
  showRefundFeeNotice: boolean;
  canPing: boolean;
  className?: string;
}) => {
  const [isRefunding, setIsRefunding] = React.useState(false);
  const userAgentInfo = useUserAgentInfo();
  const currentSeller = useCurrentSeller();

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h5>
            {t("seller.customerDetail.amount_on_date", {
              amount: formatPrice(purchase.amount_refundable, purchase.currency_type),
              date: new Date(purchase.created_at).toLocaleDateString(userAgentInfo.locale, {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                timeZone: currentSeller?.timeZone.name,
              }),
            })}
          </h5>
          <a
            href={
              purchase.transaction_url_for_seller ?? Routes.receipt_purchase_path(purchase.id, { email: customerEmail })
            }
            target="_blank"
            rel="noreferrer"
            aria-label={t("seller.customerDetail.transaction")}
          >
            <ArrowUpRightSquare className="size-5" />
          </a>
          {purchase.partially_refunded ? (
            <Pill size="small">{t("seller.customerDetail.charge_partial_refund")}</Pill>
          ) : purchase.refunded ? (
            <Pill size="small">{t("seller.customerDetail.charge_refunded")}</Pill>
          ) : null}
          {purchase.is_upgrade_purchase ? (
            <WithTooltip tip={t("seller.customerDetail.charge_upgrade_tip")}>
              <Pill size="small">{t("seller.customerDetail.charge_upgrade")}</Pill>
            </WithTooltip>
          ) : null}
          {purchase.chargedback ? <Pill size="small">{t("seller.customerDetail.charge_chargedback")}</Pill> : null}
        </div>
        <div className="flex items-center gap-2">
          {canPing ? <PingButton purchaseId={purchase.id} /> : null}
          {!purchase.refunded && !purchase.chargedback && purchase.amount_refundable > 0 ? (
            <LinkButton className="text-sm" onClick={() => setIsRefunding((prev) => !prev)}>
              {t("seller.customerDetail.refund_options")}
            </LinkButton>
          ) : null}
        </div>
      </div>
      {isRefunding ? (
        <div className="mt-3">
          <RefundForm
            purchaseId={purchase.id}
            currencyType={purchase.currency_type}
            amountRefundable={purchase.amount_refundable}
            showRefundFeeNotice={showRefundFeeNotice}
            paypalRefundExpired={purchase.paypal_refund_expired}
            modalTitle={t("seller.customerDetail.charge_refund")}
            modalText={t("seller.customerDetail.confirm_charge_refund")}
            onChange={(amountRefundable) => {
              onChange({
                amount_refundable: amountRefundable,
                refunded: amountRefundable === 0,
                partially_refunded: amountRefundable > 0 && amountRefundable < purchase.amount_refundable,
              });
              setIsRefunding(false);
            }}
            onClose={() => setIsRefunding(false)}
          />
        </div>
      ) : null}
    </div>
  );
};

const ChargesSection = ({
  charges,
  remainingCharges,
  onChange,
  showRefundFeeNotice,
  canPing,
  customerEmail,
  loading,
}: {
  charges: Charge[];
  remainingCharges: number | null;
  onChange: (charges: Charge[]) => void;
  showRefundFeeNotice: boolean;
  canPing: boolean;
  customerEmail: string;
  loading: boolean;
}) => {
  const updateCharge = (id: string, update: Partial<Charge>) =>
    onChange(charges.map((charge) => (charge.id === id ? { ...charge, ...update } : charge)));

  return (
    <Card asChild>
      <section>
        <CardContent asChild>
          <header>
            <h3 className="grow">{t("seller.customerDetail.charges")}</h3>
          </header>
        </CardContent>
        {loading ? (
          <CardContent>
            <div className="grow text-center">
              <LoadingSpinner className="size-8" />
            </div>
          </CardContent>
        ) : charges.length > 0 ? (
          <>
            {remainingCharges !== null ? (
              <CardContent>
                <Alert role="status" variant="info">
                  {t("seller.customerDetail.charges_remaining", { count: remainingCharges })}
                </Alert>
              </CardContent>
            ) : null}
            {charges.map((charge) => (
              <CardContent asChild key={charge.id}>
                <section>
                  <ChargeRow
                    purchase={charge}
                    customerEmail={customerEmail}
                    onChange={(update) => updateCharge(charge.id, update)}
                    showRefundFeeNotice={showRefundFeeNotice}
                    canPing={canPing}
                  />
                </section>
              </CardContent>
            ))}
          </>
        ) : (
          <CardContent>
            <p className="text-muted">{t("seller.customerDetail.no_charges_yet")}</p>
          </CardContent>
        )}
      </section>
    </Card>
  );
};

const CallSection = ({ call, onChange }: { call: Call; onChange: (call: Call) => void }) => {
  const currentSeller = useCurrentSeller();
  const [isLoading, setIsLoading] = React.useState(false);
  const [callUrl, setCallUrl] = React.useState(call.call_url ?? "");
  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateCallUrl(call.id, callUrl);
      onChange({ ...call, call_url: callUrl });
      showAlert(t("seller.customerDetail.call_url_updated"), "success");
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    }
    setIsLoading(false);
  };

  return (
    <Card asChild>
      <section>
        <CardContent asChild>
          <header>
            <h3 className="grow">{t("seller.customerDetail.call")}</h3>
          </header>
        </CardContent>
        <CardContent>
          <DefinitionList>
            <dt>{t("seller.customerDetail.start_time")}</dt>
            <dd>
              {formatCallDate(new Date(call.start_time), { timeZone: { userTimeZone: currentSeller?.timeZone.name } })}
            </dd>
            <dt>{t("seller.customerDetail.end_time")}</dt>
            <dd>
              {formatCallDate(new Date(call.end_time), { timeZone: { userTimeZone: currentSeller?.timeZone.name } })}
            </dd>
          </DefinitionList>
        </CardContent>
        <CardContent>
          <form
            onSubmit={(evt) => {
              evt.preventDefault();
              void handleSave();
            }}
            className="w-full"
          >
            <Fieldset>
              <Input
                type="text"
                value={callUrl}
                onChange={(evt) => setCallUrl(evt.target.value)}
                placeholder={t("seller.customerDetail.call_url")}
              />
              <Button color="primary" type="submit" disabled={isLoading} className="w-full">
                {isLoading ? t("actions.saving") : t("actions.save")}
              </Button>
            </Fieldset>
          </form>
        </CardContent>
      </section>
    </Card>
  );
};

const FileRow = ({ file, disabled, onDelete }: { file: File; disabled?: boolean; onDelete?: () => void }) => (
  <Row role="listitem">
    <RowContent>
      <FileKindIcon extension={file.extension} />
      <div>
        <h4>{file.name}</h4>
        <InlineList>
          <li>{file.extension}</li>
          <li>{FileUtils.getFullFileSizeString(file.size)}</li>
        </InlineList>
      </div>
    </RowContent>
    <RowActions>
      {onDelete ? (
        <Button
          color="danger"
          size="icon"
          onClick={onDelete}
          disabled={disabled}
          aria-label={t("seller.customerDetail.delete")}
        >
          <Trash className="size-5" />
        </Button>
      ) : null}
      <NavigationButton
        size="icon"
        href={Routes.s3_utility_cdn_url_for_blob_path({ key: file.key })}
        download
        target="_blank"
        disabled={disabled}
        aria-label={t("actions.download")}
      >
        <ArrowDown pack="filled" className="size-5" />
      </NavigationButton>
    </RowActions>
  </Row>
);

const CommissionSection = ({
  commission,
  onChange,
}: {
  commission: Commission;
  onChange: (commission: Commission) => void;
}) => {
  const [isLoading, setIsLoading] = React.useState(false);

  // Server-provided rather than derived from status: a completion charge that is still settling
  // leaves the commission in_progress, but the server already refuses file changes.
  const filesAreEditable = commission.files_are_editable;

  const handleFileChange = asyncVoid(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;

    setIsLoading(true);

    try {
      const filesToUpload = Array.from(event.target.files);

      const blobs = await Promise.all(
        filesToUpload.map(
          (file) =>
            new Promise<Blob>((resolve, reject) => {
              new DirectUpload(file, Routes.rails_direct_uploads_path()).create((error, blob) => {
                if (error) reject(error);
                else resolve(blob);
              });
            }),
        ),
      );

      await updateCommission(commission.id, [
        ...commission.files.map(({ id }) => id),
        ...blobs.map(({ signed_id }) => signed_id),
      ]);

      onChange({
        ...commission,
        files: [
          ...commission.files,
          ...filesToUpload.map((file, index) => ({
            id: blobs[index]?.signed_id ?? "",
            name: FileUtils.getFileNameWithoutExtension(file.name),
            size: file.size,
            extension: FileUtils.getFileExtension(file.name).toUpperCase(),
            key: blobs[index]?.key ?? "",
          })),
        ],
      });

      showAlert(t("seller.customerDetail.file_uploaded"), "success");
    } catch (e) {
      // DirectUpload rejects with a plain Error, so this cannot use assertResponseError — that
      // re-throws anything that is not a ResponseError and the seller would see no alert at all.
      const message =
        e instanceof ResponseError && e.message ? e.message : t("seller.customerDetail.file_upload_error");
      showAlert(message, "error");
    } finally {
      setIsLoading(false);
    }
  });

  const handleDelete = async (fileId: string) => {
    try {
      setIsLoading(true);
      await updateCommission(
        commission.id,
        commission.files.filter(({ id }) => id !== fileId).map(({ id }) => id),
      );
      onChange({
        ...commission,
        files: commission.files.filter(({ id }) => id !== fileId),
      });
      showAlert(t("seller.customerDetail.file_deleted"), "success");
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompletion = async () => {
    try {
      setIsLoading(true);
      await completeCommission(commission.id);
      onChange({ ...commission, status: "completed", files_are_editable: false });
      showAlert(t("seller.customerDetail.commission_completed"), "success");
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card asChild>
      <section>
        <CardContent asChild>
          <header>
            <h3 className="grow">{t("seller.customerDetail.files")}</h3>
          </header>
        </CardContent>
        {commission.files.length ? (
          <CardContent>
            <Rows role="list">
              {commission.files.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  {...(filesAreEditable ? { onDelete: () => void handleDelete(file.id) } : {})}
                  disabled={isLoading}
                />
              ))}
            </Rows>
          </CardContent>
        ) : null}
        {filesAreEditable ? (
          <CardContent>
            <div className="grid w-full gap-2">
              <label className={buttonVariants({ className: "w-full" })}>
                <input
                  type="file"
                  onChange={handleFileChange}
                  disabled={isLoading}
                  multiple
                  style={{ display: "none" }}
                />
                <Paperclip className="size-5" /> {t("seller.customerDetail.upload_files")}
              </label>
              {commission.status === "in_progress" ? (
                <Button color="primary" disabled={isLoading} onClick={() => void handleCompletion()} className="w-full">
                  {t("seller.customerDetail.submit_and_mark_complete")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        ) : null}
      </section>
    </Card>
  );
};

const BREAKPOINT_MD = 768;
const BREAKPOINT_LG = 1024;

const ColumnLayout = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const [columnCount, setColumnCount] = React.useState(() => {
    if (typeof window === "undefined") return 1;
    if (window.innerWidth >= BREAKPOINT_LG) return 3;
    if (window.innerWidth >= BREAKPOINT_MD) return 2;
    return 1;
  });

  React.useEffect(() => {
    const updateColumns = () => {
      const newCount = window.innerWidth >= BREAKPOINT_LG ? 3 : window.innerWidth >= BREAKPOINT_MD ? 2 : 1;
      setColumnCount((prev) => {
        if (prev !== newCount) setColumnAssignments(null);
        return newCount;
      });
    };
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  const items = React.Children.toArray(children).filter(Boolean);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [columnAssignments, setColumnAssignments] = React.useState<number[] | null>(null);

  React.useLayoutEffect(() => {
    if (columnCount <= 1 || !measureRef.current) {
      setColumnAssignments(null);
      return;
    }

    const actualColumns = Math.min(columnCount, items.length);
    const assignments: number[] = [];
    const childElements = measureRef.current.children;

    let totalHeight = 0;
    for (const child of childElements) {
      totalHeight += child instanceof HTMLElement ? child.offsetHeight : 0;
    }
    const targetPerColumn = totalHeight / actualColumns;

    let currentColumn = 0;
    let currentHeight = 0;
    for (const child of childElements) {
      const itemHeight = child instanceof HTMLElement ? child.offsetHeight : 0;
      if (currentColumn < actualColumns - 1 && currentHeight > 0 && currentHeight + itemHeight / 2 > targetPerColumn) {
        currentColumn++;
        currentHeight = 0;
      }
      assignments.push(currentColumn);
      currentHeight += itemHeight;
    }

    setColumnAssignments(assignments);
  }, [columnCount, items.length]);

  if (columnCount === 1) {
    return <div className={className}>{items}</div>;
  }

  if (columnAssignments === null) {
    return (
      <div ref={measureRef} className={className}>
        {items}
      </div>
    );
  }

  const actualColumns = Math.min(columnCount, items.length);
  const columns: React.ReactNode[][] = Array.from({ length: actualColumns }, () => []);
  items.forEach((item, i) => {
    const col = columnAssignments[i] ?? 0;
    columns[col]?.push(item);
  });

  return (
    <div
      className={className}
      style={{ display: "grid", gridTemplateColumns: `repeat(${actualColumns}, 1fr)`, gap: "2rem" }}
    >
      {columns.map((col, i) => (
        <div key={i} className="flex flex-col gap-8">
          {col}
        </div>
      ))}
    </div>
  );
};

export default CustomerDetailPage;
