import { Link, usePage } from "@inertiajs/react";
import * as React from "react";

import { SettingPage as Page } from "$app/parsers/settings";
import { useTranslation } from "$app/utils/i18n";

import { Button } from "$app/components/Button";
import { LanguageToggle } from "$app/components/LanguageToggle";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Tab, Tabs } from "$app/components/ui/Tabs";
import { useReactNativeMessage } from "$app/components/useReactNativeMessage";

const getTabTitle = (page: Page, t: (k: string, fb: string) => string): string => {
  switch (page) {
    case "main":
      return t("seller.settings.tabs.main", "Settings");
    case "profile":
      return t("seller.settings.tabs.profile", "Profile");
    case "team":
      return t("seller.settings.tabs.team", "Team");
    case "payments":
      return t("seller.settings.tabs.payments", "Payments");
    case "billing":
      return t("seller.settings.tabs.billing", "Billing");
    case "authorized_applications":
      return t("seller.settings.tabs.authorized_applications", "Applications");
    case "password":
      return t("seller.settings.tabs.password", "Password and authentication");
    case "social_connections":
      return t("seller.settings.tabs.social_connections", "Social connections");
    case "third_party_analytics":
      return t("seller.settings.tabs.third_party_analytics", "Third-party analytics");
    case "advanced":
      return t("seller.settings.tabs.advanced", "Advanced");
  }
};

type Props = {
  onSave?: () => void;
  pages: Page[];
  currentPage: Page;
  children: React.ReactNode;
  canUpdate?: boolean;
};

export const postToMobileApp = (message: object) => window.ReactNativeWebView?.postMessage(JSON.stringify(message));

export const Layout = ({ onSave, pages, currentPage, children, canUpdate }: Props) => {
  const { t } = useTranslation();
  const isMobileAppWebView = Boolean(usePage<{ is_mobile_app_web_view?: boolean }>().props.is_mobile_app_web_view);

  useReactNativeMessage((data) => {
    if (data.type === "mobileAppSettingsSave") onSave?.();
  });

  const canSave = Boolean(onSave && canUpdate);
  React.useEffect(() => {
    if (!isMobileAppWebView) return;
    postToMobileApp({ type: "settingsCanUpdate", canUpdate: canSave });
  }, [isMobileAppWebView, canSave]);

  if (isMobileAppWebView) return <div>{children}</div>;

  return (
    <>
      <PageHeader
        className="sticky-top"
        title={t("seller.settings.title", "Settings")}
        actions={
          <div className="flex items-center gap-3">
            <LanguageToggle />
            {onSave ? (
              <Button color="accent" onClick={onSave} disabled={!canUpdate}>
                {t("seller.settings.update_settings", "Update settings")}
              </Button>
            ) : null}
          </div>
        }
      >
        <Tabs>
          {pages.map((page) => (
            <Tab key={page} isSelected={currentPage === page} asChild>
              <Link href={Routes[`settings_${page}_path`]()}>{getTabTitle(page, t)}</Link>
            </Tab>
          ))}
        </Tabs>
      </PageHeader>
      <div>{children}</div>
    </>
  );
};
