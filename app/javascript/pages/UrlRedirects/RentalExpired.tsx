import * as React from "react";

import { t } from "$app/utils/i18n";

import { UnavailablePageLayout, useUnavailablePageProps, withStandaloneLayout } from "./UnavailablePageLayout";

function RentalExpiredPage() {
  const pageProps = useUnavailablePageProps();

  return (
    <UnavailablePageLayout pageProps={pageProps}>
      <h2>{t("content.rental_expired_title")}</h2>
      <p>{t("content.rental_expired_desc")}</p>
    </UnavailablePageLayout>
  );
}

RentalExpiredPage.layout = withStandaloneLayout;

export default RentalExpiredPage;
