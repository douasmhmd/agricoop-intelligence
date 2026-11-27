/* login-update-password.ftl: new password twice (after a reset link, or required by an admin). */
import { FloatingInput } from '@agricoop/ui';
import type { PageProps } from 'keycloakify/login/pages/PageProps';
import { useState } from 'react';
import type { I18n } from '../i18n';
import type { KcContext } from '../KcContext';
import { Checkbox, KcHtml, SecondaryButton, SubmitButton } from './parts';

export default function LoginUpdatePassword(
  props: PageProps<Extract<KcContext, { pageId: 'login-update-password.ftl' }>, I18n>,
) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { url, messagesPerField, isAppInitiatedAction } = kcContext;
  const { msg, msgStr } = i18n;
  const [submitting, setSubmitting] = useState(false);
  const toggle = { show: msgStr('agricoopShowPassword'), hide: msgStr('agricoopHidePassword') };
  const hasError = messagesPerField.existsError('password', 'password-confirm');

  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      displayMessage={!hasError}
      headerNode={msg('updatePasswordTitle')}
    >
      <form
        id="kc-passwd-update-form"
        action={url.loginAction}
        method="post"
        className="grid gap-4"
        onSubmit={() => {
          setSubmitting(true);
          return true;
        }}
      >
        <FloatingInput
          id="password-new"
          name="password-new"
          type="password"
          label={msgStr('passwordNew')}
          autoFocus
          autoComplete="new-password"
          dir="ltr"
          toggleLabels={toggle}
          capsLockMessage={msgStr('agricoopCapsLock')}
          error={
            messagesPerField.existsError('password') ? (
              <KcHtml id="input-error-password" html={messagesPerField.get('password')} />
            ) : undefined
          }
        />
        <FloatingInput
          id="password-confirm"
          name="password-confirm"
          type="password"
          label={msgStr('passwordConfirm')}
          autoComplete="new-password"
          dir="ltr"
          toggleLabels={toggle}
          error={
            messagesPerField.existsError('password-confirm') ? (
              <KcHtml
                id="input-error-password-confirm"
                html={messagesPerField.get('password-confirm')}
              />
            ) : undefined
          }
        />
        <Checkbox id="logout-sessions" name="logout-sessions" value="on" defaultChecked>
          {msg('logoutOtherSessions')}
        </Checkbox>
        <SubmitButton
          id="kc-update-password"
          submitting={submitting}
          label={msgStr('doSubmit')}
          busyLabel={msgStr('agricoopSending')}
        />
        {isAppInitiatedAction && (
          <SecondaryButton name="cancel-aia" value="true">
            {msg('doCancel')}
          </SecondaryButton>
        )}
      </form>
    </Template>
  );
}
