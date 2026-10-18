import { Pencil, Star, TwitterX, Youtube } from "@boxicons/react";
import * as React from "react";

import { CreatorProfile } from "$app/parsers/profile";
import { t } from "$app/utils/i18n";

import { NavigationButton } from "$app/components/Button";
import { CartNavigationButton } from "$app/components/Checkout/CartNavigationButton";
import { useAppDomain } from "$app/components/DomainSettings";
import { LanguageToggle } from "$app/components/LanguageToggle";
import { PoweredByFooter } from "$app/components/PoweredByFooter";
import { TopCreatorBadge } from "$app/components/Product/AuthorByline";
import { FollowForm } from "$app/components/Profile/FollowForm";
import { Avatar } from "$app/components/ui/Avatar";
import { useIsAboveBreakpoint } from "$app/components/useIsAboveBreakpoint";
import { WithTooltip } from "$app/components/WithTooltip";

type LayoutProps = {
  creatorProfile: CreatorProfile;
  hideFollowForm?: boolean;
  // Off by default: this layout also runs the product editor's preview and the profile settings
  // preview, where a buyer currency control belongs to nobody and a reload discards unsaved edits.
  currencySelector?: boolean | undefined;
  shownCurrency?: string | null | undefined;
  children?: React.ReactNode;
};

export const Layout = ({ creatorProfile, hideFollowForm, currencySelector, shownCurrency, children }: LayoutProps) => {
  const appDomain = useAppDomain();
  const isDesktop = useIsAboveBreakpoint("lg");
  const hideSubscribeForm = hideFollowForm || Boolean(creatorProfile.hide_follow_form);
  const youtubeChannelId = creatorProfile.youtube_channel_id;

  const headerButtons = (
    <div className="flex shrink-0 items-center gap-3 lg:ml-auto">
      <LanguageToggle variant="compact" />
      {creatorProfile.can_edit ? (
        <NavigationButton color="filled" className="whitespace-nowrap" href={Routes.profile_url({ host: appDomain })}>
          <Pencil className="size-5" />
          {t("profile.edit_profile")}
        </NavigationButton>
      ) : null}
      {creatorProfile.twitter_handle ? (
        <NavigationButton outline href={`https://twitter.com/${creatorProfile.twitter_handle}`} target="_blank">
          <TwitterX pack="brands" className="size-5" />
        </NavigationButton>
      ) : null}
      {youtubeChannelId ? (
        <NavigationButton
          outline
          href={`https://www.youtube.com/channel/${encodeURIComponent(youtubeChannelId)}`}
          target="_blank"
          aria-label={t("navigation.youtube", "YouTube")}
        >
          <Youtube pack="brands" className="size-5" />
        </NavigationButton>
      ) : null}
      <CartNavigationButton />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 lg:flex-nowrap">
          <div className="relative flex min-w-0 grow flex-wrap items-center gap-3 lg:flex-1 lg:flex-nowrap">
            {creatorProfile.avatar_url ? (
              <Avatar
                src={creatorProfile.avatar_url}
                alt={t("profile.profile_picture")}
                className="size-10 rounded-full ring-2 ring-primary/20"
              />
            ) : null}
            <a href={Routes.root_path()} className="flex max-w-full min-w-0 items-center gap-2 no-underline">
              <span className="truncate font-heading text-lg font-bold tracking-tight text-foreground hover:text-royal-blue transition-colors">
                {creatorProfile.name}
              </span>
              {creatorProfile.is_verified ? (
                <WithTooltip tip={t("profile.top_creator")} position="bottom" className="shrink-0">
                  <TopCreatorBadge />
                </WithTooltip>
              ) : null}
            </a>
            {creatorProfile.reputation ? (
              <div
                className="flex min-w-0 flex-wrap items-center gap-1 rounded-full bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                aria-label={t("profile.creator_rating")}
              >
                <Star pack="filled" className="size-3.5 text-yellow" />
                {t("profile.creator_rating_summary", {
                  average: creatorProfile.reputation.average,
                  count_reviews: t("storefront.verified_reviews_count", {
                    count: creatorProfile.reputation.count,
                  }),
                  products_count: creatorProfile.reputation.products_count,
                })}
              </div>
            ) : null}
          </div>
          {!hideSubscribeForm ? (
            <div className="flex basis-full items-center gap-3 lg:basis-auto">
              <FollowForm creatorProfile={creatorProfile} />
            </div>
          ) : null}
          {!isDesktop ? <div className="flex basis-full justify-end pt-2">{headerButtons}</div> : null}
          {isDesktop ? headerButtons : null}
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        {children}
        <PoweredByFooter
          className="mx-auto w-full max-w-6xl"
          currencySelector={currencySelector}
          shownCurrency={shownCurrency}
        />
      </main>
    </div>
  );
};
