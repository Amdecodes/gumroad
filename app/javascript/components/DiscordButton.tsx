import { Discord } from "@boxicons/react";
import * as React from "react";

import { joinServer, leaveServer } from "$app/data/discord_integration";
import { t } from "$app/utils/i18n";
import { DISCORD_CLIENT_ID, DISCORD_OAUTH_URL } from "$app/utils/integrations";
import { startOauthRedirectChecker } from "$app/utils/oauth";

import { Button } from "$app/components/Button";
import { LoadingSpinner } from "$app/components/LoadingSpinner";
import { showAlert } from "$app/components/server-components/Alert";

export const DiscordButton = ({
  purchaseId,
  token,
  connected,
  redirectSettings,
  customState,
}: {
  purchaseId: string;
  token?: string | null;
  connected: boolean;
  redirectSettings?: { host: string; protocol: string };
  customState?: string;
}) => {
  const [discordConnected, setDiscordConnected] = React.useState(connected);
  const [loading, setLoading] = React.useState(false);

  const openJoinDiscordPopup = () => {
    if (discordConnected) return;
    setLoading(true);

    const url = new URL(DISCORD_OAUTH_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", Routes.oauth_redirect_integrations_discord_index_url(redirectSettings));
    url.searchParams.set("scope", "identify guilds.join");
    url.searchParams.set("client_id", DISCORD_CLIENT_ID);
    if (customState) url.searchParams.set("state", customState);

    const oauthPopup = window.open(url, "discord", "popup=yes");

    startOauthRedirectChecker({
      oauthPopup,
      onSuccess: async (code) => {
        const response = await joinServer(code, purchaseId, token);
        if (response.ok) {
          showAlert(t("content.added_to_discord", { server: response.serverName }), "success");
          setDiscordConnected(true);
        } else {
          showAlert(t("checkout.something_went_wrong_retry"), "error");
        }
        setLoading(false);
      },
      onError: () => {
        showAlert(t("checkout.something_went_wrong_retry"), "error");
        setLoading(false);
      },
      onPopupClose: () => setLoading(false),
    });
  };

  const leaveDiscord = async () => {
    if (!discordConnected) return;
    setLoading(true);

    const response = await leaveServer(purchaseId, token);
    if (response.ok) {
      showAlert(t("content.left_discord", { server: response.serverName }), "success");
      setDiscordConnected(false);
    } else {
      showAlert(t("checkout.something_went_wrong_retry"), "error");
    }
    setLoading(false);
  };

  return loading ? (
    <div className="flex items-center">
      <LoadingSpinner className="size-8" />
    </div>
  ) : (
    <Button color="discord" onClick={discordConnected ? leaveDiscord : openJoinDiscordPopup}>
      <Discord pack="brands" className="size-5" />
      {discordConnected ? t("content.leave_discord") : t("content.join_discord")}
    </Button>
  );
};
