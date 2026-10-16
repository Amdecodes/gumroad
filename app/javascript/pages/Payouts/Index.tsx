import { ArrowInDownSquareHalf, Calendar, CheckCircle, Clock, Cog } from "@boxicons/react";
import { Link, router, usePage } from "@inertiajs/react";
import classNames from "classnames";
import { parseISO } from "date-fns";
import * as React from "react";

import { exportPayouts } from "$app/data/balance";
import { formatPriceCentsWithCurrencySymbol, formatPriceCentsWithoutCurrencySymbol } from "$app/utils/currency";
import { useTranslation } from "$app/utils/i18n";
import { asyncVoid } from "$app/utils/promise";
import { assertResponseError } from "$app/utils/request";

import { Button, NavigationButton } from "$app/components/Button";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import { Modal } from "$app/components/Modal";
import { NavigationButtonInertia } from "$app/components/NavigationButton";
import {
  type BankAccount,
  type CurrentPayoutsDataAndPaymentMethodWithUserPayable,
  type PastPayoutsDataAndPaymentMethod,
  type PayoutsProps,
  type PaypalAccount,
} from "$app/components/Payouts";
import { ExportPayoutsPopover } from "$app/components/Payouts/ExportPayoutsPopover";
import { showAlert } from "$app/components/server-components/Alert";
import { Alert } from "$app/components/ui/Alert";
import { Card, CardContent } from "$app/components/ui/Card";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { InputGroup } from "$app/components/ui/InputGroup";
import { Label } from "$app/components/ui/Label";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Pill } from "$app/components/ui/Pill";
import { Placeholder, PlaceholderImage } from "$app/components/ui/Placeholder";
import { Select } from "$app/components/ui/Select";
import { Tab, Tabs } from "$app/components/ui/Tabs";
import { useUserAgentInfo } from "$app/components/UserAgent";
import useRouteLoading from "$app/components/useRouteLoading";
import { WithTooltip } from "$app/components/WithTooltip";

import placeholder from "$assets/images/placeholders/payouts.png";

const MINIMUM_INSTANT_PAYOUT_AMOUNT_CENTS = 100;
const MAXIMUM_INSTANT_PAYOUT_AMOUNT_CENTS = 999900;

type StripeConnectAccount = { payout_method_type: "stripe_connect"; stripe_connect_account_id: string };

type PayoutPeriodData = CurrentPayoutsDataAndPaymentMethodWithUserPayable | PastPayoutsDataAndPaymentMethod;

