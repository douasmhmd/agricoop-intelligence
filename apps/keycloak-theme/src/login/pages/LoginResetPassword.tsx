/* login-reset-password.ftl: identifier → Keycloak e-mails a reset link. */
import { FloatingInput } from '@agricoop/ui';
import type { PageProps } from 'keycloakify/login/pages/PageProps';
import { useState } from 'react';
import type { I18n } from '../i18n';
import type { KcContext } from '../KcContext';
import { Instruction, KcHtml, SubmitButton, TextLink } from './parts';

export default function LoginResetPassword(
  props: PageProps<Extract<KcContext, { pageId: 'login-reset-password.ftl' }>, I18n>,
) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { url, realm, auth, messagesPerField } = kcContext;
  const { msg, msgStr } = i18n;
  const [submitting, setSubmitting] = useState(false);
  const label = !realm.loginWithEmailAllowed
    ? msgStr('username')
    : !realm.registrationEmailAsUsername
      ? msgStr('usernameOrEmail')
      : msgStr('email');

  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      displayMessage={!messagesPerField.existsError('username')}
      headerNode={msg('emailForgotTitle')}
    >
      <form
        id="kc-reset-password-form"
        action={url.loginAction}
        method="post"
        className="grid gap-4"
        onSubmit={() => {
          setSubmitting(true);
          return true;
        }}
      >
        <Instruction>
          {realm.duplicateEmailsAllowed ? msg('emailInstructionUsername') : msg('emailInstruction')}
        </Instruction>
        <FloatingInput
          id="username"
          name="username"
          label={label}
          autoFocus
          autoComplete="username"
          dir="ltr"
          defaultValue={auth.attemptedUsername ?? ''}
          error={
            messagesPerField.existsError('username') ? (
              <KcHtml id="input-error-username" html={messagesPerField.get('username')} />
            ) : undefined
          }
        />
        <SubmitButton
          id="kc-reset-password"
          submitting={submitting}
          label={msgStr('doSubmit')}
          busyLabel={msgStr('agricoopSending')}
        />
        <p className="text-center text-sm">
          <TextLink href={url.loginUrl}>{msg('backToLogin')}</TextLink>
        </p>
      </form>
    </Template>
  );
}
