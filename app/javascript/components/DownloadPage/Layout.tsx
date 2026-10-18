import { X } from "@boxicons/react";
import { differenceInYears, parseISO } from "date-fns";
import * as React from "react";

import { addPurchaseToLibrary } from "$app/data/account";
import { deletePurchasedProduct } from "$app/data/library";
import { signupAndAddPurchaseToLibrary } from "$app/data/open_in_app";
import { t } from "$app/utils/i18n";
import { asyncVoid } from "$app/utils/promise";
import { assertResponseError, request } from "$app/utils/request";

import { Button, NavigationButton } from "$app/components/Button";
import { PageListLayout } from "$app/components/Download/PageListLayout";
import { LanguageToggle } from "$app/components/LanguageToggle";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import { Modal } from "$app/components/Modal";
import { PurchaseArchiveButton } from "$app/components/PurchaseArchiveButton";
import { Review, ReviewForm } from "$app/components/ReviewForm";
import { showAlert } from "$app/components/server-components/Alert";
import { Card, CardContent } from "$app/components/ui/Card";
import { Details, DetailsToggle } from "$app/components/ui/Details";
import { Fieldset, FieldsetDescription } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { useIsAboveBreakpoint } from "$app/components/useIsAboveBreakpoint";

export type PurchaseCustomField = {
  custom_field_id: string;
} & (
  | { type: "shortAnswer" | "longAnswer"; value: string }
  | { type: "fileUpload"; files: { name: string; size: number; extension: string }[] }
);

type ContentUnavailabilityReasonCode =
  | "inactive_membership"
  | "rental_expired"
  | "access_expired"
  | "email_confirmation_required"
  | null;
type Call = { start_time: string; end_time: string; url: string | null };

export type LayoutProps = {
  content_unavailability_reason_code: ContentUnavailabilityReasonCode;
  is_mobile_app_web_view: boolean;
  terms_page_url: string;
  token: string;
  redirect_id: string;
  add_to_library_option: AddToLibraryOption;
  purchase: {
    id: string;
    receipt_purchase_id: string | null;
    email: string | null;
    email_digest: string;
    is_archived: boolean;
    has_invoice: boolean;
    product_id: string | null;
    product_permalink: string | null;
    product_name: string | null;
    variant_id: string | null;
    product_long_url: string | null;
    created_at: string;
    allows_review: boolean;
    product_available: boolean;
    disable_reviews_after_year: boolean;
    review: Review | null;
    review_account_name: string | null;
    membership: {
      has_active_subscription: boolean;
      subscription_id: string;
      is_subscription_ended: boolean | null;
      is_installment_plan_completed: boolean | null;
      is_subscription_cancelled_or_failed: boolean | null;
      is_alive_or_restartable: boolean | null;
      in_free_trial: boolean;
      is_installment_plan: boolean;
    } | null;
    purchase_custom_fields: PurchaseCustomField[];
    call: Call | null;
  } | null;
};

