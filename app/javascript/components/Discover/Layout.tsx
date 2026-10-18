import { BookmarkHeart, Search as SearchIcon, User } from "@boxicons/react";
import * as React from "react";

import { classNames } from "$app/utils/classNames";
import { Taxonomy } from "$app/utils/discover";
import { t } from "$app/utils/i18n";
import { getTaxonomyLabel } from "$app/utils/taxonomy";

import { NavigationButton } from "$app/components/Button";
import { CartNavigationButton } from "$app/components/Checkout/CartNavigationButton";
import { useCurrentSeller } from "$app/components/CurrentSeller";
import { Nav } from "$app/components/Discover/Nav";
import { Search } from "$app/components/Discover/Search";
import { useDomains } from "$app/components/DomainSettings";
import { LanguageToggle } from "$app/components/LanguageToggle";
import { Logo } from "$app/components/Logo";
import { Avatar } from "$app/components/ui/Avatar";
import { useIsAboveBreakpoint } from "$app/components/useIsAboveBreakpoint";

const UserActionButtons: React.FC = () => {
  const currentSeller = useCurrentSeller();

  if (currentSeller) {
    return (
      <>
        <NavigationButton href={Routes.library_url()} className="border-white/20 text-white hover:bg-white/10 flex-1 lg:flex-none">
          <BookmarkHeart pack="filled" className="size-4" /> {t("navigation.library")}
        </NavigationButton>
        {currentSeller.has_published_products ? null : (
          <NavigationButton href={Routes.products_url()} color="primary" className="flex-1 lg:flex-none">
            {t("navigation.start_selling")}
          </NavigationButton>
        )}
      </>
    );
  }

  return (
    <>
      <NavigationButton href={Routes.login_url()} className="border-white/20 text-white hover:bg-white/10 flex-1 lg:flex-none">
        {t("auth.log_in")}
      </NavigationButton>
      <NavigationButton href={Routes.signup_url()} color="primary" className="flex-1 lg:flex-none">
        {t("navigation.start_selling")}
      </NavigationButton>
    </>
  );
};

interface HeaderRowElementsProps {
  logoLink: React.ReactNode;
  searchBar: React.ReactNode;
  userActionButtons: React.ReactNode;
  cartButton: React.ReactNode;
  avatarElement: React.ReactNode;
  navElementNoFooter: React.ReactNode;
  navElementWithFooter: React.ReactNode;
}

const DesktopHeaderRows: React.FC<HeaderRowElementsProps> = ({
  logoLink,
  searchBar,
  userActionButtons,
  cartButton,
  avatarElement,
}) => (
  <div className="flex w-full items-center justify-between gap-6">
    <div className="flex items-center gap-6 flex-1 max-w-2xl">
      {logoLink}
      {searchBar}
    </div>
    <div className="flex shrink-0 items-center space-x-3">
      <LanguageToggle />
      {userActionButtons}
      {cartButton}
      {avatarElement}
    </div>
  </div>
);

const MobileHeaderRows: React.FC<HeaderRowElementsProps> = ({
  logoLink,
  searchBar,
  cartButton,
  avatarElement,
  navElementWithFooter,
}) => (
  <>
    <div className="flex w-full items-center justify-between gap-3">
      {logoLink}
      <div className="flex items-center gap-3">
        <LanguageToggle variant="compact" />
        {avatarElement}
        {cartButton}
      </div>
    </div>
    <div className="flex w-full items-center gap-2">
      {searchBar}
      {navElementWithFooter}
    </div>
  </>
);

