import { useForm, usePage } from "@inertiajs/react";
import * as React from "react";
import typia from "typia";

import { SettingPage } from "$app/parsers/settings";
import { useTranslate } from "$app/utils/i18n";
import { asyncVoid } from "$app/utils/promise";
import { request, assertResponseError } from "$app/utils/request";

import { Button } from "$app/components/Button";
import { useDomains } from "$app/components/DomainSettings";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import { Modal } from "$app/components/Modal";
import { showAlert } from "$app/components/server-components/Alert";
import { ToggleSettingRow } from "$app/components/SettingRow";
import { ProductLevelSupportEmailsForm } from "$app/components/Settings/AdvancedPage/ProductLevelSupportEmailsForm";
import { Layout } from "$app/components/Settings/Layout";
import { Alert } from "$app/components/ui/Alert";
import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { FormSection } from "$app/components/ui/FormSection";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { LinkButton } from "$app/components/ui/LinkButton";
import { Select } from "$app/components/ui/Select";
import { Switch } from "$app/components/ui/Switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";
import { Textarea } from "$app/components/ui/Textarea";

type ProductLevelSupportEmail = {
  email: string;
  product_ids: string[];
};

type MainPageProps = {
  settings_pages: SettingPage[];
  is_form_disabled: boolean;
  invalidate_active_sessions: boolean;
  ios_app_store_url: string;
  android_app_store_url: string;
  timezones: { name: string; offset: string }[];
  currencies: { name: string; code: string }[];
  user: {
    email: string | null;
    username: string;
    support_email: string | null;
    locale: string;
    timezone: string;
    currency_type: string;
    has_unconfirmed_email: boolean;
    compliance_country: string | null;
    purchasing_power_parity_enabled: boolean;
    purchasing_power_parity_limit: number | null;
    purchasing_power_parity_payment_verification_disabled: boolean;
    products: { id: string; name: string }[];
    purchasing_power_parity_excluded_product_ids: string[];
    enable_payment_email: boolean;
    enable_payment_push_notification: boolean;
    enable_recurring_subscription_charge_email: boolean;
    enable_recurring_subscription_charge_push_notification: boolean;
    enable_free_downloads_email: boolean;
    enable_free_downloads_push_notification: boolean;
    announcement_notification_enabled: boolean;
    disable_comments_email: boolean;
    disable_reviews_email: boolean;
    disable_review_reminders: boolean;
    show_nsfw_products: boolean;
    disable_affiliate_requests: boolean;
    seller_refund_policy: {
      editable: boolean;
      refund_policy_enforced: boolean;
      allowed_refund_periods_in_days: { key: number; value: string }[];
      max_refund_period_in_days: number;
      fine_print_enabled: boolean;
      fine_print: string | null;
    };
    product_level_support_emails: ProductLevelSupportEmail[];
  };
};

