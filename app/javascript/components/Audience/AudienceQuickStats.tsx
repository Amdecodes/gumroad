import { Circle } from "@boxicons/react";
import * as React from "react";

import { t } from "$app/utils/i18n";

import { Stats } from "$app/components/Stats";
import { useUserAgentInfo } from "$app/components/UserAgent";

export const AudienceQuickStats = ({
  totalFollowers,
  newFollowers,
}: {
  totalFollowers: number;
  newFollowers: number | null;
}) => {
  const userAgentInfo = useUserAgentInfo();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Stats
        className="total-followers"
        title={
          <>
            <Circle pack="filled" className="size-5 text-accent" />
            {t("seller.audience.lifetime_followers")}
            <div className="legend" />
          </>
        }
        value={newFollowers != null ? totalFollowers.toLocaleString(userAgentInfo.locale) : ""}
      />
      <Stats
        className="new-followers"
        title={
          <>
            <Circle pack="filled" className="size-5 text-active-bg" />
            {t("seller.audience.new_followers")}
            <div className="legend" />
          </>
        }
        value={newFollowers != null ? newFollowers.toLocaleString(userAgentInfo.locale) : ""}
      />
    </div>
  );
};
