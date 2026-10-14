import { Discord } from "@boxicons/react";
import * as React from "react";

import { fetchServerInfo } from "$app/data/discord_integration";
import { t } from "$app/utils/i18n";
import { DISCORD_CLIENT_ID, DISCORD_OAUTH_URL } from "$app/utils/integrations";
import { startOauthRedirectChecker } from "$app/utils/oauth";

import { Button } from "$app/components/Button";
import { LoadingSpinner } from "$app/components/LoadingSpinner";
import { useProductEditContext } from "$app/components/ProductEdit/state";
import { showAlert } from "$app/components/server-components/Alert";
import { ToggleSettingRow } from "$app/components/SettingRow";
import { Alert } from "$app/components/ui/Alert";
import { Checkbox } from "$app/components/ui/Checkbox";
import { Label } from "$app/components/ui/Label";
import { Switch } from "$app/components/ui/Switch";

export type DiscordIntegration = {
  keep_inactive_members: boolean;
  integration_details: { username: string; server_id: string; server_name: string };
} | null;

export const DiscordIntegrationEditor = ({
  integration,
  onChange,
}: {
  integration: DiscordIntegration;
  onChange: (integration: DiscordIntegration) => void;
}) => {
  const { product, updateProduct } = useProductEditContext();

  const [isLoading, setIsLoading] = React.useState(false);
  const [isEnabled, setIsEnabled] = React.useState(!!integration);

  const getDiscordUrl = () => {
    const url = new URL(DISCORD_OAUTH_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", Routes.oauth_redirect_integrations_discord_index_url());
    url.searchParams.set("scope", "bot identify");
    url.searchParams.set("permissions", "268435459"); // MANAGE ROLE, KICK MEMBER, INVITE MEMBER
    url.searchParams.set("client_id", DISCORD_CLIENT_ID);

    return url.toString();
  };

  const setEnabledForOptions = (enabled: boolean) =>
    updateProduct((product) => {
      for (const variant of product.variants) variant.integrations = { ...variant.integrations, discord: enabled };
    });

  return (
    <ToggleSettingRow
      value={isEnabled}
      onChange={(newValue) => {
        if (newValue) {
          setIsEnabled(true);
          setEnabledForOptions(true);
        } else {
          onChange(null);
          setIsEnabled(false);
          setEnabledForOptions(false);
        }
      }}
      label={t("seller.productEdit.discord_invite_label")}
      dropdown={
        <div className="flex flex-col gap-4">
          {t("seller.productEdit.discord_invite_desc")}
          {isLoading ? (
            <LoadingSpinner className="size-6" />
          ) : !integration ? (
            <div>
              <Button
                color="discord"
                onClick={() => {
                  setIsLoading(true);
                  const oauthPopup = window.open(getDiscordUrl(), "discord", "popup=yes");
                  startOauthRedirectChecker({
                    oauthPopup,
                    onSuccess: async (code) => {
                      const response = await fetchServerInfo(code);
                      if (response.ok) {
                        onChange({
                          keep_inactive_members: false,
                          integration_details: {
                            server_name: response.serverName,
                            server_id: response.serverId,
                            username: response.username,
                          },
                        });
                        setEnabledForOptions(true);
                      } else {
                        showAlert("Could not connect to your Discord account, please try again.", "error");
                      }
                      setIsLoading(false);
                    },
                    onError: () => {
                      showAlert("Could not connect to your Discord account, please try again.", "error");
                      setIsLoading(false);
                    },
                    onPopupClose: () => setIsLoading(false),
                  });
                }}
              >
                <Discord pack="brands" className="size-5" />
                {t("seller.productEdit.discord_connect")}
              </Button>
            </div>
          ) : (
            <>
              <div>
                <b>
                  {t("seller.productEdit.discord_account_connected", {
                    username: integration.integration_details.username,
                  })}
                </b>
                <div>
                  {t("seller.productEdit.discord_server_name", { name: integration.integration_details.server_name })}
                </div>
              </div>
              <div>
                <Button
                  color="danger"
                  onClick={() => {
                    setIsLoading(true);
                    onChange(null);
                    setIsLoading(false);
                  }}
                >
                  <Discord pack="brands" className="size-5" />
                  {t("seller.productEdit.discord_disconnect")}
                </Button>
              </div>
              {product.variants.length > 0 ? (
                <>
                  {product.variants.every(({ integrations }) => !integrations.discord) ? (
                    <Alert role="status" variant="warning">
                      {product.native_type === "membership"
                        ? t("seller.productEdit.circle_unassigned_tier")
                        : t("seller.productEdit.circle_unassigned_version")}
                    </Alert>
                  ) : null}
                  <Switch
                    checked={product.variants.every(({ integrations }) => integrations.discord)}
                    onChange={(e) => setEnabledForOptions(e.target.checked)}
                    label={
                      product.native_type === "membership"
                        ? t("seller.productEdit.circle_enable_all_tiers")
                        : t("seller.productEdit.circle_enable_all_versions")
                    }
                  />
                </>
              ) : null}
              {product.native_type === "membership" ? (
                <Label>
                  <Checkbox
                    checked={integration.keep_inactive_members}
                    onChange={() =>
                      onChange({ ...integration, keep_inactive_members: !integration.keep_inactive_members })
                    }
                  />
                  {t("seller.productEdit.discord_keep_inactive_label")}
                </Label>
              ) : null}
            </>
          )}
        </div>
      }
    />
  );
};
