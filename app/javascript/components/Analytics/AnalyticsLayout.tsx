import { Link } from "@inertiajs/react";
import * as React from "react";

import { assertDefined } from "$app/utils/assert";
import { t } from "$app/utils/i18n";

import { useLoggedInUser } from "$app/components/LoggedInUser";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Tabs, Tab } from "$app/components/ui/Tabs";

export const AnalyticsLayout = ({
  selectedTab,
  children,
  actions,
  title,
  showTabs = true,
}: {
  selectedTab: "following" | "sales" | "churn" | "utm_links";
  children: React.ReactNode;
  actions?: React.ReactNode;
  title?: string;
  showTabs?: boolean;
}) => {
  const user = assertDefined(useLoggedInUser());
  const resolvedTitle = title ?? t("seller.analytics.title");

  return (
    <div>
      <PageHeader title={resolvedTitle} actions={actions}>
        {showTabs ? (
          <Tabs>
            <Tab asChild isSelected={selectedTab === "following"}>
              <Link href={Routes.audience_dashboard_path()}>{t("seller.analytics.tabs_following")}</Link>
            </Tab>
            <Tab asChild isSelected={selectedTab === "sales"}>
              <Link href={Routes.sales_dashboard_path()}>{t("seller.analytics.tabs_sales")}</Link>
            </Tab>
            {user.policies.churn.show ? (
              <Tab asChild isSelected={selectedTab === "churn"}>
                <Link href={Routes.churn_dashboard_path()}>{t("seller.analytics.tabs_churn")}</Link>
              </Tab>
            ) : null}
            {user.policies.utm_link.index ? (
              <Tab asChild isSelected={selectedTab === "utm_links"}>
                <Link href={Routes.dashboard_utm_links_path()}>{t("seller.analytics.tabs_links")}</Link>
              </Tab>
            ) : null}
          </Tabs>
        ) : null}
      </PageHeader>
      {children}
    </div>
  );
};
