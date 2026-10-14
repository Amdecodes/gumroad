import { Archive, Copy, DotsHorizontalRounded, Trash } from "@boxicons/react";
import * as React from "react";

import { archiveProduct, deleteProduct, duplicateProduct, unarchiveProduct } from "$app/data/product_dashboard";
import { Membership, Product } from "$app/data/products";
import { t } from "$app/utils/i18n";
import { assertResponseError } from "$app/utils/request";

import { Button } from "$app/components/Button";
import { Modal } from "$app/components/Modal";
import { Popover, PopoverContent, PopoverTrigger } from "$app/components/Popover";
import { showAlert } from "$app/components/server-components/Alert";
import { Menu, MenuItem } from "$app/components/ui/Menu";

const ActionsPopover = ({
  product,
  onDuplicate,
  onDelete,
  onArchive,
  onUnarchive,
}: {
  product: Product | Membership;
  onDuplicate: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onUnarchive: (hasRemainingArchivedProducts: boolean) => void;
}) => {
  const [open, setOpen] = React.useState(false);
  const [isDuplicating, setIsDuplicating] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [isUnarchiving, setIsUnarchiving] = React.useState(false);

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    showAlert(t("seller.products.duplicate_in_progress"), "info");
    try {
      await duplicateProduct(product.permalink, product.name);
      showAlert(t("seller.products.duplicate_success", { name: product.name }), "success");
      onDuplicate();
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    }
    setOpen(false);
    setIsDuplicating(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProduct(product.permalink);
      showAlert(t("seller.products.delete_success"), "success");
      onDelete();
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    }
    setIsDeleting(false);
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await archiveProduct(product.permalink);
      const message =
        product.status === "published"
          ? t("seller.products.archive_and_unpublish_success")
          : t("seller.products.archive_success");
      showAlert(message, "success");
      onArchive();
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    }
    setIsArchiving(false);
  };

  const handleUnarchive = async () => {
    setIsUnarchiving(true);
    try {
      const archivedProductsCount = await unarchiveProduct(product.permalink);
      showAlert(t("seller.products.unarchive_success"), "success");
      onUnarchive(archivedProductsCount > 0);
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    }
    setIsUnarchiving(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger aria-label={t("seller.products.action_menu")} className="cursor-pointer all-unset">
          <DotsHorizontalRounded className="size-5" />
        </PopoverTrigger>
        <PopoverContent className="border-0 p-0 shadow-none">
          <Menu>
            <MenuItem
              inert={!product.can_duplicate || isDuplicating}
              className={!product.can_duplicate || isDuplicating ? "opacity-30" : undefined}
              onClick={() => void handleDuplicate()}
            >
              <Copy className="size-5" />
              {isDuplicating ? t("seller.products.duplicating") : t("seller.products.duplicate")}
            </MenuItem>
            {product.can_unarchive ? (
              <MenuItem
                inert={isUnarchiving}
                className={isUnarchiving ? "opacity-30" : undefined}
                onClick={() => void handleUnarchive()}
              >
                <Archive className="size-5" />
                {isUnarchiving ? t("seller.products.unarchiving") : t("seller.products.unarchive")}
              </MenuItem>
            ) : null}
            {product.can_archive ? (
              <MenuItem
                inert={isArchiving}
                className={isArchiving ? "opacity-30" : undefined}
                onClick={() => void handleArchive()}
              >
                <Archive className="size-5" />
                {isArchiving ? t("seller.products.archiving") : t("seller.products.archive")}
              </MenuItem>
            ) : null}
            <MenuItem
              variant="danger"
              inert={!product.can_destroy || isDeleting}
              className={!product.can_destroy || isDeleting ? "opacity-30" : undefined}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash className="size-5" />
              {isDeleting ? t("seller.products.deleting") : t("seller.products.delete_permanently")}
            </MenuItem>
          </Menu>
        </PopoverContent>
      </Popover>
      {confirmingDelete ? (
        <Modal
          open
          onClose={() => setConfirmingDelete(false)}
          title={t("seller.products.delete_modal_title")}
          footer={
            <>
              <Button onClick={() => setConfirmingDelete(false)} disabled={isDeleting}>
                {t("seller.products.cancel")}
              </Button>
              <Button color="danger" onClick={() => void handleDelete()} disabled={isDeleting}>
                {isDeleting ? t("seller.products.deleting") : t("actions.confirm")}
              </Button>
            </>
          }
        >
          <h4>{t("seller.products.delete_confirm_prompt", { name: product.name })}</h4>
        </Modal>
      ) : null}
    </>
  );
};

export default ActionsPopover;
