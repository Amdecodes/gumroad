import { Link, useForm, usePage } from "@inertiajs/react";
import * as React from "react";

import { t } from "$app/utils/i18n";

import { AuthAlert } from "$app/components/AuthAlert";
import { Layout } from "$app/components/Authentication/Layout";
import { SlowConnectionNotice } from "$app/components/Authentication/SlowConnectionNotice";
import { SocialAuth } from "$app/components/Authentication/SocialAuth";
import { Button } from "$app/components/Button";
import { Separator } from "$app/components/Separator";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { useOriginalLocation } from "$app/components/useOriginalLocation";

type PageProps = {
  email: string | null;
  application_name: string | null;
};

function ForgotPasswordPage() {
  const { email: initialEmail, application_name } = usePage<PageProps>().props;
  const uid = React.useId();

  const url = new URL(useOriginalLocation());
  const next = url.searchParams.get("next") || "dashboard";

  const form = useForm({
    user: {
      email: initialEmail ?? "",
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    form.post(Routes.user_password_path());
  };

  return (
    <Layout
      header={
        <h1>
          {application_name
            ? t("auth.connect_app_to_gumroad", { app: application_name })
            : t("auth.forgot_password_title")}
        </h1>
      }
      headerActions={<Link href={Routes.login_path({ next })}>{t("auth.log_in")}</Link>}
    >
      <form onSubmit={handleSubmit}>
        <SocialAuth />
        <Separator>
          <span>{t("common.or")}</span>
        </Separator>
        <section className="grid gap-8 py-12">
          <AuthAlert />
          <Fieldset>
            <FieldsetTitle>
              <Label htmlFor={uid}>{t("auth.email_reset_instructions")}</Label>
            </FieldsetTitle>
            <Input
              id={uid}
              type="email"
              value={form.data.user.email}
              onChange={(e) => form.setData("user.email", e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </Fieldset>
          <Button color="primary" type="submit" disabled={form.processing}>
            {form.processing ? t("auth.sending") : t("auth.send")}
          </Button>
          <SlowConnectionNotice
            processing={form.processing}
            actionHref={Routes.login_path({ next })}
            actionLabel={t("auth.go_to_sign_in")}
          />
        </section>
      </form>
    </Layout>
  );
}

ForgotPasswordPage.publicLayout = true;
export default ForgotPasswordPage;
