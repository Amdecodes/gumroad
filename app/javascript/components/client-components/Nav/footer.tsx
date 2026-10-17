import { ArrowOutRightSquareHalf, Book, Cog, Group, Plus, Store } from "@boxicons/react";
import { Link } from "@inertiajs/react";
import React from "react";

import { t } from "$app/utils/i18n";

import { ClientNavLink } from "$app/components/client-components/Nav";
import { LanguageToggle } from "$app/components/LanguageToggle";
import { CreateBrandAccountModal } from "$app/components/CreateBrandAccountModal";
import { useCurrentSeller } from "$app/components/CurrentSeller";
import { useAppDomain } from "$app/components/DomainSettings";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import { NavLink, NavLinkDropdownItem, NavLinkDropdownMembershipItem } from "$app/components/Nav";
import { DashboardNavProfilePopover } from "$app/components/ProfilePopover";
import { Menu, MenuItem } from "$app/components/ui/Menu";

function NavbarFooter() {
  const routeParams = { host: useAppDomain() };
  const loggedInUser = useLoggedInUser();
  const currentSeller = useCurrentSeller();
  const teamMemberships = loggedInUser?.teamMemberships;
  const [showCreateBrandAccountModal, setShowCreateBrandAccountModal] = React.useState(false);

  return (
    <>
      <div className="border-t border-white/50 px-6 py-3 dark:border-foreground/50">
        <LanguageToggle variant="dark" />
      </div>
      {currentSeller?.isBuyer ? (
        <NavLink
          text={t("navigation.start_selling")}
          icon={<Store pack="filled" className="size-5" />}
          href={Routes.dashboard_url(routeParams)}
        />
      ) : null}
      <ClientNavLink
        text={t("navigation.help")}
        icon={<Book pack="filled" className="size-5" />}
        href={Routes.help_center_root_url(routeParams)}
      />
      <DashboardNavProfilePopover user={currentSeller}>
        <Menu className="flex flex-col border-0! shadow-none! dark:border!">
          {teamMemberships != null && teamMemberships.length > 0 ? (
            <>
              {teamMemberships.map((teamMembership) => (
                <NavLinkDropdownMembershipItem key={teamMembership.id} teamMembership={teamMembership} />
              ))}
              <hr className="my-2" />
            </>
          ) : null}
          {loggedInUser?.canCreateBrandAccount ? (
            <>
              <NavLinkDropdownItem
                text={t("navigation.new_account")}
                icon={<Plus pack="filled" className="mx-1 size-5 shrink-0" />}
                href="#"
                onClick={(ev) => {
                  ev.preventDefault();
                  setShowCreateBrandAccountModal(true);
                }}
              />
              <hr className="my-2" />
            </>
          ) : null}
          <NavLinkDropdownItem
            text={t("navigation.settings")}
            icon={<Cog pack="filled" className="mx-1 size-5" />}
            href={Routes.settings_main_url(routeParams)}
            component={Link}
          />
          <NavLinkDropdownItem
            text={t("navigation.teams")}
            icon={<Group pack="filled" className="mx-1 size-5" />}
            href={Routes.settings_team_url(routeParams)}
            component={Link}
          />
          <MenuItem asChild>
            <Link href={Routes.logout_url(routeParams)} method="delete" className="all-unset">
              <ArrowOutRightSquareHalf pack="filled" className="mx-1 size-5" />
              {t("navigation.logout")}
            </Link>
          </MenuItem>
        </Menu>
      </DashboardNavProfilePopover>
      <CreateBrandAccountModal
        open={showCreateBrandAccountModal}
        onClose={() => setShowCreateBrandAccountModal(false)}
      />
    </>
  );
}

export default NavbarFooter;