export const Layout: React.FC<{
  taxonomiesForNav: Taxonomy[];
  taxonomyPath?: string | undefined;
  showTaxonomy?: boolean;
  onTaxonomyChange?: (newTaxonomyPath?: string) => void;
  query?: string | undefined;
  setQuery?: (query: string) => void;
  className?: string;
  children: React.ReactNode;
  forceDomain?: boolean;
}> = ({
  taxonomiesForNav,
  taxonomyPath,
  showTaxonomy,
  onTaxonomyChange,
  query,
  setQuery,
  className,
  children,
  forceDomain = false,
}) => {
  const { discoverDomain, appDomain } = useDomains();
  const isDesktop = useIsAboveBreakpoint("lg");
  const currentSeller = useCurrentSeller();

  setQuery ??= (query) => (window.location.href = Routes.discover_url({ host: discoverDomain, query }));

  onTaxonomyChange ??= (newTaxonomyPath) => {
    window.location.href = forceDomain
      ? newTaxonomyPath || Routes.discover_path()
      : Routes.discover_url({ host: discoverDomain, taxonomy: newTaxonomyPath });
  };

  const userActionButtons = <UserActionButtons />;

  const logoLink = (
    <a href={Routes.discover_url({ host: discoverDomain })} className="flex shrink-0 items-center" aria-label={t("navigation.discover")}>
      <Logo className="h-8 w-auto text-white" />
    </a>
  );
  const searchBar = (
    <div className="min-w-0 grow">
      <Search query={query} setQuery={setQuery} />
    </div>
  );
  const cartButton = <CartNavigationButton className="shrink-0 text-white border-white/20 hover:bg-white/10" />;
  const avatarElement = currentSeller ? (
    <a href={Routes.dashboard_url({ host: appDomain })} aria-label={t("navigation.dashboard")} className="shrink-0">
      <Avatar src={currentSeller.avatarUrl} />
    </a>
  ) : null;

  const navElementWithFooter = (
    <Nav
      wholeTaxonomy={taxonomiesForNav}
      currentTaxonomyPath={taxonomyPath}
      onClickTaxonomy={onTaxonomyChange}
      forceDomain={forceDomain}
      footer={<div className="flex gap-4 border-b p-4 pb-4">{userActionButtons}</div>}
    />
  );

  const navElementNoFooter = (
    <Nav
      wholeTaxonomy={taxonomiesForNav}
      currentTaxonomyPath={taxonomyPath}
      onClickTaxonomy={onTaxonomyChange}
      forceDomain={forceDomain}
      footer={undefined}
    />
  );

  const headerRowElementsProps: HeaderRowElementsProps = {
    logoLink,
    searchBar,
    userActionButtons,
    cartButton,
    avatarElement,
    navElementNoFooter,
    navElementWithFooter,
  };

  return (
    <div className={className}>
      <header className="sticky top-0 z-40 border-b border-white/15 dark:border-white/20 bg-navy px-4 py-3 text-white shadow-xs lg:px-8">
        <div className="mx-auto flex max-w-7xl w-full flex-col gap-3">
          {isDesktop ? (
            <DesktopHeaderRows {...headerRowElementsProps} />
          ) : (
            <MobileHeaderRows {...headerRowElementsProps} />
          )}
        </div>
      </header>

      {/* Category navigation strip */}
      <nav aria-label={t("discover.categories")} className="border-b border-border/80 bg-background/95 backdrop-blur-sm px-4 py-2 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="grow overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{navElementNoFooter}</div>
        </div>
      </nav>

      {showTaxonomy && taxonomyPath ? (
        <div className="border-b border-border/60 bg-muted/20 px-4 py-2 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <TaxonomyCategoryBreadcrumbs
              taxonomyPath={taxonomyPath}
              taxonomies={taxonomiesForNav}
              onClickTaxonomy={onTaxonomyChange}
            />
          </div>
        </div>
      ) : null}

      <main className="min-h-[calc(100vh-250px)] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>

      <BuyerMobileTabBar />
    </div>
  );
};

const BuyerMobileTabBar: React.FC = () => {
  const { discoverDomain, appDomain } = useDomains();
  const currentSeller = useCurrentSeller();

  return (
    <nav
      aria-label={t("navigation.main")}
      className="fixed bottom-0 inset-x-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] items-center justify-around border-t border-white/15 dark:border-white/20 bg-navy/95 backdrop-blur-md px-2 text-white md:hidden shadow-lg"
    >
      <a
        href={Routes.discover_url({ host: discoverDomain })}
        aria-current="page"
        className="flex flex-col items-center justify-center gap-0.5 text-xs text-white font-semibold no-underline py-1 px-3"
      >
        <SearchIcon className="size-5" />
        <span className="relative">
          {t("navigation.discover")}
          <span className="absolute -bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-blue" />
        </span>
      </a>
      <a
        href={Routes.library_url()}
        className="flex flex-col items-center justify-center gap-0.5 text-xs text-white/70 hover:text-white no-underline py-1 px-3"
      >
        <BookmarkHeart className="size-5" />
        <span>{t("navigation.library")}</span>
      </a>
      {currentSeller ? (
        <a
          href={Routes.dashboard_url({ host: appDomain })}
          className="flex flex-col items-center justify-center gap-0.5 text-xs text-white/70 hover:text-white no-underline py-1 px-3"
        >
          <User className="size-5" />
          <span>{t("navigation.dashboard")}</span>
        </a>
      ) : (
        <a
          href={Routes.login_url()}
          className="flex flex-col items-center justify-center gap-0.5 text-xs text-white/70 hover:text-white no-underline py-1 px-3"
        >
          <User className="size-5" />
          <span>{t("auth.log_in")}</span>
        </a>
      )}
    </nav>
  );
};

const TaxonomyCategoryBreadcrumbs = ({
  taxonomyPath,
  taxonomies,
  onClickTaxonomy,
}: {
  taxonomyPath: string;
  taxonomies: Taxonomy[];
  onClickTaxonomy: (taxonomySlugPath?: string) => void;
}) => (
  <div role="navigation" className="mt-4" aria-label={t("navigation.breadcrumbs")}>
    <ol
      itemScope
      itemType="https://schema.org/BreadcrumbList"
      className="flex list-none flex-wrap p-0 text-xl leading-[1.3]"
    >
      {taxonomyPath.split("/").map((slug, index, breadcrumbs) => {
        const taxonomySlugPath = breadcrumbs.slice(0, index + 1).join("/");
        const fallback = taxonomies.find((t) => t.slug === slug)?.label ?? slug;
        const label = getTaxonomyLabel(slug, fallback);
        const isPage = index === breadcrumbs.length - 1;
        return (
          <li key={taxonomySlugPath} itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
            {index > 0 ? (
              <span aria-hidden="true" className="mx-2 select-none">
                /
              </span>
            ) : null}
            <a
              href={`/${taxonomySlugPath}`}
              onClick={(e) => {
                if (e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                onClickTaxonomy(taxonomySlugPath);
              }}
              aria-current={isPage ? "page" : undefined}
              itemProp="item"
              className={classNames({ "no-underline": isPage })}
            >
              <span itemProp="name">{label}</span>
            </a>
            <meta itemProp="position" content={(index + 1).toString()} />
          </li>
        );
      })}
    </ol>
  </div>
);