export default function MainPage() {
  const { t } = useTranslate();
  const props = typia.assert<MainPageProps>(usePage().props);
  const uid = React.useId();
  const { rootDomain, scheme } = useDomains();
  const loggedInUser = useLoggedInUser();

  const form = useForm({
    user: {
      ...props.user,
      email: props.user.email ?? "",
      support_email: props.user.support_email ?? "",
      tax_id: null,
      purchasing_power_parity_excluded_product_ids: props.user.purchasing_power_parity_excluded_product_ids,
      product_level_support_emails: props.user.product_level_support_emails,
    },
  });

  const isFormDisabled = props.is_form_disabled || form.processing;
  const canUpdateUsername = Boolean(loggedInUser?.policies.settings_main_user.update_username) && !isFormDisabled;

  const updateUserSettings = (settings: Partial<typeof form.data.user>) =>
    form.setData("user", { ...form.data.user, ...settings });
  const handleProductLevelSupportEmailsChange = (emails: ProductLevelSupportEmail[]) =>
    updateUserSettings({ product_level_support_emails: emails });

  const [resentConfirmationEmail, setResentConfirmationEmail] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const resendConfirmationEmailForm = useForm({});

  const resendConfirmationEmail = () => {
    resendConfirmationEmailForm.post(Routes.resend_confirmation_email_settings_main_path(), {
      onSuccess: () => {
        setResentConfirmationEmail(true);
      },
    });
  };

  const onSave = () => {
    if (props.is_form_disabled) return;
    if (!formRef.current?.reportValidity()) return;

    form.put(Routes.settings_main_path(), {
      preserveScroll: true,
    });
  };
  const subdomain = `${form.data.user.username}.${rootDomain}`;

  return (
    <Layout currentPage="main" pages={props.settings_pages} onSave={onSave} canUpdate={!isFormDisabled}>
      <form ref={formRef}>
        <FormSection header={<h2>{t("seller.settings.main.user_details")}</h2>}>
          <Fieldset>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-email`}>{t("seller.settings.main.email")}</Label>
            </FieldsetTitle>
            <Input
              type="email"
              id={`${uid}-email`}
              value={form.data.user.email}
              disabled={isFormDisabled}
              required
              onChange={(e) => updateUserSettings({ email: e.target.value })}
            />
            {props.user.has_unconfirmed_email && !props.is_form_disabled ? (
              <FieldsetDescription>
                {t("seller.settings.main.email_unconfirmed")}{" "}
                {resentConfirmationEmail ? null : (
                  <LinkButton
                    onClick={(e) => {
                      e.preventDefault();
                      resendConfirmationEmail();
                    }}
                  >
                    {resendConfirmationEmailForm.processing
                      ? t("seller.settings.main.resending")
                      : t("seller.settings.main.resend_confirmation")}
                  </LinkButton>
                )}
              </FieldsetDescription>
            ) : null}
          </Fieldset>
          <Fieldset>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-username`}>{t("seller.settings.main.username")}</Label>
            </FieldsetTitle>
            <Input
              id={`${uid}-username`}
              type="text"
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="other"
              disabled={!canUpdateUsername}
              value={form.data.user.username}
              onChange={(evt) =>
                updateUserSettings({ username: evt.target.value.replace(/[^a-z0-9]/giu, "").toLowerCase() })
              }
            />
            <FieldsetDescription>
              {t("seller.settings.main.view_profile_at")} <a href={`${scheme}://${subdomain}`}>{subdomain}</a>
            </FieldsetDescription>
          </Fieldset>
        </FormSection>
        <FormSection
          header={
            <>
              <h2>{t("seller.settings.main.notifications")}</h2>
              <div>
                {t("seller.settings.main.notifications_desc", {
                  app_store: "App Store",
                  play_store: "Play Store",
                })}
              </div>
            </>
          }
        >
          <Fieldset>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("seller.settings.main.notifications")}</TableHead>
                  <TableHead>{t("seller.settings.main.email_header")}</TableHead>
                  <TableHead>{t("seller.settings.main.mobile_header")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableHead scope="row">{t("seller.settings.main.notif_purchases")}</TableHead>
                  <TableCell>
                    <Switch
                      checked={form.data.user.enable_payment_email}
                      onChange={(e) => updateUserSettings({ enable_payment_email: e.target.checked })}
                      disabled={isFormDisabled}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={form.data.user.enable_payment_push_notification}
                      onChange={(e) => updateUserSettings({ enable_payment_push_notification: e.target.checked })}
                      disabled={isFormDisabled}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead scope="row">{t("seller.settings.main.notif_recurring")}</TableHead>
                  <TableCell>
                    <Switch
                      checked={form.data.user.enable_recurring_subscription_charge_email}
                      onChange={(e) =>
                        updateUserSettings({ enable_recurring_subscription_charge_email: e.target.checked })
                      }
                      disabled={isFormDisabled}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={form.data.user.enable_recurring_subscription_charge_push_notification}
                      onChange={(e) =>
                        updateUserSettings({
                          enable_recurring_subscription_charge_push_notification: e.target.checked,
                        })
                      }
                      disabled={isFormDisabled}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead scope="row">{t("seller.settings.main.notif_free_downloads")}</TableHead>
                  <TableCell>
                    <Switch
                      checked={form.data.user.enable_free_downloads_email}
                      onChange={(e) => updateUserSettings({ enable_free_downloads_email: e.target.checked })}
                      disabled={isFormDisabled}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={form.data.user.enable_free_downloads_push_notification}
                      onChange={(e) =>
                        updateUserSettings({ enable_free_downloads_push_notification: e.target.checked })
                      }
                      disabled={isFormDisabled}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead scope="row">{t("seller.settings.main.notif_personalized_announcements")}</TableHead>
                  <TableCell>
                    <Switch
                      checked={form.data.user.announcement_notification_enabled}
                      onChange={(e) => updateUserSettings({ announcement_notification_enabled: e.target.checked })}
                      disabled={isFormDisabled}
                    />
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
                <TableRow>
                  <TableHead scope="row">{t("seller.settings.main.notif_comments")}</TableHead>
                  <TableCell>
                    <Switch
                      checked={!form.data.user.disable_comments_email}
                      onChange={(e) => updateUserSettings({ disable_comments_email: !e.target.checked })}
                      disabled={isFormDisabled}
                    />
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
                <TableRow>
                  <TableHead scope="row">{t("seller.settings.main.notif_reviews")}</TableHead>
                  <TableCell>
                    <Switch
                      checked={!form.data.user.disable_reviews_email}
                      onChange={(e) => updateUserSettings({ disable_reviews_email: !e.target.checked })}
                      disabled={isFormDisabled}
                      aria-label={t("seller.settings.main.notif_reviews")}
                    />
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Fieldset>
        </FormSection>
        <FormSection header={<h2>{t("seller.settings.main.review_reminders")}</h2>}>
          <Fieldset>
            <ToggleSettingRow
              value={!form.data.user.disable_review_reminders}
              onChange={(value) => updateUserSettings({ disable_review_reminders: !value })}
              disabled={isFormDisabled}
              label={t("seller.settings.main.send_review_reminders")}
            />
            <FieldsetDescription>{t("seller.settings.main.review_reminders_desc")}</FieldsetDescription>
          </Fieldset>
        </FormSection>
        <FormSection header={<h2>{t("seller.settings.main.support")}</h2>}>
          <Fieldset>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-support-email`}>{t("seller.settings.main.email")}</Label>
            </FieldsetTitle>
            <Input
              type="email"
              id={`${uid}-support-email`}
              value={form.data.user.support_email}
              placeholder={t("seller.settings.main.support_email_placeholder", "you@example.com")}
              disabled={isFormDisabled}
              onChange={(e) => updateUserSettings({ support_email: e.target.value })}
            />
            <FieldsetDescription>
              {t("seller.settings.main.support_email_desc")}
              {props.user.email
                ? t("seller.settings.main.support_email_leave_blank", { email: props.user.email })
                : null}
            </FieldsetDescription>
          </Fieldset>
          <ProductLevelSupportEmailsForm
            productLevelSupportEmails={form.data.user.product_level_support_emails}
            products={props.user.products}
            isDisabled={isFormDisabled}
            onChange={handleProductLevelSupportEmailsChange}
          />
        </FormSection>
        <FormSection
          header={
            <>
              <h2>{t("seller.settings.main.refund_policy")}</h2>
              <div>{t("seller.settings.main.refund_policy_desc")}</div>
            </>
          }
        >
          {props.user.seller_refund_policy.refund_policy_enforced ? (
            <Alert variant="info" role="status">
              {t("seller.settings.main.refund_policy_enforced")}
            </Alert>
          ) : !props.user.seller_refund_policy.editable ? (
            <Alert variant="info" role="status">
              {t("seller.settings.main.refund_policy_managed_by_platform")}
            </Alert>
          ) : null}
          <Fieldset>
            <FieldsetTitle>
              <Label htmlFor="max-refund-period-in-days">{t("seller.settings.main.refund_period")}</Label>
            </FieldsetTitle>
            <Select
              id="max-refund-period-in-days"
              value={form.data.user.seller_refund_policy.max_refund_period_in_days}
              disabled={isFormDisabled || !props.user.seller_refund_policy.editable}
              onChange={(e) =>
                updateUserSettings({
                  seller_refund_policy: {
                    ...form.data.user.seller_refund_policy,
                    max_refund_period_in_days: Number(e.target.value),
                  },
                })
              }
            >
              {form.data.user.seller_refund_policy.allowed_refund_periods_in_days.map(({ key, value }) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </Select>
          </Fieldset>
          <Fieldset>
            <ToggleSettingRow
              value={
                form.data.user.seller_refund_policy.fine_print_enabled
                  ? form.data.user.seller_refund_policy.max_refund_period_in_days > 0
                  : false
              }
              onChange={(value) =>
                updateUserSettings({
                  seller_refund_policy: {
                    ...form.data.user.seller_refund_policy,
                    fine_print_enabled: value,
                  },
                })
              }
              disabled={
                isFormDisabled ||
                !props.user.seller_refund_policy.editable ||
                form.data.user.seller_refund_policy.max_refund_period_in_days === 0
              }
              label={t("seller.settings.main.add_fine_print")}
              dropdown={
                <Fieldset>
                  <FieldsetTitle>
                    <Label htmlFor="seller-refund-policy-fine-print">{t("seller.settings.main.fine_print")}</Label>
                  </FieldsetTitle>
                  <Textarea
                    id="seller-refund-policy-fine-print"
                    maxLength={3000}
                    rows={10}
                    value={form.data.user.seller_refund_policy.fine_print || ""}
                    disabled={isFormDisabled || !props.user.seller_refund_policy.editable}
                    onChange={(e) =>
                      updateUserSettings({
                        seller_refund_policy: {
                          ...form.data.user.seller_refund_policy,
                          fine_print: e.target.value,
                        },
                      })
                    }
                  />
                </Fieldset>
              }
            />
          </Fieldset>
        </FormSection>
        <FormSection header={<h2>{t("seller.settings.main.local")}</h2>}>
          <Fieldset>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-timezone`}>{t("seller.settings.main.timezone")}</Label>
            </FieldsetTitle>
            <Select
              id={`${uid}-timezone`}
              disabled={isFormDisabled}
              value={form.data.user.timezone}
              onChange={(e) => updateUserSettings({ timezone: e.target.value })}
            >
              {props.timezones.map((tz) => (
                <option key={tz.name} value={tz.name}>
                  {`${tz.offset} | ${tz.name}`}
                </option>
              ))}
            </Select>
          </Fieldset>
          <Fieldset>
            <FieldsetTitle>
              <Label>{t("seller.settings.main.currency")}</Label>
            </FieldsetTitle>
            <Input value={t("seller.settings.main.currency_fixed_etb")} disabled />
            <FieldsetDescription>{t("seller.settings.main.currency_fixed_desc")}</FieldsetDescription>
          </Fieldset>
        </FormSection>
        <FormSection header={<h2>{t("seller.settings.main.adult_content")}</h2>}>
          <Fieldset>
            <ToggleSettingRow
              value={form.data.user.show_nsfw_products}
              onChange={(value) => updateUserSettings({ show_nsfw_products: value })}
              disabled={isFormDisabled}
              label={t("seller.settings.main.show_adult_content")}
            />
          </Fieldset>
        </FormSection>
        <FormSection header={<h2>{t("seller.settings.main.affiliates_section")}</h2>}>
          <Fieldset>
            <ToggleSettingRow
              value={form.data.user.disable_affiliate_requests}
              onChange={(value) => updateUserSettings({ disable_affiliate_requests: value })}
              disabled={isFormDisabled}
              label={t("seller.settings.main.prevent_affiliates")}
            />
            <FieldsetDescription>{t("seller.settings.main.prevent_affiliates_desc")}</FieldsetDescription>
          </Fieldset>
        </FormSection>
        {props.invalidate_active_sessions ? <InvalidateActiveSessionsSection /> : null}
      </form>
    </Layout>
  );
}

