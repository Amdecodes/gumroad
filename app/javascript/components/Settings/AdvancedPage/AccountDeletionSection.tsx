import * as React from "react";
import typia from "typia";

import { useTranslate } from "$app/hooks/useTranslate";
import { assertResponseError, request, ResponseError } from "$app/utils/request";

import { Button } from "$app/components/Button";
import { Modal } from "$app/components/Modal";
import { showAlert } from "$app/components/server-components/Alert";
import { FormSection } from "$app/components/ui/FormSection";

type Props = {
  formatted_balance_to_forfeit_on_account_deletion: string | null;
};

const AccountDeletionSection = (props: Props) => {
  const { t } = useTranslate();
  const [showConfirmationModal, setShowConfirmationModal] = React.useState(false);

  const performAccountDeletion = async () => {
    try {
      const response = await request({
        method: "POST",
        accept: "json",
        url: Routes.deactivate_account_path(),
      });
      const responseData = typia.assert<{ success: true } | { success: false; message: string }>(await response.json());
      if (!responseData.success) throw new ResponseError(responseData.message);
      window.location.href = Routes.root_path();
    } catch (e) {
      assertResponseError(e);
      setShowConfirmationModal(false);
      showAlert(e.message, "error");
    }
  };

  const [moreInfoBefore, moreInfoAfter] = t("seller.settings.advanced.more_info_here", { link: "___LINK___" }).split(
    "___LINK___",
  );

  return (
    <FormSection header={<h2>{t("seller.settings.advanced.danger_zone")}</h2>}>
      <p>
        <a href="/help/article/37-how-to-delete-your-gumroad-account" target="_blank" rel="noreferrer">
          {t("seller.settings.advanced.delete_account_link_text")}
        </a>{" "}
        {t("seller.settings.advanced.danger_zone_body_rest")}
      </p>
      <div>
        <Button color="danger" onClick={() => setShowConfirmationModal(true)}>
          {t("seller.settings.advanced.delete_gumroad_account")}
        </Button>
      </div>

      <Modal
        open={showConfirmationModal}
        title={t("seller.settings.advanced.delete_account_modal_title")}
        onClose={() => setShowConfirmationModal(false)}
        footer={
          <>
            <Button onClick={() => setShowConfirmationModal(false)}>{t("actions.cancel")}</Button>
            <Button color="danger" onClick={() => void performAccountDeletion()}>
              {props.formatted_balance_to_forfeit_on_account_deletion
                ? t("seller.settings.advanced.yes_forfeit_and_delete")
                : t("seller.settings.advanced.yes_delete_account")}
            </Button>
          </>
        }
      >
        <p>
          {props.formatted_balance_to_forfeit_on_account_deletion
            ? t("seller.settings.advanced.balance_forfeit_note", {
                balance: props.formatted_balance_to_forfeit_on_account_deletion,
              })
            : null}
          <span>{t("seller.settings.advanced.danger_zone_body")}</span>
        </p>
        <p>
          {moreInfoBefore}
          <a href="/help/article/37-how-to-delete-your-gumroad-account" target="_blank" rel="noreferrer">
            {t("seller.settings.advanced.here_link")}
          </a>
          {moreInfoAfter}
        </p>
      </Modal>
    </FormSection>
  );
};

export default AccountDeletionSection;
