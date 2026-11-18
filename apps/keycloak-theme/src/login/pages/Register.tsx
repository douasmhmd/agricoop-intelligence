/* register.ftl: user-profile fields (floating inputs), optional terms, back to sign-in. */
import type { PageProps } from 'keycloakify/login/pages/PageProps';
import { useState } from 'react';
import type { I18n } from '../i18n';
import type { KcContext } from '../KcContext';
import UserProfileFormFields from '../UserProfileFormFields';
import { KcHtml, SubmitButton, TextLink } from './parts';

export default function Register(
  props: PageProps<Extract<KcContext, { pageId: 'register.ftl' }>, I18n>,
) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { messageHeader, url, messagesPerField, termsAcceptanceRequired } = kcContext;
  const { msg, msgStr, advancedMsg } = i18n;
  const [submittable, setSubmittable] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      headerNode={messageHeader !== undefined ? advancedMsg(messageHeader) : msg('registerTitle')}
      displayMessage={messagesPerField.exists('global')}
      displayRequiredFields
    >
      <form
        id="kc-register-form"
        action={url.registrationAction}
        method="post"
        className="grid gap-4"
        onSubmit={() => {
          setSubmitting(true);
          return true;
        }}
      >
        <UserProfileFormFields
          kcContext={kcContext}
          i18n={i18n}
          kcClsx={() => ''}
          onIsFormSubmittableValueChange={setSubmittable}
          doMakeUserConfirmPassword
        />
        {termsAcceptanceRequired && (
          <div className="grid gap-2 rounded-xl border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{msg('termsTitle')}</p>
            <div id="kc-registration-terms-text" className="text-muted-foreground">
              {msg('termsText')}
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                id="termsAccepted"
                name="termsAccepted"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="size-4 accent-primary"
              />
              {msg('acceptTerms')}
            </label>
            {messagesPerField.existsError('termsAccepted') && (
              <span className="text-destructive">
                <KcHtml
                  id="input-error-terms-accepted"
                  html={messagesPerField.get('termsAccepted')}
                />
              </span>
            )}
          </div>
        )}
        <SubmitButton
          id="kc-register"
          submitting={submitting}
          disabled={!submittable || (termsAcceptanceRequired && !termsAccepted)}
          label={msgStr('doRegister')}
          busyLabel={msgStr('agricoopSending')}
        />
        <p className="text-center text-sm">
          <TextLink href={url.loginUrl}>{msg('backToLogin')}</TextLink>
        </p>
      </form>
    </Template>
  );
}
