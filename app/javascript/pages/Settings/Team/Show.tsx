import { AlertShield } from "@boxicons/react";
import { usePage, router } from "@inertiajs/react";
import * as React from "react";
import { GroupBase, SelectInstance } from "react-select";
import typia from "typia";

import {
  ROLES,
  Role,
  MemberInfo,
  TeamInvitation,
  createTeamInvitation,
  deleteMember,
  resendInvitation,
  restoreMember,
  updateMember,
} from "$app/data/settings/team";
import { SettingPage } from "$app/parsers/settings";
import { isValidEmail } from "$app/utils/email";
import { useTranslate } from "$app/utils/i18n";
import { asyncVoid } from "$app/utils/promise";
import { assertResponseError } from "$app/utils/request";

import { Button } from "$app/components/Button";
import { useCurrentSeller } from "$app/components/CurrentSeller";
import { LoadingSpinner } from "$app/components/LoadingSpinner";
import { Modal } from "$app/components/Modal";
import { Option, Select } from "$app/components/Select";
import { showAlert } from "$app/components/server-components/Alert";
import { Layout as SettingsLayout } from "$app/components/Settings/Layout";
import { Alert } from "$app/components/ui/Alert";
import { Avatar } from "$app/components/ui/Avatar";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { FormSection } from "$app/components/ui/FormSection";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { LinkButton } from "$app/components/ui/LinkButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";
import { WithTooltip } from "$app/components/WithTooltip";

const useRoleTitles = (): Record<Role, string> => {
  const { t } = useTranslate();
  return {
    owner: t("seller.settings.team.role_owner"),
    accountant: t("seller.settings.team.role_accountant"),
    admin: t("seller.settings.team.role_admin"),
    marketing: t("seller.settings.team.role_marketing"),
    support: t("seller.settings.team.role_support"),
  };
};

type TeamPageProps = {
  member_infos: MemberInfo[];
  can_invite_member: boolean;
  settings_pages: SettingPage[];
};

export default function TeamPage() {
  const props = typia.assert<TeamPageProps>(usePage().props);
  const roleTitles = useRoleTitles();

  const options: Option[] = ROLES.map((role) => ({
    id: role,
    label: roleTitles[role],
  }));

  const refreshMemberInfos = () => {
    router.reload({ only: ["member_infos"] });
  };

  return (
    <SettingsLayout currentPage="team" pages={props.settings_pages}>
      <form>
        {props.can_invite_member ? (
          <AddTeamMembersSection refreshMemberInfos={refreshMemberInfos} options={options} />
        ) : null}
        <TeamMembersSection memberInfos={props.member_infos} refreshMemberInfos={refreshMemberInfos} />
      </form>
    </SettingsLayout>
  );
}

