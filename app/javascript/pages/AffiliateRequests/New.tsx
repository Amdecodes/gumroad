import { useForm, usePage } from "@inertiajs/react";
import * as React from "react";
import typia from "typia";

import { useTranslate } from "$app/hooks/useTranslate";
import { CreatorProfile } from "$app/parsers/profile";

import { Button } from "$app/components/Button";
import { useAppDomain } from "$app/components/DomainSettings";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import { Layout } from "$app/components/Profile/Layout";
import { Alert } from "$app/components/ui/Alert";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { FormSection } from "$app/components/ui/FormSection";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Textarea } from "$app/components/ui/Textarea";

type Props = {
  creator_profile: CreatorProfile;
  success: boolean;
  requester_has_existing_account: boolean;
  email_param: string | null;
};

const AffiliateRequestsNew = () => {
  const { t } = useTranslate();
  const { creator_profile, success, requester_has_existing_account, email_param } = typia.assert<Props>(
    usePage().props,
  );

  const appDomain = useAppDomain();
  const loggedInUser = useLoggedInUser();

  const { data, setData, post, processing } = useForm({
    affiliate_request: {
      name: loggedInUser?.name || "",
      email: loggedInUser?.email || "",
      promotion_text: "",
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    post(Routes.custom_domain_create_affiliate_request_path());
  };

  const nameUID = React.useId();
  const emailUID = React.useId();
  const promotionUID = React.useId();

  const successEmail = email_param || data.affiliate_request.email;

  const [signupBefore, signupAfter] = t("seller.affiliates.create_account_in_meantime", {
    signup_link: "___SIGNUP___",
    email: successEmail,
    app_name: "Gumroad",
  }).split("___SIGNUP___");

  return (
    <Layout creatorProfile={creator_profile}>
      {/* Gutter outside the cap, matching the form below, keeps the title on the form's left edge. */}
      <div className="px-4 lg:px-0">
        <PageHeader
          title={t("seller.affiliates.apply_become_affiliate", { name: creator_profile.name })}
          className="mx-auto w-full max-w-6xl border-0"
        />
      </div>
      <form className="border-y border-border px-4 pt-8 lg:px-0" onSubmit={onSubmit}>
        <FormSection
          className="mx-auto w-full max-w-6xl"
          header={
            <>
              <p>{t("seller.affiliates.apply_form_desc_1", { name: creator_profile.name })}</p>
              <p>{t("seller.affiliates.apply_form_desc_2")}</p>
            </>
          }
        >
          {success ? (
            <Alert variant="success">
              <div className="flex flex-col gap-4">
                <p>{t("seller.affiliates.request_submitted")}</p>
                {requester_has_existing_account ? null : (
                  <p>
                    {signupBefore}
                    <a href={Routes.signup_url({ host: appDomain, email: successEmail })}>
                      {t("seller.affiliates.create_account_link", { app_name: "Gumroad" })}
                    </a>
                    {signupAfter}
                  </p>
                )}
              </div>
            </Alert>
          ) : (
            <>
              {loggedInUser?.name ? null : (
                <Fieldset>
                  <FieldsetTitle>
                    <Label htmlFor={nameUID}>{t("seller.affiliates.col_name")}</Label>
                  </FieldsetTitle>
                  <Input
                    id={nameUID}
                    type="text"
                    required
                    value={data.affiliate_request.name}
                    onChange={(event) => setData("affiliate_request.name", event.target.value)}
                  />
                </Fieldset>
              )}
              {loggedInUser?.email ? null : (
                <Fieldset>
                  <FieldsetTitle>
                    <Label htmlFor={emailUID}>{t("seller.affiliates.email")}</Label>
                  </FieldsetTitle>
                  <Input
                    id={emailUID}
                    type="email"
                    required
                    value={data.affiliate_request.email}
                    onChange={(event) => setData("affiliate_request.email", event.target.value)}
                  />
                </Fieldset>
              )}
              <Fieldset>
                <FieldsetTitle>
                  <Label htmlFor={promotionUID}>{t("seller.affiliates.promotion")}</Label>
                </FieldsetTitle>
                <Textarea
                  id={promotionUID}
                  rows={5}
                  placeholder={t("seller.affiliates.promotion_placeholder")}
                  value={data.affiliate_request.promotion_text}
                  onChange={(event) => setData("affiliate_request.promotion_text", event.target.value)}
                />
              </Fieldset>
              <Button type="submit" color="accent" disabled={processing}>
                {processing ? t("seller.affiliates.submitting") : t("seller.affiliates.submit_affiliate_request")}
              </Button>
            </>
          )}
        </FormSection>
      </form>
    </Layout>
  );
};

AffiliateRequestsNew.loggedInUserLayout = true;
export default AffiliateRequestsNew;
