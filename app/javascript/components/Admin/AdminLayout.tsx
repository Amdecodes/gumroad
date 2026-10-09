import { usePage } from "@inertiajs/react";
import * as React from "react";

import MetaTags, { type MetaTag } from "$app/layouts/components/MetaTags";

import { CurrentSellerProvider, parseCurrentSeller } from "$app/components/CurrentSeller";
import { LoggedInUserProvider, parseLoggedInUser } from "$app/components/LoggedInUser";
import Alert, { type AlertPayload } from "$app/components/server-components/Alert";
import { useFlashMessage } from "$app/components/useFlashMessage";

import { AdminHeader, type AdminUser } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";

type AdminPageProps = {
  _inertia_meta?: MetaTag[] | undefined;
  flash?: AlertPayload | null | undefined;
  current_admin?: AdminUser | undefined;
  logged_in_user?: unknown;
  current_seller?: unknown;
};

type AdminLayoutProps = {
  children: React.ReactNode;
  currentPath?: string | undefined;
};

export function AdminLayout({ children, currentPath }: AdminLayoutProps) {
  const { flash, current_admin, logged_in_user, current_seller } = usePage<AdminPageProps>().props;
  useFlashMessage(flash);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const user = React.useMemo(
    () => (logged_in_user != null ? parseLoggedInUser(logged_in_user) : null),
    [logged_in_user],
  );

  const seller = React.useMemo(
    () => (current_seller != null ? parseCurrentSeller(current_seller) : null),
    [current_seller],
  );

  return (
    <LoggedInUserProvider value={user}>
      <CurrentSellerProvider value={seller}>
        <div className="flex h-dvh overflow-hidden bg-background text-foreground">
          <MetaTags />
          <Alert initial={null} />

          <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath={currentPath} />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <AdminHeader admin={current_admin} onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
            <main scroll-region="" className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="mx-auto max-w-7xl space-y-8">{children}</div>
            </main>
          </div>
        </div>
      </CurrentSellerProvider>
    </LoggedInUserProvider>
  );
}
