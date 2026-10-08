import {
  ArrowLeft,
  BarChartBig,
  Cart,
  DollarCircle,
  Flag,
  Group,
  History,
  HomeAlt2,
  Megaphone,
  Repeat,
  Server,
  Shield,
  Store,
  User,
  X,
} from "@boxicons/react";
import { Link, usePage } from "@inertiajs/react";
import * as React from "react";

import { classNames } from "$app/utils/classNames";
import { useTranslation } from "$app/utils/i18n";

import { LanguageToggle } from "$app/components/LanguageToggle";

type AdminSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
};

type NavItem = {
  label: string;
  href?: string;
  icon: React.ReactNode;
  isExternal?: boolean;
  disabled?: boolean;
};

export const AdminSidebar = ({ isOpen, onClose, currentPath }: AdminSidebarProps) => {
  const { t } = useTranslation();
  let activeUrl = currentPath;
  try {
    const page = usePage();
    if (!activeUrl && page.url) {
      activeUrl = page.url;
    }
  } catch {
    // outside inertia context
  }
  const activePath = (activeUrl || (typeof window !== "undefined" ? window.location.pathname : "/admin")).split("?")[0];

  const mainNavItems: NavItem[] = [
    {
      label: t("admin.overview", undefined, "Overview"),
      href: "/admin",
      icon: <HomeAlt2 className="size-5 shrink-0" />,
    },
    {
      label: t("admin.creators", undefined, "Creators"),
      href: "/admin/creators",
      icon: <User className="size-5 shrink-0" />,
    },
    {
      label: t("admin.products", undefined, "Products"),
      href: "/admin/products",
      icon: <Store className="size-5 shrink-0" />,
    },
    {
      label: t("admin.orders", undefined, "Orders"),
      href: "/admin/orders",
      icon: <Cart className="size-5 shrink-0" />,
    },
    {
      label: t("admin.subscriptions", undefined, "Subscriptions"),
      href: "/admin/subscriptions",
      icon: <Repeat className="size-5 shrink-0" />,
    },
    {
      label: t("admin.payouts", undefined, "Payouts"),
      href: "/admin/payouts",
      icon: <DollarCircle className="size-5 shrink-0" />,
    },
    {
      label: t("admin.customers", undefined, "Customers"),
      href: "/admin/customers",
      icon: <Group className="size-5 shrink-0" />,
    },
    {
      label: t("admin.marketing", undefined, "Marketing"),
      href: "/admin/marketing",
      icon: <Megaphone className="size-5 shrink-0" />,
    },
    {
      label: t("admin.reports", undefined, "Reports"),
      href: "/admin/reports",
      icon: <BarChartBig className="size-5 shrink-0" />,
    },
  ];

  const systemNavItems: NavItem[] = [
    { label: "Activity Log", href: "/admin/activity-log", icon: <History className="size-5 shrink-0" /> },
    { label: "Team", href: "/admin/team", icon: <Shield className="size-5 shrink-0" /> },
    { label: "Jobs", href: "/admin/sidekiq", icon: <Server className="size-5 shrink-0" />, isExternal: true },
    { label: "Feature Flags", href: "/admin/features", icon: <Flag className="size-5 shrink-0" />, isExternal: true },
  ];

  const isItemActive = (href?: string) => {
    if (!href) return false;
    if (href === "/admin") return activePath === "/admin";
    return activePath === href || activePath.startsWith(`${href}/`);
  };

  const renderItem = (item: NavItem) => {
    if (item.disabled || !item.href) {
      return (
        <li key={item.label} className="list-none">
          <div
            className="flex cursor-not-allowed items-center justify-between rounded px-3 py-2 text-sm text-white/40 select-none"
            aria-disabled="true"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
              {item.icon}
              <span className="truncate">{item.label}</span>
            </div>
            <span className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 text-[10px] tracking-wider text-white/30 uppercase">
              Soon
            </span>
          </div>
        </li>
      );
    }

    const isActive = isItemActive(item.href);

    if (item.isExternal) {
      return (
        <li key={item.label} className="list-none">
          <a
            href={item.href}
            className="flex items-center gap-3 rounded px-3 py-2 text-sm font-medium text-white/80 no-underline transition-colors hover:bg-white/10 hover:text-white"
          >
            {item.icon}
            <span>{item.label}</span>
          </a>
        </li>
      );
    }

    return (
      <li key={item.label} className="list-none">
        <Link
          href={item.href}
          onClick={onClose}
          className={classNames(
            "flex items-center gap-3 rounded px-3 py-2 text-sm font-medium no-underline transition-colors",
            isActive ? "bg-accent/20 font-semibold text-accent" : "text-white/80 hover:bg-white/10 hover:text-white",
          )}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={classNames(
          "dark:bg-card fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-black text-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 dark:text-foreground",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Admin Navigation"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/15 px-6 dark:border-border">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-wide">ARIFDROP</span>
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent uppercase">
              Admin
            </span>
          </div>
          <button
            type="button"
            className="text-white/70 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="size-6" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <div>
            <ul className="m-0 list-none space-y-1 p-0">{mainNavItems.map(renderItem)}</ul>
          </div>

          <div>
            <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-white/40 uppercase">System</div>
            <ul className="m-0 list-none space-y-1 p-0">{systemNavItems.map(renderItem)}</ul>
          </div>
        </div>

        <div className="shrink-0 space-y-3 border-t border-white/15 p-4 dark:border-border">
          <div className="flex items-center justify-between px-3">
            <span className="text-xs text-white/50">{t("actions.switch_language", undefined, "Language")}</span>
            <LanguageToggle variant="dark" />
          </div>
          <a
            href="/"
            className="flex items-center gap-2.5 rounded px-3 py-2 text-sm text-white/70 no-underline transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span>{t("admin.exit_to_storefront", undefined, "Back to store")}</span>
          </a>
        </div>
      </aside>
    </>
  );
};
