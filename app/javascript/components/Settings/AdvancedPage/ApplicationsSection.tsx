import { Link, router } from "@inertiajs/react";
import * as React from "react";

import { useTranslate } from "$app/hooks/useTranslate";

import { Button } from "$app/components/Button";
import { showAlert } from "$app/components/server-components/Alert";
import ApplicationForm from "$app/components/Settings/AdvancedPage/ApplicationForm";
import { FormSection } from "$app/components/ui/FormSection";
import { Row, RowActions, RowContent, Rows } from "$app/components/ui/Rows";

import placeholderAppIcon from "$assets/images/app.png";

export type Application = {
  id: string;
  name: string;
  icon_url: string | null;
};

const CreateApplication = () => {
  const { t } = useTranslate();
  return (
    <>
      <h3>{t("seller.settings.advanced.create_application")}</h3>
      <ApplicationForm />
    </>
  );
};

const ApplicationList = (props: { applications: Application[] }) => {
  const { t } = useTranslate();
  const [applications, setApplications] = React.useState(props.applications);

  const removeApplication = (id: string) => () => {
    setApplications((prevState) => prevState.filter((app) => app.id !== id));
  };

  return applications.length > 0 ? (
    <>
      <h3>{t("seller.settings.advanced.your_applications")}</h3>
      <Rows role="list">
        {applications.map((app) => (
          <ApplicationRow key={app.id} application={app} onRemove={removeApplication(app.id)} />
        ))}
      </Rows>
    </>
  ) : null;
};

const ApplicationRow = ({ application, onRemove }: { application: Application; onRemove: () => void }) => {
  const { t } = useTranslate();
  const deleteApp = () => {
    // eslint-disable-next-line no-alert
    if (!confirm(t("seller.settings.advanced.delete_application_forever_confirm"))) return;

    router.delete(Routes.oauth_application_path(application.id), {
      preserveScroll: true,
      onSuccess: () => {
        showAlert(t("seller.settings.advanced.application_deleted"), "success");
        onRemove(); // This will update the local state immediately
      },
      onError: () => {
        showAlert(t("seller.settings.advanced.failed_to_delete_app"), "error");
      },
    });
  };

  return (
    <Row role="listitem">
      <RowContent>
        <img src={application.icon_url || placeholderAppIcon} width={56} height={56} />
        <h4>{application.name}</h4>
      </RowContent>
      <RowActions>
        <Button>
          <Link className="no-underline" href={Routes.oauth_application_path(application.id)}>
            {t("actions.edit")}
          </Link>
        </Button>
        <Button color="danger" onClick={deleteApp}>
          {t("actions.remove")}
        </Button>
      </RowActions>
    </Row>
  );
};

const ApplicationsSection = (props: { applications: Application[] }) => {
  const { t } = useTranslate();
  return (
    <FormSection
      header={
        <>
          <h2>{t("seller.settings.advanced.applications")}</h2>
          <a href="/help/article/280-create-application-api" target="_blank" rel="noreferrer">
            {t("actions.learn_more")}
          </a>
        </>
      }
    >
      <CreateApplication />
      <ApplicationList applications={props.applications} />
    </FormSection>
  );
};
export default ApplicationsSection;
