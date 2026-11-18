/*
 * login.ftl: username/e-mail + password. Field ids and names stay Keycloak's (`username`,
 * `password`, `rememberMe`, submit `kc-login`): the form posts to Keycloak and the e2e tests
 * find them by id.
 */
import { FloatingInput } from '@agricoop/ui';
import { kcSanitize } from 'keycloakify/lib/kcSanitize';
import type { PageProps } from 'keycloakify/login/pages/PageProps';
import { useState } from 'react';
import type { I18n } from '../i18n';
import type { KcContext } from '../KcContext';
import { SocialProviders, SubmitButton } from './parts';

export default function Login(props: PageProps<Extract<KcContext, { pageId: 'login.ftl' }>, I18n>) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const {
    social,
    realm,
    url,
    usernameHidden,
    login,
    auth,
    registrationDisabled,
    messagesPerField,
  } = kcContext;
  const { msg, msgStr } = i18n;
  const [submitting, setSubmitting] = useState(false);

  const hasError = messagesPerField.existsError('username', 'password');
  const error = hasError ? (
    <span
      id="input-error"
      dangerouslySetInnerHTML={{
        __html: kcSanitize(messagesPerField.getFirstError('username', 'password')),
      }}
    />
  ) : undefined;
  const usernameLabel = !realm.loginWithEmailAllowed
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
      // Field errors are shown under the fields; other messages in the card's alert.
      displayMessage={!hasError}
      headerNode={msg('loginAccountTitle')}
      displayInfo={realm.password && realm.registrationAllowed && !registrationDisabled}
      infoNode={
        <span id="kc-registration">
          {msg('noAccount')}{' '}
          <a
            href={url.registrationUrl}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {msg('doRegister')}
          </a>
        </span>
      }
      socialProvidersNode={
        realm.password && social?.providers?.length ? (
          <SocialProviders
            providers={social.providers}
            title={msg('identity-provider-login-label')}
          />
        ) : null
      }
    >
      {realm.password && (
        <form
          id="kc-form-login"
          action={url.loginAction}
          method="post"
          className="grid gap-4"
          onSubmit={() => {
            setSubmitting(true);
            return true;
          }}
        >
          {!usernameHidden && (
            <FloatingInput
              id="username"
              name="username"
              label={usernameLabel}
              defaultValue={login.username ?? ''}
              autoComplete="username"
              autoFocus
              dir="ltr"
              error={error}
            />
          )}
          <FloatingInput
            id="password"
            name="password"
            type="password"
            label={msgStr('password')}
            autoComplete="current-password"
            dir="ltr"
            error={usernameHidden ? error : undefined}
            invalid={hasError}
            toggleLabels={{
              show: msgStr('agricoopShowPassword'),
              hide: msgStr('agricoopHidePassword'),
            }}
            capsLockMessage={msgStr('agricoopCapsLock')}
          />

          {(realm.rememberMe && !usernameHidden) || realm.resetPasswordAllowed ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              {realm.rememberMe && !usernameHidden ? (
                <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    defaultChecked={!!login.rememberMe}
                    className="size-4 rounded border-input accent-primary"
                  />
                  {msg('rememberMe')}
                </label>
              ) : (
                <span />
              )}
              {realm.resetPasswordAllowed && (
                <a
                  href={url.loginResetCredentialsUrl}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {msg('doForgotPassword')}
                </a>
              )}
            </div>
          ) : null}

          <input
            type="hidden"
            id="id-hidden-input"
            name="credentialId"
            value={auth.selectedCredential}
          />
          <SubmitButton
            id="kc-login"
            name="login"
            submitting={submitting}
            label={msgStr('doLogIn')}
            busyLabel={msgStr('agricoopSigningIn')}
          />
        </form>
      )}
    </Template>
  );
}