const Period = ({ payoutPeriodData }: { payoutPeriodData: PayoutPeriodData }) => {
  const { t } = useTranslation();
  const { should_be_shown_currencies_always: showUSDSuffix } = payoutPeriodData;
  const [isCSVDownloadInProgress, setIsCSVDownloadInProgress] = React.useState(false);

  const formatDollarAmount = (amount: number) =>
    `${formatPriceCentsWithCurrencySymbol("usd", Math.abs(amount), {
      symbolFormat: "short",
      noCentsIfWhole: false,
    })} ${showUSDSuffix ? "USD" : ""}`;

  const formatNegativeDollarAmount = (amount: number) => `- ${formatDollarAmount(amount)}`;

  const handleRequestPayoutCSV = asyncVoid(async () => {
    if (!("payment_external_id" in payoutPeriodData)) {
      showAlert(t("seller.payouts.export_error", "Sorry, something went wrong. Please try again."), "error");
      return;
    }

    setIsCSVDownloadInProgress(true);

    try {
      await exportPayouts([payoutPeriodData.payment_external_id]);
      showAlert(
        t(
          "seller.payouts.export_success",
          "You will receive an email in your inbox shortly with the data you've requested.",
        ),
        "success",
      );
    } catch (e) {
      assertResponseError(e);
      showAlert(t("seller.payouts.export_error", "Sorry, something went wrong. Please try again."), "error");
    }
    setIsCSVDownloadInProgress(false);
  });

  function currentPayoutHeading(payoutStatus: string, payoutDateFormatted: string) {
    switch (payoutStatus) {
      case "processing":
        return t(
          "seller.payouts.heading_initiated",
          { date: payoutDateFormatted },
          `Payout initiated on ${payoutDateFormatted}`,
        );
      case "payable":
        return t("seller.payouts.heading_next", { date: payoutDateFormatted }, `Next payout: ${payoutDateFormatted}`);
      case "paused":
        return t("seller.payouts.heading_paused", "Next payout: paused");
      case "completed":
        return payoutDateFormatted;
      default:
        return payoutDateFormatted;
    }
  }

  const heading = currentPayoutHeading(payoutPeriodData.status, payoutPeriodData.payout_date_formatted);

  return (
    <section aria-label={t("seller.payouts.period_aria", "Payout period")}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacer-4)",
        }}
      >
        {payoutPeriodData.status === "completed" ? <span>{heading}</span> : <h2>{heading}</h2>}
        {"type" in payoutPeriodData && payoutPeriodData.type === "instant" ? (
          <Pill size="small">{t("seller.payouts.instant", "Instant")}</Pill>
        ) : null}
        <span style={{ marginLeft: "auto" }}>{payoutPeriodData.displayable_payout_period_range}</span>
        {payoutPeriodData.status === "completed" && payoutPeriodData.payment_external_id ? (
          <Button
            color="primary"
            className="shrink-0"
            disabled={isCSVDownloadInProgress}
            onClick={handleRequestPayoutCSV}
          >
            <ArrowInDownSquareHalf aria-hidden="true" className="size-5" />
            {t("seller.payouts.export", "Export")}
          </Button>
        ) : null}
      </div>
      <Card style={{ marginTop: "var(--spacer-4)" }}>
        <CardContent>
          <h4 className="grow font-bold">{t("seller.payouts.sales", "Sales")}</h4>
          <div>{formatDollarAmount(payoutPeriodData.sales_cents)}</div>
        </CardContent>
        {payoutPeriodData.credits_cents > 0 ? (
          <CardContent>
            <h4 className="grow font-bold">{t("seller.payouts.credits", "Credits")}</h4>
            <div>{formatDollarAmount(payoutPeriodData.credits_cents)}</div>
          </CardContent>
        ) : null}
        {payoutPeriodData.affiliate_credits_cents !== 0 ? (
          <CardContent>
            <h4 className="grow font-bold">
              {t("seller.payouts.affiliate_credits", "Affiliate or collaborator fees received")}
            </h4>
            <div>{formatDollarAmount(payoutPeriodData.affiliate_credits_cents)}</div>
          </CardContent>
        ) : null}
        {payoutPeriodData.discover_fees_cents !== 0 || payoutPeriodData.direct_fees_cents !== 0 ? (
          <>
            {payoutPeriodData.discover_fees_cents !== 0 ? (
              <CardContent>
                <div className="grow">
                  <h4 className="font-bold">
                    {t("seller.payouts.discover_sales", "Discover sales")}{" "}
                    <a href="/help/article/66-gumroads-fees" target="_blank" rel="noreferrer">
                      {t("seller.payouts.fees", "fees")}
                    </a>
                  </h4>
                  {payoutPeriodData.discover_sales_count > 0 ? (
                    <small className="block text-muted">
                      {t(
                        payoutPeriodData.discover_sales_count === 1
                          ? "seller.payouts.sales_count.one"
                          : "seller.payouts.sales_count.other",
                        { count: payoutPeriodData.discover_sales_count },
                        `on ${payoutPeriodData.discover_sales_count} ${payoutPeriodData.discover_sales_count === 1 ? "sale" : "sales"}`,
                      )}
                    </small>
                  ) : null}
                </div>
                <div>{formatNegativeDollarAmount(payoutPeriodData.discover_fees_cents)}</div>
              </CardContent>
            ) : null}
            {payoutPeriodData.direct_fees_cents !== 0 ? (
              <CardContent>
                <div className="grow">
                  <h4 className="font-bold">
                    {t("seller.payouts.direct_sales", "Direct sales")}{" "}
                    <a href="/help/article/66-gumroads-fees" target="_blank" rel="noreferrer">
                      {t("seller.payouts.fees", "fees")}
                    </a>
                  </h4>
                  {payoutPeriodData.direct_sales_count > 0 ? (
                    <small className="block text-muted">
                      {t(
                        payoutPeriodData.direct_sales_count === 1
                          ? "seller.payouts.sales_count.one"
                          : "seller.payouts.sales_count.other",
                        { count: payoutPeriodData.direct_sales_count },
                        `on ${payoutPeriodData.direct_sales_count} ${payoutPeriodData.direct_sales_count === 1 ? "sale" : "sales"}`,
                      )}
                    </small>
                  ) : null}
                </div>
                <div>{formatNegativeDollarAmount(payoutPeriodData.direct_fees_cents)}</div>
              </CardContent>
            ) : null}
          </>
        ) : (
          <CardContent>
            <h4 className="grow font-bold">
              <a href="/help/article/66-gumroads-fees" target="_blank" rel="noreferrer">
                {t("seller.payouts.fees", "Fees")}
              </a>
            </h4>
            <div>{formatNegativeDollarAmount(payoutPeriodData.fees_cents)}</div>
          </CardContent>
        )}
        {payoutPeriodData.refunds_cents !== 0 ? (
          <CardContent>
            <h4 className="grow font-bold">{t("seller.payouts.refunds", "Refunds")}</h4>
            <div>{formatNegativeDollarAmount(payoutPeriodData.refunds_cents)}</div>
          </CardContent>
        ) : null}
        {payoutPeriodData.chargebacks_cents !== 0 ? (
          <CardContent>
            <h4 className="grow font-bold">
              <a href="/help/article/134-how-does-gumroad-handle-chargebacks" target="_blank" rel="noreferrer">
                {t("seller.payouts.chargebacks", "Chargebacks")}
              </a>
            </h4>
            <div>{formatNegativeDollarAmount(payoutPeriodData.chargebacks_cents)}</div>
          </CardContent>
        ) : null}
        {payoutPeriodData.credits_cents < 0 ? (
          <CardContent>
            <h4 className="grow font-bold">
              <a href="/help/article/269-balance-page" target="_blank" rel="noreferrer">
                {t("seller.payouts.credits", "Credits")}
              </a>
            </h4>
            <div>{formatNegativeDollarAmount(payoutPeriodData.credits_cents)}</div>
          </CardContent>
        ) : null}
        {payoutPeriodData.loan_repayment_cents !== 0 ? (
          <CardContent>
            <h4 className="grow font-bold">{t("seller.payouts.loan_repayments", "Loan repayments")}</h4>
            <div>{formatNegativeDollarAmount(payoutPeriodData.loan_repayment_cents)}</div>
          </CardContent>
        ) : null}
        {payoutPeriodData.affiliate_fees_cents !== 0 ? (
          <CardContent>
            <h4 className="grow font-bold">
              {t("seller.payouts.affiliate_fees", "Affiliate or collaborator fees paid")}
            </h4>
            <div>{formatNegativeDollarAmount(payoutPeriodData.affiliate_fees_cents)}</div>
          </CardContent>
        ) : null}
        {payoutPeriodData.paypal_payout_cents !== 0 ? (
          <CardContent>
            <h4 className="grow font-bold">
              <a href="/help/article/275-paypal-connect" target="_blank" rel="noreferrer">
                {t("seller.payouts.paypal_payouts", "PayPal payouts")}
              </a>
            </h4>
            <div>{formatNegativeDollarAmount(payoutPeriodData.paypal_payout_cents)}</div>
          </CardContent>
        ) : null}
        {payoutPeriodData.stripe_connect_payout_cents !== 0 ? (
          <CardContent>
            <h4 className="grow font-bold">
              <a href="/help/article/330-stripe-connect" target="_blank" rel="noreferrer">
                {t("seller.payouts.stripe_connect_payouts", "Stripe Connect payouts")}
              </a>
            </h4>
            <div>{formatNegativeDollarAmount(payoutPeriodData.stripe_connect_payout_cents)}</div>
          </CardContent>
        ) : null}
        {"payout_reserve_cents" in payoutPeriodData &&
        payoutPeriodData.payout_reserve_cents != null &&
        payoutPeriodData.payout_reserve_cents > 0 &&
        payoutPeriodData.payout_reserve_percent != null ? (
          <CardContent>
            <h4 className="grow font-bold">
              {t(
                "seller.payouts.held_in_reserve",
                { percent: payoutPeriodData.payout_reserve_percent },
                `Held in reserve (${payoutPeriodData.payout_reserve_percent}%)`,
              )}
            </h4>
            <div>{formatNegativeDollarAmount(payoutPeriodData.payout_reserve_cents)}</div>
          </CardContent>
        ) : null}
        {payoutPeriodData.taxes_cents !== 0 ? (
          <CardContent>
            <h4 className="grow font-bold">
              <a href="/help/article/121-sales-tax-on-gumroad" target="_blank" rel="noreferrer">
                {t("seller.payouts.taxes", "Taxes")}
              </a>
            </h4>
            <div>
              <WithTooltip
                position="top"
                tip={t(
                  "seller.payouts.taxes_tooltip",
                  "{app_name} does not collect tax for you; this is a calculation to help you with remittance.",
                )}
              >
                <span>{formatDollarAmount(payoutPeriodData.taxes_cents)}</span>
              </WithTooltip>
            </div>
          </CardContent>
        ) : null}
        <CardContent>
          {(() => {
            const isCurrentPeriod = payoutPeriodData.is_current_period;
            switch (payoutPeriodData.payout_method_type) {
              case "stripe_connect":
                if ("stripe_connect_account_id" in payoutPeriodData) {
                  return (
                    <PeriodStripeConnectAccount
                      isCurrentPeriod={isCurrentPeriod}
                      stripeConnectAccount={{
                        ...payoutPeriodData,
                        payout_method_type: "stripe_connect",
                        stripe_connect_account_id: payoutPeriodData.stripe_connect_account_id,
                        payout_currency: payoutPeriodData.payout_currency,
                      }}
                    />
                  );
                }
                return null;
              case "bank":
                return (
                  <PeriodBankAccount
                    isCurrentPeriod={isCurrentPeriod}
                    bankAccount={{
                      ...payoutPeriodData,
                      arrival_date: "arrival_date" in payoutPeriodData ? payoutPeriodData.arrival_date : null,
                      status: payoutPeriodData.status,
                      payout_currency: payoutPeriodData.payout_currency,
                    }}
                  />
                );
              case "paypal":
                return <PeriodPaypalAccount isCurrentPeriod={isCurrentPeriod} paypalAccount={payoutPeriodData} />;
              case "legacy-na":
              case "none":
                return <PeriodNoAccount />;
            }
          })()}
          <div className="payout-amount">
            <span>
              {payoutPeriodData.payout_displayed_amount}
              {payoutPeriodData.status === "payable" && payoutPeriodData.should_be_shown_currencies_always ? "USD" : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

const PeriodEmpty = () => {
  const { t } = useTranslation();
  return (
    <div className="period period-empty full column">
      <Placeholder>
        <PlaceholderImage src={placeholder} />
        <h2>{t("seller.payouts.empty_title", "Let's get you paid.")}</h2>
        {t("seller.payouts.empty_desc", "Reach your minimum payout threshold to be paid out.")}
        <NavigationButton color="accent" href="/settings/payments">
          {t("seller.payouts.view_payout_threshold", "View payout threshold")}
        </NavigationButton>
        <a href="/help/article/269-balance-page">{t("seller.payouts.learn_about_payouts", "Learn about payouts")}</a>
      </Placeholder>
    </div>
  );
};

const PeriodStripeConnectAccount = ({
  isCurrentPeriod,
  stripeConnectAccount,
}: {
  isCurrentPeriod: boolean;
  stripeConnectAccount: StripeConnectAccount & { payout_currency: string };
}) => {
  const { t } = useTranslation();
  return (
    <h4>
      {isCurrentPeriod
        ? stripeConnectAccount.payout_currency.toUpperCase() !== "USD"
          ? t(
              "seller.payouts.will_be_converted_and_sent_to",
              { currency: stripeConnectAccount.payout_currency.toUpperCase() },
              `Will be converted to ${stripeConnectAccount.payout_currency.toUpperCase()} and sent to:`,
            )
          : t("seller.payouts.will_be_sent_to", "Will be sent to:")
        : null}{" "}
      {t("seller.payouts.stripe_account", "Stripe account: ")}
      <a href={`https://dashboard.stripe.com/${stripeConnectAccount.stripe_connect_account_id}`}>
        {stripeConnectAccount.stripe_connect_account_id}
      </a>
    </h4>
  );
};

const PeriodBankAccount = ({
  isCurrentPeriod,
  bankAccount,
}: {
  isCurrentPeriod: boolean;
  bankAccount: BankAccount & { arrival_date?: string | null; status?: string; payout_currency: string };
}) => {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacer-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--spacer-2)" }}>
        {bankAccount.arrival_date ? (
          bankAccount.status === "completed" ? (
            <CheckCircle pack="filled" className="size-5" />
          ) : (
            <Clock className="size-5" />
          )
        ) : null}
        <h4>
          {bankAccount.arrival_date ? (
            <>
              {bankAccount.status === "completed"
                ? t("seller.payouts.deposited_prefix", "Deposited ")
                : t("seller.payouts.expected_deposit_prefix", "Expected deposit ")}
              {"bank_name" in bankAccount && (
                <span>
                  {t("seller.payouts.to_bank", { bank_name: bankAccount.bank_name }, `to ${bankAccount.bank_name} `)}
                </span>
              )}
              <span>
                {t("seller.payouts.on_date", { date: bankAccount.arrival_date }, `on ${bankAccount.arrival_date}`)}
              </span>
            </>
          ) : (
            <>
              {isCurrentPeriod
                ? bankAccount.payout_currency.toUpperCase() !== "USD"
                  ? t(
                      "seller.payouts.will_be_converted_and_sent_to",
                      { currency: bankAccount.payout_currency.toUpperCase() },
                      `Will be converted to ${bankAccount.payout_currency.toUpperCase()} and sent to: `,
                    )
                  : t("seller.payouts.will_be_sent_to", "Will be sent to: ")
                : null}
              {"bank_name" in bankAccount && <span>{bankAccount.bank_name}</span>}
            </>
          )}
        </h4>
      </div>
      <p className="text-xs">
        {bankAccount.bank_account_type === "CANADIAN" ? (
          <>
            <span>
              {t("seller.payouts.transit_number", "Transit number: ")}
              <span>{"transit_number" in bankAccount ? bankAccount.transit_number : ""}</span>
            </span>{" "}
            <span>
              {t("seller.payouts.institution_number", "Institution number: ")}
              <span>{"institution_number" in bankAccount ? bankAccount.institution_number : ""}</span>
            </span>
          </>
        ) : bankAccount.bank_account_type === "CARD" ? (
          <span>
            {t("seller.payouts.card", "Card: ")}
            <span>{"routing_number" in bankAccount ? bankAccount.routing_number : ""}</span>
          </span>
        ) : "routing_number" in bankAccount ? (
          <span>
            {t("seller.payouts.routing_number", "Routing number: ")}
            <span>{bankAccount.routing_number}</span>
          </span>
        ) : null}{" "}
        {"account_number" in bankAccount ? (
          <span>
            {t("seller.payouts.account", "Account: ")}
            <span>{bankAccount.account_number}</span>
          </span>
        ) : null}
      </p>
    </div>
  );
};

