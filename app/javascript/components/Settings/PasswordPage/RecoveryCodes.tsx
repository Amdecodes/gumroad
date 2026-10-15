import * as React from "react";

import { useTranslate } from "$app/utils/i18n";

import { Button } from "$app/components/Button";
import { showAlert } from "$app/components/server-components/Alert";
import { Alert } from "$app/components/ui/Alert";

export const RecoveryCodes = ({ codes, onDone }: { codes: string[]; onDone: () => void }) => {
  const { t } = useTranslate();

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text).then(
      () => showAlert(t("seller.settings.password.copied_to_clipboard"), "success"),
      () => showAlert(t("seller.settings.password.failed_to_copy"), "error"),
    );
  };

  const handleDownload = (items: string[]) => {
    const blob = new Blob([items.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gumroad-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4">
      <Alert variant="warning">{t("seller.settings.password.save_recovery_codes_warning")}</Alert>
      <div className="grid w-fit gap-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 rounded border border-border p-4 font-mono text-sm">
          {codes.map((code) => (
            <div key={code}>{code}</div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => copyToClipboard(codes.join("\n"))}>{t("seller.settings.password.copy_all")}</Button>
          <Button onClick={() => handleDownload(codes)}>{t("seller.settings.password.download")}</Button>
        </div>
      </div>
      <div>
        <Button color="accent" onClick={onDone}>
          {t("seller.settings.password.done")}
        </Button>
      </div>
    </div>
  );
};