export const Layout = ({
  content_unavailability_reason_code,
  is_mobile_app_web_view,
  purchase,
  terms_page_url,
  add_to_library_option,
  headerActions,
  pageList,
  children,
}: LayoutProps & { headerActions?: React.ReactNode; pageList?: React.ReactNode; children: React.ReactNode }) => {
  const loggedInUser = useLoggedInUser();
  const [isResendingReceipt, setIsResendingReceipt] = React.useState(false);
  const isDesktop = useIsAboveBreakpoint("lg");

  const handleResendReceipt = asyncVoid(async (purchaseId: string) => {
    setIsResendingReceipt(true);
    try {
      await request({
        method: "POST",
        url: Routes.resend_receipt_purchase_path(purchaseId),
        accept: "json",
      });
      showAlert(t("content.receipt_resent"), "success");
    } catch (e) {
      assertResponseError(e);
      showAlert(t("checkout.something_went_wrong_retry"), "error");
    }
    setIsResendingReceipt(false);
  });

  const receiptPurchaseId = purchase?.receipt_purchase_id ?? purchase?.id;
  // `receipt_purchase_id` only ever names a purchase sharing this one's email (see
  // Purchase#receipt_purchase), so the library row's address is the right one for both links.
  const receiptPurchaseEmail = purchase?.email;

  const disabledStatus =
    purchase && !purchase.product_available
      ? t("content.removed_by_seller")
      : purchase &&
          differenceInYears(new Date(), parseISO(purchase.created_at)) >= 1 &&
          purchase.disable_reviews_after_year
        ? t("content.reviews_disabled_after_year")
        : purchase?.membership?.in_free_trial
          ? t("content.reviews_not_allowed_free_trial")
          : null;

  const settings = is_mobile_app_web_view ? null : (
    <>
      {content_unavailability_reason_code !== "email_confirmation_required" ? (
        <>
          {(purchase?.allows_review || disabledStatus) && purchase?.product_permalink ? (
            <Card>
              <ReviewForm
                permalink={purchase.product_permalink}
                purchaseId={purchase.id}
                purchaseEmailDigest={purchase.email_digest}
                review={purchase.review}
                accountName={purchase.review_account_name}
                disabledStatus={disabledStatus}
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              />
            </Card>
          ) : null}
          {purchase?.email ? (
            <AddToLibrary
              add_to_library_option={add_to_library_option}
              terms_page_url={terms_page_url}
              purchase_id={purchase.id}
              purchase_email={purchase.email}
            />
          ) : null}
          {purchase ? (
            <Card>
              {content_unavailability_reason_code === null && purchase.membership ? (
                purchase.membership.is_installment_plan ? (
                  <CardContent asChild details>
                    <Details>
                      <DetailsToggle chevronPosition="right" className="grow">
                        {t("content.installment_plan")}
                      </DetailsToggle>
                      {purchase.membership.is_installment_plan_completed ? (
                        t("content.installment_plan_paid_full")
                      ) : (
                        <NavigationButton href={Routes.manage_subscription_url(purchase.membership.subscription_id)}>
                          {t("content.manage")}
                        </NavigationButton>
                      )}
                    </Details>
                  </CardContent>
                ) : (
                  <CardContent asChild details>
                    <Details>
                      <DetailsToggle chevronPosition="right" className="grow">
                        {t("content.membership")}
                      </DetailsToggle>
                      <div style={{ display: "grid" }}>
                        {purchase.membership.has_active_subscription ? (
                          <NavigationButton href={Routes.manage_subscription_url(purchase.membership.subscription_id)}>
                            {t("content.manage")}
                          </NavigationButton>
                        ) : purchase.membership.is_subscription_ended ? (
                          t("content.subscription_ended")
                        ) : purchase.membership.is_subscription_cancelled_or_failed ? (
                          <NavigationButton href={Routes.manage_subscription_url(purchase.membership.subscription_id)}>
                            {t("content.restart")}
                          </NavigationButton>
                        ) : null}
                      </div>
                    </Details>
                  </CardContent>
                )
              ) : null}
              {receiptPurchaseId ? (
                <CardContent asChild details>
                  <Details>
                    <DetailsToggle chevronPosition="right" className="grow">
                      {t("content.receipt")}
                    </DetailsToggle>
                    <div className="flex flex-col gap-4">
                      <NavigationButton
                        href={
                          receiptPurchaseEmail
                            ? Routes.receipt_purchase_url(receiptPurchaseId, { email: receiptPurchaseEmail })
                            : Routes.receipt_purchase_url(receiptPurchaseId)
                        }
                      >
                        {t("content.view_receipt")}
                      </NavigationButton>
                      <Button onClick={() => handleResendReceipt(receiptPurchaseId)} disabled={isResendingReceipt}>
                        {isResendingReceipt ? t("content.resending_receipt") : t("content.resend_receipt")}
                      </Button>
                      {/*
                        Buyers could always reach their invoice, but only by going Receipt →
                        View receipt → Generate invoice, and enough of them failed to find it
                        that sellers were fielding the support requests. Surfacing it here
                        alongside the other receipt actions removes that indirection.

                        Gated on has_invoice so it matches the receipt: a free purchase or a
                        membership still in its free trial has no amount to invoice, and the
                        invoice page would have nothing to render.
                      */}
                      {purchase.has_invoice ? (
                        <NavigationButton
                          href={
                            receiptPurchaseEmail
                              ? Routes.new_purchase_invoice_url(receiptPurchaseId, { email: receiptPurchaseEmail })
                              : Routes.new_purchase_invoice_url(receiptPurchaseId)
                          }
                        >
                          {t("content.generate_invoice")}
                        </NavigationButton>
                      ) : null}
                    </div>
                  </Details>
                </CardContent>
              ) : null}
              {loggedInUser !== null ? (
                <CardContent asChild details>
                  <Details>
                    <DetailsToggle chevronPosition="right" className="grow">
                      {t("content.library")}
                    </DetailsToggle>
                    <div className="flex flex-col gap-4">
                      <PurchaseArchiveButton purchase_id={purchase.id} initial_is_archived={purchase.is_archived} />
                      <PurchaseDeleteButton purchase_id={purchase.id} product_name={purchase.product_name} />
                    </div>
                  </Details>
                </CardContent>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}
      {purchase?.call ? <CallDetails call={purchase.call} /> : null}
    </>
  );

  return (
    <div className="flex flex-1 flex-col">
      {is_mobile_app_web_view ? null : (
        <header className="sticky top-0 z-20 flex border-b border-border bg-body text-foreground">
          {loggedInUser ? (
            <a
              href={Routes.library_url()}
              title={t("content.back_to_library")}
              aria-label={t("content.back_to_library")}
              className="flex shrink-0 items-center justify-center border-r border-border px-6 no-underline transition-colors hover:bg-active-bg"
            >
              <X className="size-6" />
            </a>
          ) : null}
          <div
            className={`flex min-h-18 min-w-0 flex-1 items-center justify-between gap-2 py-3 pr-4 ${loggedInUser ? "pl-4" : "pl-8"}`}
          >
            <h1 className="line-clamp-2 hidden! min-w-0 flex-1 text-2xl sm:block!">{purchase?.product_name}</h1>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageToggle variant="compact" />
              {headerActions}
            </div>
          </div>
        </header>
      )}
      {settings || pageList ? (
        <PageListLayout
          className="flex-1"
          pageList={
            <>
              {pageList}
              {isDesktop ? settings : null}
            </>
          }
        >
          <div className="mx-auto flex max-w-200 flex-col gap-4">
            {children}
            {!isDesktop ? settings : null}
          </div>
        </PageListLayout>
      ) : (
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-8">{children}</div>
      )}
    </div>
  );
};

const CallDetails = ({ call }: { call: Call }) => {
  const startTime = new Date(call.start_time);
  const endTime = new Date(call.end_time);
  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formattedStartDate = formatDate(startTime);
  const formattedEndDate = formatDate(endTime);

  return (
    <Card>
      <CardContent>
        <h5 className="grow font-bold">
          {`${formatTime(startTime)} - ${formatTime(endTime)} ${
            Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
              .formatToParts(new Date())
              .find((part) => part.type === "timeZoneName")?.value ?? ""
          }`}
        </h5>
        {formattedStartDate === formattedEndDate ? formattedStartDate : `${formattedStartDate} - ${formattedEndDate}`}
      </CardContent>
      {call.url ? (
        <CardContent>
          <strong className="grow">{t("content.call_link")}</strong>
          <a href={call.url} target="_blank" rel="noopener noreferrer">
            {call.url}
          </a>
        </CardContent>
      ) : null}
    </Card>
  );
};

const PurchaseDeleteButton = ({
  purchase_id,
  product_name,
}: {
  purchase_id: string;
  product_name: string | null;
  small?: boolean;
}) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = asyncVoid(async () => {
    setIsDeleting(true);
    try {
      await deletePurchasedProduct({ purchase_id });
      showAlert(t("library.removed_from_library"), "success");
      window.location.href = Routes.library_path();
    } catch (e) {
      assertResponseError(e);
      showAlert(t("checkout.something_went_wrong_retry"), "error");
    }
    setIsDeleting(false);
  });

  return (
    <>
      <Button color="danger" onClick={() => setIsDeleteModalOpen(true)}>
        {t("library.remove_from_library")}
      </Button>
      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t("library.remove_from_library")}
        footer={
          <>
            <Button onClick={() => setIsDeleteModalOpen(false)}>{t("actions.cancel")}</Button>
            <Button color="danger" onClick={handleDelete}>
              {isDeleting ? t("library.removing") : t("actions.confirm_and_save")}
            </Button>
          </>
        }
      >
        <div>
          <span className="inline">{t("library.remove_confirm_title", { name: product_name ?? "" })}</span>
          <p>{t("library.remove_modal_body")}</p>
        </div>
      </Modal>
    </>
  );
};

type AddToLibraryOption = "none" | "add_to_library_button" | "signup_form";
type AddToLibraryProps = {
  add_to_library_option: AddToLibraryOption;
  terms_page_url: string;
  purchase_id: string;
  purchase_email: string;
};
const AddToLibrary = ({ add_to_library_option, terms_page_url, purchase_id, purchase_email }: AddToLibraryProps) => {
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleAddPurchaseToLibrary = asyncVoid(async () => {
    setIsSubmitting(true);
    try {
      const result = await addPurchaseToLibrary({ purchaseId: purchase_id, purchaseEmail: purchase_email });
      window.location.href = result.redirectLocation;
    } catch (error) {
      assertResponseError(error);
      showAlert(error.message, "error");
    }
    setIsSubmitting(false);
  });

  const handleSignupAndAddPurchaseToLibrary = asyncVoid(async (event: React.FormEvent) => {
    event.preventDefault();

    setIsSubmitting(true);
    try {
      await signupAndAddPurchaseToLibrary({
        purchaseId: purchase_id,
        buyerSignup: true,
        termsAccepted: true,
        email: purchase_email,
        password,
      });
      window.location.href = Routes.library_path();
    } catch (error) {
      assertResponseError(error);
      showAlert(error.message, "error");
    }
    setIsSubmitting(false);
  });

  if (add_to_library_option === "none") return null;

  return (
    <Card>
      {add_to_library_option === "add_to_library_button" ? (
        <>
          <CardContent asChild>
            <span>{t("content.add_to_library_prompt")}</span>
          </CardContent>
          <CardContent>
            <div style={{ display: "grid" }} className="grow">
              <Button color="primary" onClick={handleAddPurchaseToLibrary} disabled={isSubmitting}>
                {isSubmitting ? t("content.adding_to_library") : t("content.add_to_library")}
              </Button>
            </div>
          </CardContent>
        </>
      ) : (
        <>
          <CardContent asChild>
            <span>{t("content.create_account_prompt")}</span>
          </CardContent>
          <CardContent>
            <form autoComplete="off" onSubmit={handleSignupAndAddPurchaseToLibrary} className="grid grow gap-4">
              <Fieldset>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("content.your_password")}
                />
                <FieldsetDescription>
                  {t("content.terms_agreement", { terms_of_use: "___TERMS___" })
                    .split("___TERMS___")
                    .reduce<React.ReactNode[]>((acc, part, idx) => {
                      if (idx === 0) return [part];
                      return [
                        ...acc,
                        <a key="terms" href={terms_page_url}>
                          {t("content.terms_of_use")}
                        </a>,
                        part,
                      ];
                    }, [])}
                </FieldsetDescription>
              </Fieldset>
              <Button color="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("content.creating_account") : t("content.create_account")}
              </Button>
            </form>
          </CardContent>
        </>
      )}
    </Card>
  );
};