const AddTeamMembersSection = ({
  refreshMemberInfos,
  options,
}: {
  refreshMemberInfos: () => void;
  options: Option[];
}) => {
  const { t } = useTranslate();
  const emailUID = React.useId();
  const roleUID = React.useId();

  const emailFieldRef = React.useRef<HTMLInputElement>(null);
  const roleFieldRef = React.useRef<SelectInstance<Option, false, GroupBase<Option>>>(null);

  const [teamInvitation, setTeamInvitation] = React.useState<TeamInvitation>({ email: "", role: null });
  const [errors, setErrors] = React.useState<Map<string, string>>(new Map());

  const updateTeamInvitation = (update: Partial<TeamInvitation>) =>
    setTeamInvitation((prevTeamInvitation) => ({ ...prevTeamInvitation, ...update }));

  const clearError = (errorKey: string) => {
    if (errors.has(errorKey)) {
      const newErrors = new Map(errors);
      newErrors.delete(errorKey);
      setErrors(newErrors);
    }
  };

  const [loading, setLoading] = React.useState(false);

  const onSubmit = asyncVoid(async () => {
    const errors = new Map<string, string>();

    if (!isValidEmail(teamInvitation.email)) {
      errors.set("email", t("seller.settings.team.valid_email_error"));
      showAlert(t("seller.settings.team.valid_email_error"), "error");
      emailFieldRef.current?.focus();
    } else if (!teamInvitation.role) {
      errors.set("role", t("seller.settings.team.select_role_error"));
      showAlert(t("seller.settings.team.select_role_error"), "error");
      roleFieldRef.current?.focus();
    }
    setErrors(errors);
    if (errors.size > 0) return;

    setLoading(true);
    const result = await createTeamInvitation(teamInvitation);
    if (result.success) {
      refreshMemberInfos();
      showAlert(t("seller.settings.team.invitation_sent"), "success");
      updateTeamInvitation({ email: "", role: null });
    } else {
      showAlert(result.error_message, "error", { position: "bottom" });
      errors.set("error", result.error_message);
    }
    setErrors(errors);
    setLoading(false);
  });

  return (
    <FormSection
      header={
        <>
          <h2>{t("seller.settings.team.add_team_members")}</h2>
          <div>{t("seller.settings.team.invite_team_members_desc")}</div>
          <a href="/help/article/326-teams-and-roles" target="_blank" rel="noreferrer">
            {t("seller.settings.team.learn_more")}
          </a>
        </>
      }
    >
      <div
        style={{
          display: "grid",
          gap: "var(--spacer-3)",
          gridTemplateColumns: "repeat(auto-fit, max(var(--dynamic-grid), 50% - var(--spacer-3) / 2))",
        }}
      >
        <Fieldset state={errors.has("email") ? "danger" : undefined}>
          <FieldsetTitle>
            <Label htmlFor={emailUID}>{t("seller.settings.team.email")}</Label>
          </FieldsetTitle>
          <Input
            id={emailUID}
            type="text"
            ref={emailFieldRef}
            className="required"
            value={teamInvitation.email}
            onChange={(evt) => {
              updateTeamInvitation({ email: evt.target.value });
              clearError("email");
            }}
          />
        </Fieldset>
        <Fieldset state={errors.has("role") ? "danger" : undefined}>
          <FieldsetTitle>
            <Label htmlFor={roleUID}>{t("seller.settings.team.role")}</Label>
          </FieldsetTitle>
          <Select
            ref={roleFieldRef}
            inputId={roleUID}
            instanceId={roleUID}
            options={options.filter((o) => o.id !== "owner")}
            isMulti={false}
            isClearable={false}
            value={options.find((o) => o.id === teamInvitation.role) ?? null}
            onChange={(evt) => {
              if (evt !== null) {
                updateTeamInvitation({ role: evt.id });
                clearError("role");
              }
            }}
          />
        </Fieldset>
      </div>
      <Button color="primary" className="w-fit" disabled={loading} onClick={onSubmit}>
        {loading ? (
          <>
            <LoadingSpinner color="grey" /> {t("seller.settings.team.sending_invitation")}
          </>
        ) : (
          t("seller.settings.team.send_invitation")
        )}
      </Button>
    </FormSection>
  );
};

