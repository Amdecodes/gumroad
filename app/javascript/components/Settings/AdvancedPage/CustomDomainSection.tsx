import * as React from "react";

import { useTranslate } from "$app/hooks/useTranslate";

import CustomDomain from "$app/components/CustomDomain";
import { FormSection } from "$app/components/ui/FormSection";

const CustomDomainSection = ({
  verificationStatus,
  customDomain,
  setCustomDomain,
}: {
  verificationStatus: { success: boolean; message: string } | null;
  customDomain: string;
  setCustomDomain: (val: string) => void;
}) => {
  const { t } = useTranslate();
  return (
    <FormSection
      header={
        <>
          <h2>{t("seller.settings.advanced.custom_domain")}</h2>
          <a href="/help/article/153-setting-up-a-custom-domain" target="_blank" rel="noreferrer">
            {t("actions.learn_more")}
          </a>
        </>
      }
    >
      <CustomDomain
        verificationStatus={verificationStatus}
        customDomain={customDomain}
        setCustomDomain={setCustomDomain}
        label={t("seller.settings.advanced.custom_domain_label")}
      />
    </FormSection>
  );
};

export default CustomDomainSection;
