import { Link } from "@inertiajs/react";
import * as React from "react";

import { t } from "$app/utils/i18n";

import { LanguageToggle } from "$app/components/LanguageToggle";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Tabs, Tab } from "$app/components/ui/Tabs";

export const Layout = ({
  selectedTab,
  children,
}: {
  selectedTab: "purchases" | "wishlists" | "following_wishlists" | "reviews";
  children: React.ReactNode;
}) => (
  <div className="library">
    <PageHeader
      title={t("library.title")}
      actions={<LanguageToggle />}
    >
      <Tabs>
        <Tab isSelected={selectedTab === "purchases"} asChild>
          <Link href={Routes.library_path()}>{t("library.purchases")}</Link>
        </Tab>
        <Tab isSelected={selectedTab === "wishlists"} asChild>
          <Link href={Routes.wishlists_path()}>{t("library.saved")}</Link>
        </Tab>
        <Tab isSelected={selectedTab === "following_wishlists"} asChild>
          <Link href={Routes.wishlists_following_index_path()}>{t("library.following")}</Link>
        </Tab>
        <Tab isSelected={selectedTab === "reviews"} asChild>
          <Link href={Routes.reviews_path()}>{t("library.reviews")}</Link>
        </Tab>
      </Tabs>
    </PageHeader>
    {children}
  </div>
);
Layout.displayName = "Layout";
