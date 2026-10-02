import { Menu } from "@boxicons/react";
import * as React from "react";

import { Avatar } from "$app/components/ui/Avatar";

export type AdminUser = {
  name: string;
  email: string;
  avatar_url?: string;
};

type AdminHeaderProps = {
  admin?: AdminUser | undefined;
  onToggleSidebar: () => void;
};

export const AdminHeader = ({ admin, onToggleSidebar }: AdminHeaderProps) => (
  <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-8">
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="rounded p-1 text-foreground hover:bg-active-bg lg:hidden"
        onClick={onToggleSidebar}
        aria-label="Open navigation"
      >
        <Menu className="size-6" />
      </button>
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-muted">Admin</span>
        <span className="text-muted">/</span>
        <span className="text-foreground">Overview</span>
      </div>
    </div>

    <div className="flex items-center gap-4">
      {admin ? (
        <div className="flex items-center gap-3">
          <Avatar src={admin.avatar_url} alt={admin.name} />
          <div className="hidden text-left sm:block">
            <div className="text-sm leading-none font-medium">{admin.name}</div>
            <div className="mt-0.5 text-xs leading-tight text-muted">{admin.email}</div>
          </div>
        </div>
      ) : null}

      <a
        href="/"
        className="rounded border border-border px-3 py-1.5 text-xs font-medium text-foreground no-underline transition-colors hover:bg-active-bg"
      >
        Store
      </a>
    </div>
  </header>
);
