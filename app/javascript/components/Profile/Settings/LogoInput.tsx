import { DirectUpload } from "@rails/activestorage";
import * as React from "react";

import { useTranslate } from "$app/utils/i18n";

import { ImageUploader } from "$app/components/ImageUploader";
import { showAlert } from "$app/components/server-components/Alert";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Label } from "$app/components/ui/Label";

const ALLOWED_EXTENSIONS = ["jpeg", "jpg", "png"];

// This component only allows you to replace (not remove) the profile picture.
export const LogoInput = ({
  onChange,
  logoUrl,
  disabled,
}: {
  logoUrl: string;
  disabled: boolean;
  onChange: (blob: { key: string; signedId: string } | null) => void;
}) => {
  const { t } = useTranslate();
  const [changing, setChanging] = React.useState(false);
  const id = React.useId();

  return (
    <Fieldset>
      <FieldsetTitle>
        <Label htmlFor={id}>{t("seller.settings.profile.avatar")}</Label>
      </FieldsetTitle>
      <ImageUploader
        id={id}
        helpText={t("seller.settings.profile.avatar_help_text")}
        allowedExtensions={ALLOWED_EXTENSIONS}
        imageUrl={changing || !logoUrl ? null : logoUrl}
        onRemove={() => {
          setChanging(true);
          onChange(null);
        }}
        onSelectFile={(file) =>
          new Promise((resolve, reject) => {
            const upload = new DirectUpload(file, "/rails/active_storage/direct_uploads");

            upload.create((error, blob) => {
              setChanging(false);
              if (error) {
                showAlert(error.message, "error");
                reject(error);
              } else {
                onChange({ key: blob.key, signedId: blob.signed_id });
                resolve();
              }
            });
          })
        }
        imageAlt={t("seller.settings.profile.current_avatar")}
        disabled={disabled}
        circular
      />
    </Fieldset>
  );
};
