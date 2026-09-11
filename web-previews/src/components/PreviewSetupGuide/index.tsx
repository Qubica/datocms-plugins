import { Button, ButtonLink, useCtx } from 'datocms-react-ui';
import styles from './styles.module.css';

const setupGuideUrl =
  'https://github.com/datocms/plugins/tree/master/web-previews#installation-and-configuration';
type Props = {
  compact?: boolean;
};

export function PreviewSetupGuide({ compact = false }: Props) {
  const ctx = useCtx();

  return (
    <div className={compact ? styles.compact : styles.wrapper}>
      <div className={styles.content}>
        <h2 className={styles.title}>No preview available</h2>
        <p>
          Web Previews is installed, but no website is currently available to
          preview
        </p>
        <p>
          Your web developer can set up the endpoint that returns preview URLs
          for your records
          <br />
          The setup guide below explains how
        </p>

        <div className={styles.actions}>
          <ButtonLink
            href={setupGuideUrl}
            target="_blank"
            buttonType="muted"
            buttonSize="s"
          >
            Setup guide
          </ButtonLink>
          {ctx.currentRole.meta.final_permissions.can_edit_schema && (
            <Button
              buttonType="primary"
              buttonSize="s"
              onClick={() => {
                const environmentPrefix = ctx.isEnvironmentPrimary
                  ? ''
                  : `/environments/${ctx.environment}`;
                ctx.navigateTo(
                  `${environmentPrefix}/configuration/plugins/${ctx.plugin.id}/edit`,
                );
              }}
            >
              Plugin settings
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
