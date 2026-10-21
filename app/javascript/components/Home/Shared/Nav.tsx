import { ArrowUpRight, Star } from "@boxicons/react";
import { Link, usePage } from "@inertiajs/react";
import * as React from "react";

import { LoggedInUser } from "$app/types/user";
import { classNames } from "$app/utils/classNames";
import { t } from "$app/utils/i18n";
import { request } from "$app/utils/request";

import logoSvg from "$assets/images/logo.svg";

type PageProps = {
  current_user?: LoggedInUser;
};

type GithubStarsResponse = {
  stars?: number;
};

const NavLink = ({
  href,
  children,
  onClick,
  isActive,
  isInertia = false,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: ((event: React.MouseEvent) => void) | undefined;
  isActive: boolean;
  isInertia?: boolean;
}) => {
  const className = classNames(
    "flex w-full items-center justify-center p-3 text-sm text-white no-underline transition-colors lg:w-auto lg:rounded-full lg:py-1.5 lg:px-3.5 whitespace-nowrap",
    isActive ? "bg-white/15 text-white font-medium" : "text-white/80 hover:text-white hover:bg-white/10",
  );

  // Implemented conditional rendering for links to use standard <a> tags for non-Inertia routes.
  // This avoids the suboptimal double request (XHR failure + full reload) that occurs when an Inertia Link is used for a non-Inertia destination.
  if (isInertia) {
    return (
      <Link href={href} className={className} {...(onClick && { onClick })}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} {...(onClick && { onClick })}>
      {children}
    </a>
  );
};

const NavButton = ({
  href,
  children,
  context,
  onClick,
  external = false,
  isDashboard = false,
}: {
  href: string;
  children: React.ReactNode;
  context?: "primary" | undefined;
  onClick?: ((event: React.MouseEvent) => void) | undefined;
  external?: boolean | undefined;
  isDashboard?: boolean | undefined;
}) => {
  const isPrimary = context === "primary" || isDashboard;
  const className = classNames(
    "flex w-full items-center justify-center p-3 text-sm font-medium no-underline transition-colors lg:w-auto lg:rounded-lg lg:py-2 lg:px-4 whitespace-nowrap",
    isPrimary
      ? "bg-royal-blue text-white hover:bg-royal-blue-hover"
      : "text-white hover:bg-white/10 border border-white/20",
  );

  if (external) {
    return (
      <a href={href} className={className} {...(onClick && { onClick })}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} {...(onClick && { onClick })}>
      {children}
    </Link>
  );
};

const AuthButtons = ({
  user,
  onClick,
}: {
  user?: LoggedInUser | undefined;
  onClick?: ((event: React.MouseEvent) => void) | undefined;
}) => {
  if (user) {
    return (
      <NavButton href={Routes.dashboard_url()} context="primary" isDashboard {...(onClick && { onClick })} external>
        {t("navigation.dashboard")}
      </NavButton>
    );
  }

  return (
    <>
      <NavButton href={Routes.login_path()} {...(onClick && { onClick })}>
        {t("auth.log_in")}
      </NavButton>
      <NavButton href={Routes.signup_path()} context="primary" {...(onClick && { onClick })}>
        {t("navigation.start_selling")}
      </NavButton>
    </>
  );
};

