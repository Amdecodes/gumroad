import { parseISO } from "date-fns";
import * as React from "react";
import typia from "typia";

import { formatDate } from "$app/utils/date";
import { useTranslate } from "$app/utils/i18n";
import { PASSKEY_ADD_ERROR, type Passkey, registerPasskey } from "$app/utils/passkeyRegistration";
import { asyncVoid } from "$app/utils/promise";
import { request, ResponseError } from "$app/utils/request";
import { isPasskeySupported } from "$app/utils/webauthn";

import { Button } from "$app/components/Button";
import { Modal } from "$app/components/Modal";
import { showAlert } from "$app/components/server-components/Alert";
import { Alert } from "$app/components/ui/Alert";
import { FieldsetDescription } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { Row, RowActions, RowContent, Rows } from "$app/components/ui/Rows";

const MAX_PASSKEYS = 10;
const MAX_NICKNAME_LENGTH = 100;
const GENERIC_ERROR = "Sorry, something went wrong. Please try again.";

export type { Passkey };

const formatPasskeyDate = (value: string) => formatDate(parseISO(value), { dateStyle: "medium" });

export const PasskeysSection = ({ passkeys: initialPasskeys }: { passkeys: Passkey[] }) => {
  const { t } = useTranslate();
  const [passkeys, setPasskeys] = React.useState(initialPasskeys);
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingNickname, setEditingNickname] = React.useState("");
  const [savingRename, setSavingRename] = React.useState(false);
  const [pendingDeletion, setPendingDeletion] = React.useState<Passkey | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const supported = isPasskeySupported();
  const reachedLimit = passkeys.length >= MAX_PASSKEYS;

  const handleAdd = asyncVoid(async () => {
    setAdding(true);
    try {
      const added = await registerPasskey();
      setPasskeys((current) => [...current, added]);
      showAlert(t("seller.settings.password.passkey_added"), "success");
    } catch (e) {
      if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError")) return;
      showAlert(e instanceof ResponseError ? e.message : PASSKEY_ADD_ERROR, "error");
    } finally {
      setAdding(false);
    }
  });

  const handleRename = asyncVoid(async (passkey: Passkey) => {
    const nickname = editingNickname.trim();
    if (!nickname || nickname === passkey.nickname) {
      setEditingId(null);
      return;
    }

    setSavingRename(true);
    try {
      const response = await request({
        url: Routes.settings_passkey_path(passkey.id),
        method: "PATCH",
        accept: "json",
        data: { nickname },
      });
      const result = typia.assert<{ success: boolean; passkey?: Passkey; error_message?: string }>(
        await response.json(),
      );
      if (!response.ok || !result.success || !result.passkey) {
        throw new ResponseError(result.error_message ?? GENERIC_ERROR);
      }

      const updated = result.passkey;
      setPasskeys((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditingId(null);
    } catch (e) {
      showAlert(e instanceof ResponseError ? e.message : GENERIC_ERROR, "error");
    } finally {
      setSavingRename(false);
    }
  });

  const handleConfirmDelete = asyncVoid(async () => {
    if (!pendingDeletion) return;

    setDeleting(true);
    try {
      const response = await request({
        url: Routes.settings_passkey_path(pendingDeletion.id),
        method: "DELETE",
        accept: "json",
      });
      const result = typia.assert<{ success: boolean; error_message?: string }>(await response.json());
      if (!response.ok || !result.success) {
        throw new ResponseError(result.error_message ?? GENERIC_ERROR);
      }

      setPasskeys((current) => current.filter((item) => item.id !== pendingDeletion.id));
      setPendingDeletion(null);
      showAlert(t("seller.settings.password.passkey_removed"), "success");
    } catch (e) {
      showAlert(e instanceof ResponseError ? e.message : GENERIC_ERROR, "error");
    } finally {
      setDeleting(false);
    }
  });

  return (
    <>
      {passkeys.length === 0 ? (
        <Alert variant="info">{t("seller.settings.password.passkeys_desc")}</Alert>
      ) : (
        <Rows role="list">
          {passkeys.map((passkey) =>
            editingId === passkey.id ? (
              <Row key={passkey.id} role="listitem">
                <RowContent>
                  <Input
                    className="flex-1"
                    value={editingNickname}
                    onChange={(e) => setEditingNickname(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (editingNickname.trim()) handleRename(passkey);
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    aria-label={t("seller.settings.password.passkey_name_aria")}
                    maxLength={MAX_NICKNAME_LENGTH}
                    autoFocus
                    disabled={savingRename}
                  />
                </RowContent>
                <RowActions>
                  <Button
                    color="accent"
                    onClick={() => handleRename(passkey)}
                    disabled={savingRename || !editingNickname.trim()}
                  >
                    {savingRename ? t("seller.settings.password.saving") : t("seller.settings.password.save")}
                  </Button>
                  <Button onClick={() => setEditingId(null)} disabled={savingRename}>
                    {t("seller.settings.password.cancel")}
                  </Button>
                </RowActions>
              </Row>
            ) : (
              <Row key={passkey.id} role="listitem">
                <RowContent>
                  <div className="grid gap-1">
                    <div className="font-bold">{passkey.nickname}</div>
                    <FieldsetDescription>
                      {t("seller.settings.password.added_date", { date: formatPasskeyDate(passkey.created_at) })} ·{" "}
                      {passkey.last_used_at
                        ? t("seller.settings.password.last_used_date", {
                            date: formatPasskeyDate(passkey.last_used_at),
                          })
                        : t("seller.settings.password.never_used")}
                    </FieldsetDescription>
                  </div>
                </RowContent>
                <RowActions>
                  <Button
                    onClick={() => {
                      setEditingId(passkey.id);
                      setEditingNickname(passkey.nickname);
                    }}
                  >
                    {t("seller.settings.password.rename")}
                  </Button>
                  <Button color="danger" outline onClick={() => setPendingDeletion(passkey)}>
                    {t("seller.settings.password.remove")}
                  </Button>
                </RowActions>
              </Row>
            ),
          )}
        </Rows>
      )}

      {supported ? (
        reachedLimit ? (
          <FieldsetDescription>
            {t("seller.settings.password.passkey_limit_reached", { count: MAX_PASSKEYS })}
          </FieldsetDescription>
        ) : (
          <div>
            <Button color="accent" onClick={handleAdd} disabled={adding}>
              {adding ? t("seller.settings.password.waiting_for_passkey") : t("seller.settings.password.add_a_passkey")}
            </Button>
          </div>
        )
      ) : (
        <FieldsetDescription>{t("seller.settings.password.passkey_browser_unsupported")}</FieldsetDescription>
      )}

      {pendingDeletion ? (
        <Modal
          open
          onClose={() => (deleting ? null : setPendingDeletion(null))}
          title={t("seller.settings.password.remove_passkey_modal_title")}
          footer={
            <>
              <Button onClick={() => setPendingDeletion(null)} disabled={deleting}>
                {t("seller.settings.password.cancel")}
              </Button>
              <Button color="danger" onClick={handleConfirmDelete} disabled={deleting}>
                {deleting ? t("seller.settings.password.removing") : t("seller.settings.password.remove")}
              </Button>
            </>
          }
        >
          <p>{t("seller.settings.password.remove_passkey_modal_body", { name: pendingDeletion.nickname })}</p>
        </Modal>
      ) : null}
    </>
  );
};