const PeriodPaypalAccount = ({
  isCurrentPeriod,
  paypalAccount,
}: {
  isCurrentPeriod: boolean;
  paypalAccount: PaypalAccount;
}) => {
  const { t } = useTranslation();
  return (
    <h4>
      {isCurrentPeriod
        ? t("seller.payouts.will_be_sent_to_paypal", "Will be sent to PayPal account: ")
        : t("seller.payouts.sent_to_paypal", "Sent to PayPal account: ")}{" "}
      <span>{paypalAccount.paypal_address}</span>
    </h4>
  );
};

const PeriodNoAccount = () => {
  const { t } = useTranslation();
  return <h4>{t("seller.payouts.will_be_sent_to", "Will be sent to:")}</h4>;
};

function PayoutLineItem({
  title,
  price,
  className,
}: {
  title: React.ReactNode;
  price: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames("grid grid-flow-col justify-between gap-4", className)}>
      <h4 className="inline-flex flex-wrap gap-2 text-[length:inherit] leading-[inherit]">{title}</h4>
      <div>{price}</div>
    </div>
  );
}

export default function PayoutsIndex() {
  const {
    next_payout_period_data,
    processing_payout_periods_data,
    payouts_status,
    payouts_paused_by,
    payout_reserve_percent,
    instant_payout,
    show_instant_payouts_notice,
    tax_center_enabled,
    past_payout_period_data,
    pagination,
    scheduled_payout,
  } = usePage<PayoutsProps>().props;

  const loggedInUser = useLoggedInUser();
  const userAgentInfo = useUserAgentInfo();
  const isNavigating = useRouteLoading();

  const [isInstantPayoutModalOpen, setIsInstantPayoutModalOpen] = React.useState(false);
  const [instantPayoutId, setInstantPayoutId] = React.useState<string>(instant_payout?.payable_balances[0]?.id ?? "");

  const instantPayoutAmountCents =
    instant_payout?.payable_balances.reduce((sum, balance) => {
      const selectedBalance = instant_payout.payable_balances.find((b) => b.id === instantPayoutId);
      return selectedBalance && balance.date <= selectedBalance.date ? sum + balance.amount_cents : sum;
    }, 0) ?? 0;

  // The fee rate comes from the backend (StripePayoutProcessor::INSTANT_PAYOUT_FEE_PERCENT)
  // so the amount previewed here always matches what the payout processor deducts.
  const instantPayoutFeeFraction = instant_payout ? instant_payout.instant_payout_fee_percent / 100 : 0;
  const instantPayoutFee = instant_payout
    ? instantPayoutAmountCents - Math.floor(instantPayoutAmountCents / (1 + instantPayoutFeeFraction))
    : 0;

  const onRequestInstantPayout = () => {
    if (!instant_payout) return;

    const selectedDate =
      instant_payout.payable_balances.find((balance) => balance.id === instantPayoutId)?.date ??
      new Date().toISOString();

    router.post(
      Routes.instant_payouts_path(),
      { date: selectedDate },
      {
        onStart: () => setIsInstantPayoutModalOpen(false),
        onError: () => {
          showAlert("Failed to initiate instant payout. Please try again.", "error");
        },
      },
    );
  };

  const loadNextPage = () => {
    router.reload({
      data: { page: pagination.page + 1 },
      only: ["past_payout_period_data", "pagination"],
      preserveUrl: true,
    });
  };

  if (!loggedInUser) return null;

  const { t } = useTranslation();

  const settingsAction = loggedInUser.policies.settings_payments_user.show ? (
    <NavigationButtonInertia href={Routes.settings_payments_path()}>
      <Cog pack="filled" className="size-5" />
      {t("seller.payouts.settings", "Settings")}
    </NavigationButtonInertia>
  ) : null;

  const bulkExportAction = loggedInUser.policies.balance.export ? <ExportPayoutsPopover /> : null;

  return (
    <div>
      <PageHeader
        title={t("seller.payouts.title", "Payouts")}
        actions={
          settingsAction || bulkExportAction ? (
            <div className="flex gap-2">
              {settingsAction}
              {bulkExportAction}
            </div>
          ) : undefined
        }
      >
        {tax_center_enabled ? (
          <Tabs>
            <Tab isSelected asChild>
              <Link href={Routes.balance_path()}>{t("seller.payouts.title", "Payouts")}</Link>
            </Tab>
            <Tab isSelected={false} asChild>
              <Link href={Routes.tax_center_path()}>{t("seller.payouts.taxes", "Taxes")}</Link>
            </Tab>
          </Tabs>
        ) : null}
      </PageHeader>
      <div className="space-y-8 p-4 md:p-8">
        {scheduled_payout ? (
          <Alert variant="info" role="status">
            <p>
              {scheduled_payout.action === "payout" ? (
                scheduled_payout.status === "executed" ? (
                  scheduled_payout.payout_amount_cents != null ? (
                    t("seller.payouts.scheduled_payout_executed_with_amount", {
                      amount: formatPriceCentsWithCurrencySymbol("usd", scheduled_payout.payout_amount_cents, {
                        symbolFormat: "short",
                        noCentsIfWhole: false,
                      }),
                    })
                  ) : (
                    t("seller.payouts.scheduled_payout_executed")
                  )
                ) : (
                  <>
                    {scheduled_payout.payout_amount_cents != null
                      ? t("seller.payouts.scheduled_payout_scheduled_with_amount", {
                          amount: formatPriceCentsWithCurrencySymbol("usd", scheduled_payout.payout_amount_cents, {
                            symbolFormat: "short",
                            noCentsIfWhole: false,
                          }),
                          date: new Date(scheduled_payout.scheduled_at).toLocaleDateString(),
                        })
                      : t("seller.payouts.scheduled_payout_scheduled", {
                          date: new Date(scheduled_payout.scheduled_at).toLocaleDateString(),
                        })}
                    {scheduled_payout.status === "flagged" ? ` ${t("seller.payouts.scheduled_payout_flagged")}` : null}
                  </>
                )
              ) : scheduled_payout.action === "refund" ? (
                scheduled_payout.status === "executed" ? (
                  t("seller.payouts.scheduled_refund_executed")
                ) : (
                  t("seller.payouts.scheduled_refund_scheduled", {
                    date: new Date(scheduled_payout.scheduled_at).toLocaleDateString(),
                  })
                )
              ) : (
                t("seller.payouts.scheduled_on_hold")
              )}
            </p>
          </Alert>
        ) : null}
        {!instant_payout ? (
          show_instant_payouts_notice ? (
            <Alert variant="info" role="status">
              <p>
                {t("seller.payouts.enable_instant_payouts_prefix")} <strong>{t("seller.payouts.instant")}</strong>{" "}
                {t("seller.payouts.enable_instant_payouts_middle")}{" "}
                <a href={Routes.settings_payments_path()}>{t("seller.payouts.update_payout_method")}</a>{" "}
                {t("seller.payouts.to_one_of_the")}{" "}
                <a href="https://docs.stripe.com/payouts/instant-payouts-banks">
                  {t("seller.payouts.supported_bank_accounts_or_debit_cards")}
                </a>
                .
              </p>
            </Alert>
          ) : null
        ) : instant_payout.payable_amount_cents >= MINIMUM_INSTANT_PAYOUT_AMOUNT_CENTS ? (
          <Alert variant="info" role="status">
            <div>
              <b>
                {t(
                  "seller.payouts.instant_payout_available_intro",
                  {
                    amount: formatPriceCentsWithCurrencySymbol("usd", instant_payout.payable_amount_cents, {
                      symbolFormat: "short",
                      noCentsIfWhole: false,
                    }),
                  },
                  "You have {amount} available for instant payout:",
                )}
              </b>{" "}
              {t("seller.payouts.instant_payout_no_need_to_wait", "No need to wait—get paid now!")}
              <div style={{ marginTop: "var(--spacer-3)" }}>
                {instant_payout.payable_balances.some(
                  (balance) => balance.amount_cents > MAXIMUM_INSTANT_PAYOUT_AMOUNT_CENTS,
                ) ? (
                  <a href="mailto:support@gumroad.com">
                    {t("seller.payouts.contact_us_for_instant_payout", "Contact us for an instant payout")}
                  </a>
                ) : (
                  <Button
                    size="sm"
                    color="primary"
                    aria-label={t("seller.payouts.get_paid", "Get paid!")}
                    onClick={() => setIsInstantPayoutModalOpen(true)}
                  >
                    {t("seller.payouts.get_paid", "Get paid!")}
                  </Button>
                )}
              </div>
            </div>
            <Modal
              open={isInstantPayoutModalOpen}
              onClose={() => setIsInstantPayoutModalOpen(false)}
              footer={
                <>
                  <Button onClick={() => setIsInstantPayoutModalOpen(false)}>
                    {t("seller.payouts.cancel", "Cancel")}
                  </Button>
                  <Button color="primary" disabled={isNavigating} onClick={onRequestInstantPayout}>
                    {t("seller.payouts.get_paid", "Get paid!")}
                  </Button>
                </>
              }
              title={t("seller.payouts.instant_payout_modal_title", "Instant payout")}
            >
              <p>
                {t(
                  "seller.payouts.instant_payout_modal_desc",
                  "You can request instant payouts 24/7, including weekends and holidays. Funds typically appear in your bank account within 30 minutes, though some payouts may take longer to be credited.",
                )}
              </p>
              <Fieldset>
                <Label htmlFor="instant-payout-date">
                  {t("seller.payouts.pay_out_balance_up_to", "Pay out balance up to")}
                </Label>
                <InputGroup className="cursor-pointer pr-0">
                  <Calendar className="size-5" />
                  <Select
                    id="instant-payout-date"
                    value={instantPayoutId}
                    onChange={(e) => setInstantPayoutId(e.target.value)}
                    wrapperClassName="flex-1"
                    className="border-none outline-none"
                  >
                    {instant_payout.payable_balances.map((balance) => (
                      <option key={balance.id} value={balance.id}>
                        {parseISO(balance.date).toLocaleDateString(userAgentInfo.locale, {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </option>
                    ))}
                  </Select>
                </InputGroup>
              </Fieldset>
              <Fieldset>
                <FieldsetTitle>{t("seller.payouts.payout_details", "Payout details")}</FieldsetTitle>
                <div className="rounded-sm border border-border bg-background not-first:border-t">
                  <div className="grid gap-4 p-4">
                    <div className="grid grid-flow-col justify-between gap-4">
                      <h4 className="inline-flex flex-wrap gap-2">{t("seller.payouts.sent_to", "Sent to")}</h4>
                      <div>
                        {instant_payout.bank_account_type === "CARD" ? (
                          <p>
                            <span>
                              {instant_payout.routing_number} {instant_payout.account_number}
                            </span>
                          </p>
                        ) : (
                          <div>
                            {instant_payout.bank_name ? <p className="text-right">{instant_payout.bank_name}</p> : null}
                            <p className="text-right">
                              {t("seller.payouts.routing_number", "Routing number: ")}
                              <span>{instant_payout.routing_number}</span>
                            </p>
                            <p className="text-right">
                              {t("seller.payouts.account", "Account: ")}
                              <span>{instant_payout.account_number}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <PayoutLineItem
                      title={t("seller.payouts.amount", "Amount")}
                      price={`$${formatPriceCentsWithoutCurrencySymbol("usd", instantPayoutAmountCents)}`}
                    />
                    <PayoutLineItem
                      title={t(
                        "seller.payouts.instant_payout_fee",
                        { percent: instant_payout.instant_payout_fee_percent },
                        `Instant payout fee (${instant_payout.instant_payout_fee_percent}%)`,
                      )}
                      price={`-$${formatPriceCentsWithoutCurrencySymbol("usd", instantPayoutFee)}`}
                    />
                  </div>
                  <footer className="grid gap-4 border-t border-border p-4">
                    <PayoutLineItem
                      title={t("seller.payouts.you_will_receive", "You'll receive")}
                      price={`$${formatPriceCentsWithoutCurrencySymbol("usd", instantPayoutAmountCents - instantPayoutFee)}`}
                      className="text-lg"
                    />
                  </footer>
                </div>
                {instantPayoutAmountCents > MAXIMUM_INSTANT_PAYOUT_AMOUNT_CENTS ? (
                  <Alert variant="info" role="status">
                    {t(
                      "seller.payouts.instant_payout_split_notice",
                      "Your balance exceeds the maximum amount for a single instant payout, so we'll automatically split your balance into multiple payouts.",
                    )}
                  </Alert>
                ) : null}
              </Fieldset>
            </Modal>
          </Alert>
        ) : instant_payout.unpaid_amount_cents > 0 ? (
          <Alert variant="info" role="status">
            <div>
              <b>
                {t(
                  "seller.payouts.instant_payout_unsettled_intro",
                  {
                    amount: formatPriceCentsWithCurrencySymbol("usd", instant_payout.unpaid_amount_cents, {
                      symbolFormat: "short",
                      noCentsIfWhole: false,
                    }),
                  },
                  "You have {amount} that hasn't settled yet.",
                )}
              </b>{" "}
              {t(
                "seller.payouts.instant_payout_unsettled_desc",
                "Instant payout will be available here as soon as at least $1 of that balance clears, usually within a few days.",
              )}
              <div style={{ marginTop: "var(--spacer-3)" }}>
                <Button size="sm" color="primary" aria-label={t("seller.payouts.get_paid", "Get paid!")} disabled>
                  {t("seller.payouts.get_paid", "Get paid!")}
                </Button>
              </div>
            </div>
          </Alert>
        ) : null}
        {payouts_status === "paused" ? (
          <Alert variant="warning" role="status">
            <p>
              {payouts_paused_by === "stripe" ? (
                <strong>
                  {t(
                    "seller.payouts.payouts_paused_by_stripe",
                    "Your payouts are currently paused by Stripe. Please check your Payment Settings for any verification requirements.",
                  )}
                </strong>
              ) : payouts_paused_by === "admin" ? (
                <strong>
                  {t("seller.payouts.payouts_paused_by_app", "Your payouts have been paused by {app_name}.")}
                </strong>
              ) : payouts_paused_by === "system" && payout_reserve_percent ? (
                <strong>
                  {t(
                    "seller.payouts.payouts_paused_by_reserve",
                    { percent: payout_reserve_percent },
                    "We're holding {percent}% of your balance in reserve while your chargeback rate is above 1.5%. The rest pays out on the normal weekly schedule.",
                  )}
                </strong>
              ) : payouts_paused_by === "system" ? (
                <strong>
                  {t(
                    "seller.payouts.payouts_paused_by_security",
                    "Your payouts have been automatically paused for a security review and will be resumed once the review completes.",
                  )}
                </strong>
              ) : (
                <strong>
                  {t(
                    "seller.payouts.payouts_paused_by_user",
                    "You have paused your payouts. Please go to Payment Settings to resume payouts.",
                  )}
                </strong>
              )}
            </p>
          </Alert>
        ) : null}
        {next_payout_period_data != null ? (
          next_payout_period_data.has_stripe_connect ? (
            <Alert variant="info" role="status">
              <p>
                {t(
                  "seller.payouts.stripe_connect_notice",
                  "For Stripe Connect users, all future payouts will be deposited directly to your Stripe account",
                )}
              </p>
            </Alert>
          ) : (
            <section className="grid gap-4">
              {next_payout_period_data.payout_note &&
              !["processing", "paused"].includes(next_payout_period_data.status) ? (
                <Alert variant="info" role="status">
                  <p>{next_payout_period_data.payout_note}</p>
                </Alert>
              ) : null}
              {next_payout_period_data.status === "not_payable" ? (
                // Sellers with a positive balance below the payout minimum get the
                // balance notice even before their first payout — otherwise a
                // first-time seller whose payout was skipped would only see the
                // generic empty state and have no way to see their balance or the
                // reason the payout didn't go out.
                next_payout_period_data.balance_cents != null &&
                next_payout_period_data.balance_cents > 0 &&
                next_payout_period_data.balance_cents < next_payout_period_data.minimum_payout_amount_cents ? (
                  <Alert variant="info" role="status">
                    <p>
                      {t(
                        "seller.payouts.balance_below_minimum",
                        {
                          balance: formatPriceCentsWithCurrencySymbol("usd", next_payout_period_data.balance_cents, {
                            symbolFormat: "short",
                            noCentsIfWhole: false,
                          }),
                          minimum: formatPriceCentsWithCurrencySymbol(
                            "usd",
                            next_payout_period_data.minimum_payout_amount_cents,
                            { symbolFormat: "short" },
                          ),
                          skipped:
                            next_payout_period_data.skipped_payout_date != null
                              ? t(
                                  "seller.payouts.balance_skipped_suffix",
                                  { date: next_payout_period_data.skipped_payout_date },
                                  ` — so your ${next_payout_period_data.skipped_payout_date} payout was skipped`,
                                )
                              : "",
                        },
                        "Your balance is {balance}, below the {minimum} minimum{skipped}. You'll be paid out automatically once your balance reaches {minimum}.",
                      )}
                    </p>
                  </Alert>
                ) : past_payout_period_data.length > 0 ? (
                  <Alert variant="info" role="status">
                    <p>
                      {t(
                        "seller.payouts.balance_reach_minimum",
                        {
                          minimum: formatPriceCentsWithCurrencySymbol(
                            "usd",
                            next_payout_period_data.minimum_payout_amount_cents,
                            { symbolFormat: "short" },
                          ),
                        },
                        "Reach a balance of at least {minimum} to be paid out for your sales.",
                      )}
                    </p>
                  </Alert>
                ) : (
                  <PeriodEmpty />
                )
              ) : (
                <Period payoutPeriodData={next_payout_period_data} />
              )}
            </section>
          )
        ) : null}
        {processing_payout_periods_data.length > 0 ? (
          <section>
            <section className="flex flex-col gap-4">
              {processing_payout_periods_data.map((processingPayoutPeriodData, idx) => (
                <Period key={idx} payoutPeriodData={processingPayoutPeriodData} />
              ))}
            </section>
          </section>
        ) : null}
        {past_payout_period_data.length > 0 ? (
          <>
            <section>
              <h2>{t("seller.payouts.past_payouts", "Past payouts")}</h2>
              <section className="flex flex-col gap-4">
                {past_payout_period_data.map((payoutPeriodData, idx) => (
                  <Period key={idx} payoutPeriodData={payoutPeriodData} />
                ))}
              </section>
            </section>
            {pagination.page < pagination.pages ? (
              <Button color="primary" onClick={loadNextPage} disabled={isNavigating}>
                {t("seller.payouts.show_older_payouts", "Show older payouts")}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
