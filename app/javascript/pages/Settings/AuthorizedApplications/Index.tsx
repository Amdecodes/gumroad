import { XSquare } from "@boxicons/react";
import { router, usePage } from "@inertiajs/react";
import { parseISO } from "date-fns";
import * as React from "react";
import typia from "typia";

import { SettingPage } from "$app/parsers/settings";
import { useTranslate } from "$app/utils/i18n";

import { Button } from "$app/components/Button";
import { Modal } from "$app/components/Modal";
import { showAlert } from "$app/components/server-components/Alert";
import { Layout } from "$app/components/Settings/Layout";
import { Placeholder } from "$app/components/ui/Placeholder";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";
import { useUserAgentInfo } from "$app/components/UserAgent";

import placeholderAppIcon from "$assets/images/gumroad_app.png";

type AuthorizedApplication = {
  name: string;
  scopes: readonly Scope[];
  icon_url: string | null;
  is_own_app: boolean;
  first_authorized_at: string;
  id: string;
};

type Scope =
  | "account"
  | "edit_emails"
  | "edit_products"
  | "ifttt"
  | "mark_sales_as_shipped"
  | "refund_sales"
  | "edit_sales"
  | "unfurl"
  | "view_profile"
  | "edit_profile"
  | "view_public"
  | "view_sales"
  | "view_payouts"
  | "view_tax_data"
  | "revenue_share"
  | "mobile_api"
  | "helper_api"
  | "creator_api";

const useScopeDescriptions = (): Record<Scope, string> => {
  const { t } = useTranslate();
  return {
    account: t("seller.settings.applications.scope_account"),
    edit_emails: t("seller.settings.applications.scope_edit_emails"),
    edit_products: t("seller.settings.applications.scope_edit_products"),
    ifttt: t("seller.settings.applications.scope_ifttt"),
    mark_sales_as_shipped: t("seller.settings.applications.scope_mark_sales_as_shipped"),
    refund_sales: t("seller.settings.applications.scope_refund_sales"),
    edit_sales: t("seller.settings.applications.scope_edit_sales"),
    unfurl: t("seller.settings.applications.scope_unfurl"),
    view_profile: t("seller.settings.applications.scope_view_profile"),
    edit_profile: t("seller.settings.applications.scope_edit_profile"),
    view_public: t("seller.settings.applications.scope_view_public"),
    view_sales: t("seller.settings.applications.scope_view_sales"),
    view_payouts: t("seller.settings.applications.scope_view_payouts"),
    view_tax_data: t("seller.settings.applications.scope_view_tax_data"),
    revenue_share: t("seller.settings.applications.scope_revenue_share"),
    mobile_api: t("seller.settings.applications.scope_mobile_api"),
    helper_api: t("seller.settings.applications.scope_helper_api"),
    creator_api: t("seller.settings.applications.scope_creator_api"),
  };
};

type Props = {
  settings_pages: SettingPage[];
  authorized_applications: AuthorizedApplication[];
};

export default function AuthorizedApplicationsPage() {
  const { t } = useTranslate();
  const scopeDescriptions = useScopeDescriptions();
  const props = typia.assert<Props>(usePage().props);
  const userAgentInfo = useUserAgentInfo();
  const [applications, setApplications] = React.useState(props.authorized_applications);
  const [revokingAccessForApp, setRevokingAccessForApp] = React.useState<{ id: string; revoking?: boolean } | null>(
    null,
  );

  const handleRevokeAccess = (id: string) => {
    setRevokingAccessForApp({ id, revoking: true });
    router.delete(Routes.oauth_authorized_application_path(id), {
      only: ["authorized_applications"],
      onSuccess: (page) => {
        const updatedProps = typia.assert<Props>(page.props);
        setApplications(updatedProps.authorized_applications);
        showAlert("Authorized application revoked", "success");
        setRevokingAccessForApp(null);
      },
      onError: () => {
        showAlert("Sorry, something went wrong. Please try again.", "error");
        setRevokingAccessForApp(null);
      },
    });
  };

  return (
    <Layout currentPage="authorized_applications" pages={props.settings_pages}>
      {applications.length > 0 ? (
        <section className="p-4! md:p-8!">
          <Table>
            <TableCaption>
              {t("seller.settings.applications.authorized_apps_caption", { app_name: "Gumroad" })}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("seller.settings.applications.application")}</TableHead>
                <TableHead>{t("seller.settings.applications.permissions")}</TableHead>
                <TableHead>{t("seller.settings.applications.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell hideLabel>
                    <div className="flex gap-3">
                      <div className="shrink-0">
                        <img
                          src={application.icon_url || placeholderAppIcon}
                          className="rounded border"
                          width={72}
                          height={72}
                          alt={application.name}
                        />
                      </div>
                      <div>
                        <h3 style={{ marginBottom: "var(--spacer-1)" }}>
                          {application.name}
                          {application.is_own_app ? (
                            <span>{t("seller.settings.applications.your_application")}</span>
                          ) : null}
                        </h3>
                        <p>
                          <small className="block">
                            {t("seller.settings.applications.first_authorized_on", {
                              date: parseISO(application.first_authorized_at).toLocaleDateString(userAgentInfo.locale, {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              }),
                            })}
                          </small>
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ul>
                      {application.scopes.map((scope) => (
                        <li key={scope}>{scopeDescriptions[scope]}</li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell hideLabel>
                    <Button color="danger" outline onClick={() => setRevokingAccessForApp({ id: application.id })}>
                      <XSquare className="size-5" />
                      {t("seller.settings.applications.revoke_access")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {revokingAccessForApp ? (
            <Modal
              open
              allowClose={!revokingAccessForApp.revoking}
              title={t("seller.settings.applications.revoke_access_title")}
              onClose={() => {
                setRevokingAccessForApp(null);
              }}
              footer={
                <>
                  <Button onClick={() => setRevokingAccessForApp(null)}>{t("seller.settings.password.cancel")}</Button>
                  <Button
                    color="danger"
                    disabled={revokingAccessForApp.revoking}
                    onClick={() => handleRevokeAccess(revokingAccessForApp.id)}
                  >
                    {revokingAccessForApp.revoking
                      ? t("seller.settings.applications.revoking_access")
                      : t("seller.settings.applications.yes_revoke_access")}
                  </Button>
                </>
              }
            >
              <p>
                {t("seller.settings.applications.revoke_access_confirm", {
                  name: applications.find((app) => app.id === revokingAccessForApp.id)?.name ?? "",
                })}
              </p>
            </Modal>
          ) : null}
        </section>
      ) : (
        <div className="p-4 md:p-8">
          <Placeholder>
            <h3>{t("seller.settings.applications.empty_title")}</h3>
            <p>{t("seller.settings.applications.empty_description", { app_name: "Gumroad" })}</p>
          </Placeholder>
        </div>
      )}
    </Layout>
  );
}
