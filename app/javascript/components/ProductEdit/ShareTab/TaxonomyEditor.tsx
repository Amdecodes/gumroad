import * as React from "react";

import { Taxonomy } from "$app/utils/discover";
import { useTranslation } from "$app/utils/i18n";
import { getTaxonomyLabel } from "$app/utils/taxonomy";

import { Select } from "$app/components/Select";
import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Label } from "$app/components/ui/Label";

export const TaxonomyEditor = ({
  taxonomyId,
  onChange,
  taxonomies,
}: {
  taxonomyId: string | null;
  onChange: (taxonomyId: string | null) => void;
  taxonomies: Taxonomy[];
}) => {
  const { t } = useTranslation();
  const uid = React.useId();
  const options = React.useMemo(() => {
    const taxonomyMap = new Map(taxonomies.map((item) => [item.key, item]));
    return taxonomies.map((taxonomy) => {
      let label = getTaxonomyLabel(taxonomy.slug, taxonomy.label);
      let current: Taxonomy | undefined = taxonomy;
      while ((current = taxonomyMap.get(current.parent_key ?? ""))) {
        const parentLabel = getTaxonomyLabel(current.slug, current.label);
        label = `${parentLabel} > ${label}`;
      }
      return { id: taxonomy.key, label };
    });
  }, [taxonomies]);

  return (
    <Fieldset>
      <FieldsetTitle>
        <Label htmlFor={uid}>{t("seller.productEdit.category")}</Label>
      </FieldsetTitle>
      <Select
        inputId={uid}
        placeholder={t("seller.productEdit.category_placeholder")}
        options={options}
        onChange={(taxonomy) => onChange(taxonomy?.id ?? null)}
        isMulti={false}
        isClearable
        value={options.find(({ id }) => id === taxonomyId) ?? null}
      />
      <FieldsetDescription>{t("seller.productEdit.category_description")}</FieldsetDescription>
    </Fieldset>
  );
};
