import * as React from "react";

import { useTranslate } from "$app/hooks/useTranslate";
import { isValidEmail } from "$app/utils/email";

import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { FormSection } from "$app/components/ui/FormSection";
import { Label } from "$app/components/ui/Label";
import { Textarea } from "$app/components/ui/Textarea";

type Props = {
  blockedEmails: string;
  setBlockedEmails: (emails: string) => void;
};
const BlockEmailsSection = ({ blockedEmails, setBlockedEmails }: Props) => {
  const { t } = useTranslate();
  const uid = React.useId();
  const sanitizeBlockedEmails = () => {
    if (blockedEmails.length === 0) {
      return;
    }

    setBlockedEmails(
      [
        ...new Set( // remove duplicate emails
          blockedEmails
            .toLowerCase()
            .replace(/[\r\n]+/gu, ",") // replace newlines with commas
            .replace(/\s/gu, "") // remove all whitespaces
            .split(/[,]+/gu) // split by commas
            .map((email) => {
              if (!isValidEmail(email)) return email;

              const [localPart, domain] = email.split("@");
              return [
                // Normalize local-part (https://en.wikipedia.org/wiki/Email_address#Common_local-part_semantics)
                localPart
                  .replace(/\+.*/u, "") // normalize plus sub-addressing
                  .replace(/\./gu, ""), // normalize dots
                domain,
              ].join("@");
            }),
        ),
      ].join("\n"),
    );
  };

  return (
    <FormSection
      header={
        <>
          <h2>{t("seller.settings.advanced.mass_block_emails")}</h2>
          <a href="/help/article/329-customer-moderation" target="_blank" rel="noreferrer">
            {t("actions.learn_more")}
          </a>
        </>
      }
    >
      <Fieldset>
        <FieldsetTitle>
          <Label htmlFor={uid}>{t("seller.settings.advanced.block_emails_label")}</Label>
        </FieldsetTitle>
        <Textarea
          id={uid}
          rows={4}
          value={blockedEmails}
          onChange={(e) => setBlockedEmails(e.target.value)}
          onBlur={sanitizeBlockedEmails}
        />
        <FieldsetDescription>{t("seller.settings.advanced.block_emails_desc")}</FieldsetDescription>
      </Fieldset>
    </FormSection>
  );
};

export default BlockEmailsSection;
