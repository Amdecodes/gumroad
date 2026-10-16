import { Link, useForm, usePage } from "@inertiajs/react";
import * as React from "react";

import { t } from "$app/utils/i18n";
import { formatPrice } from "$app/utils/price";

import { AuthAlert } from "$app/components/AuthAlert";
import { Layout } from "$app/components/Authentication/Layout";
import { SlowConnectionNotice } from "$app/components/Authentication/SlowConnectionNotice";
import { SocialAuth } from "$app/components/Authentication/SocialAuth";
import { Button } from "$app/components/Button";
import { PasswordInput } from "$app/components/PasswordInput";
import { Separator } from "$app/components/Separator";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { useOriginalLocation } from "$app/components/useOriginalLocation";

type PageProps = {
  email: string | null;
  application_name: string | null;
  referrer: {
    id: string;
    name: string;
  } | null;
  stats: {
    number_of_creators: number;
    total_made: number;
  };
};

function SignupPage() {
  const { email: initialEmail, application_name, referrer, stats } = usePage<PageProps>().props;
  const { number_of_creators, total_made } = stats;

  const url = new URL(useOriginalLocation());
  const next = url.searchParams.get("next");
  const uid = React.useId();

  const form = useForm<{
    user: {
      email: string;
      password: string;
      terms_accepted: boolean;
    };
    next: string | null;
    referral: string | null;
  }>({
    user: {
      email: initialEmail ?? "",
      password: "",
      terms_accepted: true,
    },
    next,
    referral: referrer?.id ?? null,
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    form.post(Routes.signup_path());
  };

  const headerText = referrer
    ? t("auth.join_referrer_on_gumroad", { name: referrer.name })
    : application_name
      ? t("auth.signup_and_connect_app", { app: application_name })
      : t("auth.creator_stats_headline", {
          creators: number_of_creators.toLocaleString(),
          amount: formatPrice("$", total_made, 0, { noCentsIfWhole: true }),
        });

  return (
    <Layout
      header={<h1>{headerText}</h1>}
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
              <Label htmlFor={`${uid}-email`}>{t("auth.email")}</Label>
            </FieldsetTitle>
            <Input
              id={`${uid}-email`}
              type="email"
              value={form.data.user.email}
              onChange={(e) => form.setData("user.email", e.target.value)}
              required
            />
          </Fieldset>
          <Fieldset>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-password`}>{t("auth.password")}</Label>
            </FieldsetTitle>
            <PasswordInput
              id={`${uid}-password`}
              value={form.data.user.password}
              onChange={(e) => form.setData("user.password", e.target.value)}
              required
            />
          </Fieldset>
          <Button color="primary" type="submit" disabled={form.processing}>
            {form.processing ? t("auth.creating_account") : t("auth.create_account")}
          </Button>
          <SlowConnectionNotice
            processing={form.processing}
            actionHref={Routes.login_path({ next })}
            actionLabel={t("auth.go_to_sign_in")}
          />
          <p>
            {t("auth.terms_agreement_prefix")} <a href="https://gumroad.com/terms">{t("auth.terms_of_use")}</a>{" "}
            {t("auth.and")} <a href="https://gumroad.com/privacy">{t("auth.privacy_policy")}</a>.
          </p>
        </section>
      </form>
    </Layout>
  );
}

SignupPage.publicLayout = true;
export default SignupPage;