const TeamMembersSection = ({
  memberInfos,
  refreshMemberInfos,
}: {
  memberInfos: MemberInfo[];
  refreshMemberInfos: () => void;
}) => {
  const { t } = useTranslate();
  const roleTitles = useRoleTitles();
  const currentSeller = useCurrentSeller();
  const [loading, setLoading] = React.useState(false);
  const [confirming, setConfirming] = React.useState<MemberInfo | null>(null);
  const [deletedMember, setDeletedMember] = React.useState<MemberInfo | null>(null);
  const ref = React.useRef<HTMLHeadingElement>(null);

  const handleOptionChange = async ({
    memberInfo,
    selectedOption,
  }: {
    memberInfo: MemberInfo;
    selectedOption: string;
  }) => {
    setDeletedMember(null);
    setLoading(true);
    try {
      switch (selectedOption) {
        case "leave_team": {
          await deleteMember(memberInfo);
          window.location.href = Routes.dashboard_path();
          break;
        }
        case "remove_from_team": {
          await deleteMember(memberInfo);
          refreshMemberInfos();
          setDeletedMember(memberInfo);
          ref.current?.scrollIntoView({ behavior: "smooth" });
          break;
        }
        case "resend_invitation": {
          await resendInvitation(memberInfo);
          refreshMemberInfos();
          showAlert(t("seller.settings.team.invitation_sent"), "success");
          break;
        }
        default: {
          const newRole = typia.assert<Role>(selectedOption);
          if (ROLES.includes(newRole) && memberInfo.role !== newRole) {
            await updateMember(memberInfo, newRole);
            refreshMemberInfos();
            showAlert(
              t("seller.settings.team.role_changed", {
                name: memberInfo.name !== "" ? memberInfo.name : memberInfo.email,
                role: roleTitles[newRole],
              }),
              "success",
            );
            break;
          }
        }
      }
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error", { position: selectedOption === "resend_invitation" ? "bottom" : "top" });
    }
    setLoading(false);
  };

  return (
    <FormSection header={<h2 ref={ref}>{t("seller.settings.team.team_members")}</h2>}>
      {deletedMember ? (
        <Alert variant="success">
          <div className="flex flex-col justify-between sm:flex-row">
            {t("seller.settings.team.member_removed", {
              name: deletedMember.name !== "" ? deletedMember.name : deletedMember.email,
            })}
            <LinkButton
              onClick={asyncVoid(async () => {
                try {
                  await restoreMember(deletedMember);
                  refreshMemberInfos();
                  showAlert(
                    t("seller.settings.team.member_restored", {
                      name: deletedMember.name !== "" ? deletedMember.name : deletedMember.email,
                    }),
                    "success",
                  );
                  setDeletedMember(null);
                } catch (e) {
                  assertResponseError(e);
                  showAlert(e.message, "error");
                }
              })}
            >
              {t("seller.settings.team.undo")}
            </LinkButton>
          </div>
        </Alert>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("seller.settings.team.member")}</TableHead>
            <TableHead>{t("seller.settings.team.role")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {memberInfos.map((memberInfo) => (
            <TableRow key={`${memberInfo.type}-${memberInfo.id}`}>
              <TableCell>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--spacer-4)" }}>
                  <Avatar
                    style={{ width: "var(--spacer-6)" }}
                    src={memberInfo.avatar_url}
                    alt={`Avatar of ${memberInfo.name}`}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--spacer-2)" }}>
                    <div>
                      {memberInfo.name}
                      <small className="block">{memberInfo.email}</small>
                    </div>
                    {memberInfo.is_expired ? (
                      <WithTooltip tip={t("seller.settings.team.invitation_expired_tip")} position="top">
                        <AlertShield
                          pack="filled"
                          style={{ color: "rgb(var(--warning))" }}
                          aria-label={t("seller.settings.team.invitation_expired_tip")}
                          className="size-5"
                        />
                      </WithTooltip>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Select
                    instanceId={memberInfo.id}
                    options={memberInfo.options}
                    onChange={(newOption) => {
                      if (newOption !== null) {
                        void handleOptionChange({ memberInfo, selectedOption: newOption.id });
                      }
                    }}
                    isMulti={false}
                    isClearable={false}
                    isDisabled={loading || memberInfo.options.length === 1}
                    value={memberInfo.options.find((o) => o.id === memberInfo.role) ?? null}
                    className="flex-1"
                  />
                  {memberInfo.leave_team_option ? (
                    <Button color="danger" disabled={loading} onClick={() => setConfirming(memberInfo)}>
                      {memberInfo.leave_team_option.label}
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {confirming ? (
        <Modal
          open
          onClose={() => setConfirming(null)}
          title={t("seller.settings.team.leave_team_modal_title")}
          footer={
            <>
              <Button disabled={loading} onClick={() => setConfirming(null)}>
                {t("seller.settings.password.cancel")}
              </Button>
              <Button
                color="danger"
                disabled={loading}
                onClick={asyncVoid(async () => {
                  setLoading(true);
                  await handleOptionChange({ memberInfo: confirming, selectedOption: "leave_team" });
                  setConfirming(null);
                })}
              >
                {loading ? (
                  <>
                    <LoadingSpinner color="grey" /> <h4>{t("seller.settings.team.leaving_team")}</h4>
                  </>
                ) : (
                  <h4>{t("seller.settings.team.confirm_leave_team")}</h4>
                )}
              </Button>
            </>
          }
        >
          {t("seller.settings.team.leave_team_modal_body", { name: currentSeller?.name || "" })}
        </Modal>
      ) : null}
    </FormSection>
  );
};
