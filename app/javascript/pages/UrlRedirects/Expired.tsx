import * as React from "react";

import { t } from "$app/utils/i18n";

import { UnavailablePageLayout, useUnavailablePageProps, withStandaloneLayout } from "./UnavailablePageLayout";

function ExpiredPage() {
  const pageProps = useUnavailablePageProps();

  return (
    <UnavailablePageLayout pageProps={pageProps}>
      <h2>{t("content.access_expired_title")}</h2>
      <p>{t("content.access_expired_desc")}</p>
    </UnavailablePageLayout>
  );
}

ExpiredPage.layout = withStandaloneLayout;

export default ExpiredPage;
