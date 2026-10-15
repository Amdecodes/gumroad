import { router, useForm, usePage } from "@inertiajs/react";
import * as React from "react";
import typia from "typia";

import { SettingPage } from "$app/parsers/settings";
import { useTranslate } from "$app/utils/i18n";
import { asyncVoid } from "$app/utils/promise";
import { assertResponseError, request, ResponseError } from "$app/utils/request";

import { Button } from "$app/components/Button";
import { PasswordInput } from "$app/components/PasswordInput";
import { showAlert } from "$app/components/server-components/Alert";
import { Layout as SettingsLayout } from "$app/components/Settings/Layout";
import { AuthenticatorSetup } from "$app/components/Settings/PasswordPage/AuthenticatorSetup";
import { PasskeysSection, type Passkey } from "$app/components/Settings/PasswordPage/PasskeysSection";
import { RecoveryCodes } from "$app/components/Settings/PasswordPage/RecoveryCodes";
import { Alert } from "$app/components/ui/Alert";
import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { FormSection } from "$app/components/ui/FormSection";
import { Label } from "$app/components/ui/Label";

const MIN_PASSWORD_LENGTH = 4;
const MAX_PASSWORD_LENGTH = 128;

type PasswordPageProps = {
  settings_pages: SettingPage[];
  require_old_password: boolean;
  authenticator_app_enabled: boolean;
  passkeys: Passkey[];
};

export default function PasswordPage() {
  const { t } = useTranslate();
  const props = typia.assert<PasswordPageProps>(usePage().props);
  const uid = React.useId();
  const [requireOldPassword, setRequireOldPassword] = React.useState(props.require_old_password);
  const [settingUp, setSettingUp] = React.useState(false);
  const [removingAuthenticatorApp, setRemovingAuthenticatorApp] = React.useState(false);
  const [regeneratedCodes, setRegeneratedCodes] = React.useState<string[] | null>(null);
  const [regenerating, setRegenerating] = React.useState(false);

  const form = useForm({
    user: {
      password: "",
      new_password: "",
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (form.data.user.new_password.length < MIN_PASSWORD_LENGTH) {
      showAlert(t("seller.settings.password.password_too_short"), "error");
      return;
    }

    if (form.data.user.new_password.length >= MAX_PASSWORD_LENGTH) {
      showAlert(t("seller.settings.password.password_too_long"), "error");
      return;
    }

    form.put(Routes.settings_password_path(), {
      preserveScroll: true,
      onSuccess: (response) => {
        if (response.props.new_password) setRequireOldPassword(true);
        form.reset();
      },
    });
  };

  const handleRemoveAuthenticatorApp = asyncVoid(async () => {
    setRemovingAuthenticatorApp(true);

    try {
      const response = await request({
        url: Routes.settings_totp_path(),
        method: "DELETE",
        accept: "json",
      });
      const result = typia.assert<{ success: boolean; error_message?: string }>(await response.json());
      if (!response.ok || !result.success) {
        throw new ResponseError(result.error_message ?? "Sorry, something went wrong. Please try again.");
      }

      showAlert(t("seller.settings.password.authenticator_removed"), "success");
      setRegeneratedCodes(null);
      router.reload();
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    } finally {
      setRemovingAuthenticatorApp(false);
    }
  });

  const handleRegenerateRecoveryCodes = asyncVoid(async () => {
    setRegenerating(true);

    try {
      const response = await request({
        url: Routes.regenerate_recovery_codes_settings_totp_path(),
        method: "POST",
        accept: "json",
      });
      const result = typia.assert<{ success: boolean; recovery_codes?: string[]; error_message?: string }>(
        await response.json(),
      );
      if (!response.ok || !result.success) {
        throw new ResponseError(result.error_message ?? "Sorry, something went wrong. Please try again.");
      }

      if (!result.recovery_codes?.length) {
        throw new ResponseError("No recovery codes were generated. Please try again.");
      }
      setRegeneratedCodes(result.recovery_codes);
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    } finally {
      setRegenerating(false);
    }
  });

  return (
    <SettingsLayout currentPage="password" pages={props.settings_pages}>
      <form onSubmit={handleSubmit}>
        <FormSection header={<h2>{t("seller.settings.password.change_password")}</h2>}>
          {requireOldPassword ? (
            <Fieldset>
              <FieldsetTitle>
                <Label htmlFor={`${uid}-old-password`}>{t("seller.settings.password.old_password")}</Label>
              </FieldsetTitle>
              <PasswordInput
                id={`${uid}-old-password`}
                value={form.data.user.password}
                onChange={(e) => form.setData("user.password", e.target.value)}
                required
                disabled={form.processing}
              />
            </Fieldset>
          ) : null}
          <Fieldset>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-new-password`}>
                {requireOldPassword
                  ? t("seller.settings.password.new_password")
                  : t("seller.settings.password.add_password")}
              </Label>
            </FieldsetTitle>
            <PasswordInput
              id={`${uid}-new-password`}
              value={form.data.user.new_password}
              onChange={(e) => form.setData("user.new_password", e.target.value)}
              required
              disabled={form.processing}
            />
          </Fieldset>
          <Fieldset>
            <div>
              <Button type="submit" color="accent" disabled={form.processing}>
                {form.processing
                  ? t("seller.settings.password.changing_password")
                  : t("seller.settings.password.change_password")}
              </Button>
            </div>
          </Fieldset>
        </FormSection>
      </form>
      <FormSection header={<h2>{t("seller.settings.password.two_factor_auth")}</h2>}>
        {props.authenticator_app_enabled ? null : (
          <Alert variant="info">{t("seller.settings.password.two_factor_auth_desc")}</Alert>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid gap-2">
            <div className="font-bold">{t("seller.settings.password.authenticator_app")}</div>
            <FieldsetDescription>{t("seller.settings.password.authenticator_app_desc")}</FieldsetDescription>
          </div>
          {props.authenticator_app_enabled ? (
            <div className="flex shrink-0 gap-2">
              <Button onClick={handleRegenerateRecoveryCodes} disabled={regenerating || removingAuthenticatorApp}>
                {regenerating
                  ? t("seller.settings.password.regenerating")
                  : t("seller.settings.password.regenerate_recovery_codes")}
              </Button>
              <Button
                color="danger"
                outline
                onClick={handleRemoveAuthenticatorApp}
                disabled={removingAuthenticatorApp || regenerating}
              >
                {removingAuthenticatorApp
                  ? t("seller.settings.password.removing")
                  : t("seller.settings.password.remove")}
              </Button>
            </div>
          ) : settingUp ? null : (
            <Button color="accent" onClick={() => setSettingUp(true)}>
              {t("seller.settings.password.set_up")}
            </Button>
          )}
        </div>
        {settingUp && !props.authenticator_app_enabled ? (
          <AuthenticatorSetup onCancel={() => setSettingUp(false)} />
        ) : null}
        {props.authenticator_app_enabled && regeneratedCodes ? (
          <RecoveryCodes codes={regeneratedCodes} onDone={() => setRegeneratedCodes(null)} />
        ) : null}
      </FormSection>
      <FormSection header={<h2>{t("seller.settings.password.passkeys")}</h2>}>
        <PasskeysSection passkeys={props.passkeys} />
      </FormSection>
    </SettingsLayout>
  );
}
