import { Dollar, UserCircle } from "@boxicons/react";
import * as React from "react";

import { formatPriceCentsWithCurrencySymbol } from "$app/utils/currency";
import { t } from "$app/utils/i18n";

import { useLoggedInUser } from "$app/components/LoggedInUser";
import { Card, CardContent } from "$app/components/ui/Card";
import { Placeholder } from "$app/components/ui/Placeholder";
import { useUserAgentInfo } from "$app/components/UserAgent";
type SaleItemDetails = {
  price_cents: number;
  email: string;
  full_name: string | null;
  product_name: string;
  product_unique_permalink: string;
};

type FollowItemDetails = { email: string; name: string | null };

export type ActivityItem =
  | { type: "new_sale"; timestamp: string; details: SaleItemDetails }
  | { type: "follower_added" | "follower_removed"; timestamp: string; details: FollowItemDetails };

const Sale = ({ details: { price_cents, product_name, product_unique_permalink } }: { details: SaleItemDetails }) => {
  const price = formatPriceCentsWithCurrencySymbol("usd", price_cents, { symbolFormat: "short", noCentsIfWhole: true });
  const rawText = t("seller.dashboard.new_sale_item", { name: "\u0000", price });
  const [before, after] = rawText.split("\u0000");

  return (
    <>
      <Dollar className="size-5 text-green" />
      <span>
        {before}
        <a href={Routes.short_link_path({ id: product_unique_permalink })}>{product_name}</a>
        {after}
      </span>
    </>
  );
};

const Follow = ({ details: { email, name } }: { details: FollowItemDetails }) => (
  <>
    <UserCircle pack="filled" className="size-5" />
    <span> {t("seller.dashboard.follower_added_item", { name: name || email })}</span>
  </>
);

const FollowRemoved = ({ details: { email, name } }: { details: FollowItemDetails }) => (
  <>
    <UserCircle pack="filled" className="size-5" />
    <span> {t("seller.dashboard.follower_removed_item", { name: name || email })}</span>
  </>
);

export const ActivityFeed = ({ items }: { items: ActivityItem[] }) => {
  const loggedInUser = useLoggedInUser();
  const userAgentInfo = useUserAgentInfo();

  if (!items.length) {
    return (
      <Placeholder>
        <p>
          {t("seller.dashboard.activity_empty")}
          {loggedInUser?.policies.product.create ? (
            <span>
              {" "}
              {t("seller.dashboard.activity_empty_prompt")}{" "}
              <a href={Routes.products_path()}>{t("seller.dashboard.create_a_product")}</a>{" "}
              {t("seller.dashboard.activity_empty_or")}{" "}
              <a href={Routes.profile_path()}>{t("seller.dashboard.customize_your_profile")}</a>
            </span>
          ) : null}
        </p>
      </Placeholder>
    );
  }

  return (
    <Card>
      {items.map(({ type, timestamp, details }, i) => (
        <CardContent key={i}>
          <span className="flex grow gap-3">
            {type === "new_sale" && <Sale details={details} />}
            {type === "follower_added" && <Follow details={details} />}
            {type === "follower_removed" && <FollowRemoved details={details} />}
          </span>
          <span className="text-muted" suppressHydrationWarning>
            {new Date(timestamp).toLocaleString(userAgentInfo.locale, { dateStyle: "medium", timeStyle: "short" })}
          </span>
        </CardContent>
      ))}
    </Card>
  );
};
