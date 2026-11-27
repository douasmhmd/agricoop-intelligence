/* login-otp.ftl: one-time code from the authenticator app (choose the device when there are several). */
import { cn, FloatingInput } from '@agricoop/ui';
import type { PageProps } from 'keycloakify/login/pages/PageProps';
import { Smartphone } from 'lucide-react';
import { useState } from 'react';
import type { I18n } from '../i18n';
import type { KcContext } from '../KcContext';
import { KcHtml, SubmitButton } from './parts';

export default function LoginOtp(
  props: PageProps<Extract<KcContext, { pageId: 'login-otp.ftl' }>, I18n>,
) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { otpLogin, url, messagesPerField } = kcContext;
  const { msg, msgStr } = i18n;
  const [submitting, setSubmitting] = useState(false);
  const credentials = otpLogin.userOtpCredentials;

  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      displayMessage={!messagesPerField.existsError('totp')}
      headerNode={msg('doLogIn')}
    >
      <form
        id="kc-otp-login-form"
        action={url.loginAction}
        method="post"
        className="grid gap-4"
        onSubmit={() => {
          setSubmitting(true);
          return true;
        }}
      >
        {credentials.length > 1 && (
          <fieldset className="grid gap-2">
            {credentials.map((credential, index) => (
              <label
                key={credential.id}
                htmlFor={`kc-otp-credential-${index}`}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-3.5 py-3 text-sm shadow-soft transition-colors',
                  'has-[:checked]:border-primary has-[:checked]:bg-primary/5',
                )}
              >
                <input
                  id={`kc-otp-credential-${index}`}
                  type="radio"
                  name="selectedCredentialId"
                  value={credential.id}
                  defaultChecked={credential.id === otpLogin.selectedCredentialId}
                  className="accent-primary"
                />
                <Smartphone className="size-4 text-muted-foreground" aria-hidden />
                {credential.userLabel}
              </label>
            ))}
          </fieldset>
        )}
        <FloatingInput
          id="otp"
          name="otp"
          label={msgStr('loginOtpOneTime')}
          autoComplete="one-time-code"
          inputMode="numeric"
          autoFocus
          dir="ltr"
          className="[&_input]:text-lg [&_input]:tracking-[0.4em]"
          error={
            messagesPerField.existsError('totp') ? (
              <KcHtml id="input-error-otp-code" html={messagesPerField.get('totp')} />
            ) : undefined
          }
        />
        <SubmitButton
          id="kc-login"
          name="login"
          submitting={submitting}
          label={msgStr('doLogIn')}
          busyLabel={msgStr('agricoopSigningIn')}
        />
      </form>
    </Template>
  );
}
