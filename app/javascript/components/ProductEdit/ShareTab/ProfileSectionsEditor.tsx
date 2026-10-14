import * as React from "react";

import { useTranslation } from "$app/utils/i18n";

import { useCurrentSeller } from "$app/components/CurrentSeller";
import { ProfileSection } from "$app/components/ProductEdit/state";
import { Alert } from "$app/components/ui/Alert";
import { Fieldset, FieldsetDescription } from "$app/components/ui/Fieldset";
import { Label } from "$app/components/ui/Label";
import { Switch } from "$app/components/ui/Switch";

export const ProfileSectionsEditor = ({
  sectionIds,
  onChange,
  profileSections,
}: {
  sectionIds: string[];
  onChange: (sectionIds: string[]) => void;
  profileSections: ProfileSection[];
}) => {
  const { t } = useTranslation();
  const currentSeller = useCurrentSeller();
  if (!currentSeller) return null;

  const sectionName = (section: ProfileSection) => {
    const name = section.header || t("seller.productEdit.unnamed_section");
    return section.default ? `${name} ${t("seller.productEdit.default_badge")}` : name;
  };

  return (
    <section className="grid gap-8 border-t border-border p-4 md:p-8">
      <header>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2>{t("seller.productEdit.profile_title")}</h2>
          <a href="/help/article/124-your-gumroad-profile-page" target="_blank" rel="noreferrer">
            {t("seller.productEdit.learn_more")}
          </a>
        </div>
        {t("seller.productEdit.profile_desc")}
      </header>
      {profileSections.length ? (
        <Fieldset>
          {profileSections.map((section) => {
            const items = section.product_names.slice(0, 2).join(", ");
            return (
              <Label key={section.id}>
                <Switch
                  checked={sectionIds.includes(section.id)}
                  onChange={(evt) =>
                    onChange(
                      evt.target.checked ? [...sectionIds, section.id] : sectionIds.filter((id) => id !== section.id),
                    )
                  }
                />
                <div>
                  {sectionName(section)}
                  <br />
                  <FieldsetDescription>
                    {section.product_names.length > 2
                      ? `${items}${t("seller.productEdit.and_other_count", { count: section.product_names.length - 2 })}`
                      : items}
                  </FieldsetDescription>
                </div>
              </Label>
            );
          })}
        </Fieldset>
      ) : (
        <Alert role="status" variant="info">
          {t("seller.productEdit.no_sections_notice")}{" "}
          <a href={Routes.root_url({ host: currentSeller.subdomain })}>{t("seller.productEdit.create_one_here")}</a>
        </Alert>
      )}
    </section>
  );
};