export const HomeNav = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [stars, setStars] = React.useState<string | null>(null);
  const { url, props } = usePage<PageProps>();
  const user = props.current_user;

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  React.useEffect(() => {
    void request({ method: "GET", accept: "json", url: "/github_stars" })
      .then((response) => response.json())
      .then((data: GithubStarsResponse) => {
        if (typeof data.stars === "number") {
          setStars(
            new Intl.NumberFormat("en-US", {
              notation: "compact",
            }).format(data.stars),
          );
        }
      })
      .catch((error: unknown) => {
        console.error("Error fetching GitHub stars:", error); // eslint-disable-line
      });
  }, []);

  const isCurrentPage = (path: string): boolean => {
    if (path === Routes.gumroad_blog_root_path()) {
      return url.startsWith(path);
    }
    if (path === Routes.gumclaw_path()) {
      return url.startsWith(path);
    }
    if (path === Routes.about_path()) {
      return url === path || url === Routes.root_path();
    }
    return url === path;
  };

  const LINKS = [
    { href: Routes.discover_path(), label: t("navigation.discover"), isInertia: true },
    { href: Routes.gumroad_blog_root_path(), label: t("navigation.blog"), isInertia: true },
    { href: Routes.pricing_path(), label: t("navigation.pricing") },
    { href: Routes.features_path(), label: t("navigation.features") },
    { href: Routes.about_path(), label: t("navigation.about") },
    { href: Routes.gumclaw_path(), label: t("navigation.gumclaw") },
  ];

  return (
    <>
      <div className="border-navy-border/40 sticky top-0 right-0 left-0 z-50 flex h-16 items-center justify-between border-b bg-navy px-4 text-white shadow-xs lg:px-8">
        <div className="flex items-center gap-3">
          <Link href={Routes.root_path()} className="flex items-center">
            <img src={logoSvg} loading="lazy" alt="" className="h-8 w-auto brightness-0 invert" />
          </Link>

          <a
            href="https://github.com/antiwork/gumroad"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white no-underline transition-colors hover:bg-white/20"
            aria-label={t("navigation.visit_github", "Visit ArifDrop on GitHub")}
            data-github-stars
          >
            <svg width="18" height="18" viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg" className="fill-current">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                fill="currentColor"
              />
            </svg>
            {stars ? (
              <div data-github-stars-count className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-base leading-none font-medium" data-github-stars-count-value>
                  {stars}
                </span>
                <Star pack="filled" className="size-4.5" />
              </div>
            ) : (
              <div data-github-stars-arrow className="flex items-center gap-1.5">
                <span className="text-base leading-none font-medium">GitHub</span>
                <ArrowUpRight className="size-3.5" />
              </div>
            )}
          </a>
        </div>

        <div className="override hidden lg:flex lg:items-center">
          <div className="flex flex-col items-center justify-center lg:flex-row lg:gap-1 lg:px-6">
            {LINKS.map(({ href, label, isInertia }) => (
              <NavLink key={href} href={href} isActive={isCurrentPage(href)} isInertia={!!isInertia}>
                {label}
              </NavLink>
            ))}
          </div>
          <div className="flex flex-col lg:h-full lg:flex-row">
            <AuthButtons user={user} />
          </div>
        </div>

        <div className="flex items-center lg:hidden">
          <button
            className="relative flex h-8 w-8 flex-col items-center justify-center all-unset focus:outline-hidden"
            onClick={toggleMobileMenu}
            aria-label={t("navigation.toggle_navigation_menu", "Toggle navigation menu")}
          >
            <div
              className={classNames("mb-1 h-0.5 w-6 origin-center bg-white transition-transform duration-200", {
                "translate-y-1.5 rotate-45": mobileMenuOpen,
              })}
            />
            <div
              className={classNames("mt-1 h-0.5 w-6 origin-center bg-white transition-transform duration-200", {
                "-translate-y-1.5 -rotate-45": mobileMenuOpen,
              })}
            />
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div
          className="override border-navy-border/40 fixed top-16 right-0 left-0 z-50 flex flex-col justify-between border-b bg-navy p-4 text-white shadow-xl"
          id="mobile-menu"
        >
          <div className="flex flex-col items-center justify-center gap-1 py-2">
            {LINKS.map(({ href, label, isInertia }) => (
              <NavLink
                key={href}
                href={href}
                onClick={closeMobileMenu}
                isActive={isCurrentPage(href)}
                isInertia={!!isInertia}
              >
                {label}
              </NavLink>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
            <AuthButtons user={user} onClick={closeMobileMenu} />
          </div>
        </div>
      ) : null}
    </>
  );
};
