import { usePage } from "@inertiajs/react";
import * as React from "react";
import typia from "typia";

import { StandaloneLayout } from "$app/inertia/layout";
import { t } from "$app/utils/i18n";

import { Button } from "$app/components/Button";
import { Layout, LayoutProps } from "$app/components/DownloadPage/Layout";
import { Placeholder, PlaceholderImage } from "$app/components/ui/Placeholder";

import placeholderImage from "$assets/images/placeholders/comic-stars.webp";

type PageProps = LayoutProps;

const fullHeightPlaceholderClassName = "flex-1 content-center";

function MembershipInactivePage() {
  const pageProps = typia.assert<PageProps>(usePage().props);
  const { purchase } = pageProps;

  const isInstallmentPlan = purchase?.membership?.is_installment_plan;

  return (
    <Layout {...pageProps}>
      {isInstallmentPlan ? (
        <InstallmentPlanFailedOrCancelled
          product_name={purchase.product_name ?? ""}
          installment_plan={{
            is_alive_or_restartable: purchase.membership?.is_alive_or_restartable ?? null,
            subscription_id: purchase.membership?.subscription_id ?? "",
          }}
        />
      ) : (
        <MembershipInactiveContent
          product_name={purchase?.product_name ?? ""}
          product_long_url={purchase?.product_long_url ?? null}
          membership={
            purchase?.email && purchase.membership
              ? {
                  is_alive_or_restartable: purchase.membership.is_alive_or_restartable,
                  subscription_id: purchase.membership.subscription_id,
                }
              : null
          }
        />
      )}
    </Layout>
  );
}

const MembershipInactiveContent = ({
  product_name,
  product_long_url,
  membership,
}: {
  product_name: string;
  product_long_url: string | null;
  membership: {
    is_alive_or_restartable: boolean | null;
    subscription_id: string;
  } | null;
}) => (
  <Placeholder className={fullHeightPlaceholderClassName}>
    <PlaceholderImage src={placeholderImage} />
    <h2>{t("content.membership_inactive_title")}</h2>
    <p>{t("content.membership_inactive_desc", { product: product_name })}</p>
    {membership ? (
      membership.is_alive_or_restartable ? (
        <Button asChild color="primary">
          <a href={Routes.manage_subscription_url(membership.subscription_id)}>{t("storefront.manage_membership")}</a>
        </Button>
      ) : product_long_url ? (
        <Button asChild color="primary">
          <a href={product_long_url}>{t("content.resubscribe")}</a>
        </Button>
      ) : null
    ) : null}
  </Placeholder>
);

const InstallmentPlanFailedOrCancelled = ({
  product_name,
  installment_plan,
}: {
  product_name: string;
  installment_plan: {
    subscription_id: string;
    is_alive_or_restartable: boolean | null;
  };
}) => (
  <Placeholder className={fullHeightPlaceholderClassName}>
    <PlaceholderImage src={placeholderImage} />
    <h2>{t("content.installment_inactive_title")}</h2>
    {installment_plan.is_alive_or_restartable ? (
      <>
        <p>{t("content.installment_update_payment_desc", { product: product_name })}</p>
        <Button asChild color="primary">
          <a href={Routes.manage_subscription_url(installment_plan.subscription_id)}>
            {t("content.update_payment_method")}
          </a>
        </Button>
      </>
    ) : (
      <p>{t("content.installment_inactive_desc", { product: product_name })}</p>
    )}
  </Placeholder>
);

MembershipInactivePage.layout = (page: React.ReactNode) => <StandaloneLayout>{page}</StandaloneLayout>;

export default MembershipInactivePage;