const InvalidateActiveSessionsSection = () => {
  const { t } = useTranslate();
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = React.useState(false);
  const [isInvalidating, setIsInvalidating] = React.useState(false);

  const invalidateActiveSessions = asyncVoid(async () => {
    setIsInvalidating(true);

    try {
      await request({ url: Routes.user_invalidate_active_sessions_path(), method: "PUT", accept: "json" });

      location.reload();
    } catch (e) {
      assertResponseError(e);
      showAlert(t("common.something_went_wrong"), "error");
    }

    setIsConfirmationDialogOpen(false);
    setIsInvalidating(false);
  });

  return (
    <FormSection>
      <Fieldset>
        <LinkButton onClick={() => setIsConfirmationDialogOpen(true)}>
          {t("seller.settings.main.sign_out_all_sessions")}
        </LinkButton>
        <FieldsetDescription>{t("seller.settings.main.sign_out_all_sessions_desc")}</FieldsetDescription>
      </Fieldset>
      {isConfirmationDialogOpen ? (
        <Modal
          open
          title={t("seller.settings.main.sign_out_all_sessions_modal_title")}
          onClose={() => !isInvalidating && setIsConfirmationDialogOpen(false)}
          footer={
            <>
              <Button onClick={() => setIsConfirmationDialogOpen(false)} disabled={isInvalidating}>
                {t("actions.cancel")}
              </Button>
              <Button color="accent" onClick={() => invalidateActiveSessions()} disabled={isInvalidating}>
                {isInvalidating
                  ? t("seller.settings.main.signing_out_all_sessions")
                  : t("seller.settings.main.confirm_sign_out")}
              </Button>
            </>
          }
        >
          {t("seller.settings.main.sign_out_all_sessions_modal_body")}
        </Modal>
      ) : null}
    </FormSection>
  );
};
