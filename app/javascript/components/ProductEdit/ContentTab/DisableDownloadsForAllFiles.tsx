import { ArrowInDownSquareHalf } from "@boxicons/react";
import * as React from "react";
import typia from "typia";

import { useTranslation } from "$app/utils/i18n";
import { request, ResponseError } from "$app/utils/request";

import { Button } from "$app/components/Button";
import { Modal } from "$app/components/Modal";
import { useProductEditContext } from "$app/components/ProductEdit/state";

export type DisableDownloadsResult = { message: string; status: "success" | "info" | "danger" };

// Writes through the server: the editor save carries only the files embedded in the version
// being edited, so flipping local state would miss the rest of the product's files.
export const DisableDownloadsForAllFiles = ({ onResult }: { onResult: (result: DisableDownloadsResult) => void }) => {
  const { t } = useTranslation();
  const { updateProduct, uniquePermalink } = useProductEditContext();
  const [confirming, setConfirming] = React.useState(false);
  const [working, setWorking] = React.useState(false);

  const disableAll = async () => {
    setWorking(true);
    try {
      const response = await request({
        method: "POST",
        url: Routes.disable_downloads_for_all_files_link_path(uniquePermalink),
        accept: "json",
      });
      if (!response.ok) throw new ResponseError();
      const { disabled_count, disabled_file_ids, ineligible_count } = typia.assert<{
        disabled_count: number;
        disabled_file_ids: string[];
        ineligible_count: number;
      }>(await response.json());

      // Mirror the exact set the server wrote: leaving stream_only: false in the file state
      // would let the next save send the old value back and silently re-enable downloads.
      const disabledIds = new Set(disabled_file_ids);
      updateProduct((product) => {
        product.files = product.files.map((file) => (disabledIds.has(file.id) ? { ...file, stream_only: true } : file));
      });

      const details = [
        disabled_count > 0
          ? t("seller.productEdit.downloads_disabled_summary", { count: disabled_count })
          : t("seller.productEdit.downloads_already_off", "Every file that can have downloads off already does."),
        ineligible_count > 0 ? t("seller.productEdit.downloads_ineligible_notice", { count: ineligible_count }) : null,
      ].filter((detail) => detail !== null);
      onResult({ message: details.join(" "), status: disabled_count > 0 ? "success" : "info" });
    } catch (error) {
      onResult({
        message:
          error instanceof Error
            ? error.message
            : t("seller.productEdit.could_not_disable_downloads", "Could not disable downloads."),
        status: "danger",
      });
    } finally {
      setWorking(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 all-unset hover:bg-active-bg"
        onClick={() => setConfirming(true)}
      >
        <ArrowInDownSquareHalf className="size-5" />
        <span>{t("seller.productEdit.disable_downloads_btn", "Disable all downloads")}</span>
      </button>
      {confirming ? (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title={t("seller.productEdit.disable_downloads_modal_title", "Disable downloads for all files?")}
          footer={
            <>
              <Button onClick={() => setConfirming(false)}>{t("seller.productEdit.no_cancel", "No, cancel")}</Button>
              <Button color="danger" disabled={working} onClick={() => void disableAll()}>
                {t("seller.productEdit.yes_disable_downloads", "Yes, disable downloads")}
              </Button>
            </>
          }
        >
          <p>
            {t(
              "seller.productEdit.disable_downloads_modal_p1",
              "Every file your buyers can open in the browser — videos in the player and documents in the reader — stops offering a download.",
            )}
          </p>
          <p>
            {t(
              "seller.productEdit.disable_downloads_modal_p2",
              "This applies to buyers who already purchased, so their download links stop working too. Files with no in-browser viewer, such as ZIPs, keep their download button. You can turn downloads back on for a single file from that file's settings.",
            )}
          </p>
        </Modal>
      ) : null}
    </>
  );
};
