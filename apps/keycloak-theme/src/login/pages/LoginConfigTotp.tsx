/* login-config-totp.ftl: set up an authenticator app (QR code or manual key), then confirm a code. */
import { FloatingInput } from '@agricoop/ui';
import type { PageProps } from 'keycloakify/login/pages/PageProps';
import { useState } from 'react';
import type { I18n } from '../i18n';
import type { KcContext } from '../KcContext';
import { Checkbox, KcHtml, SecondaryButton, SubmitButton, TextLink } from './parts';

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-sm text-muted-foreground">{children}</div>
    </li>
  );
}

export default function LoginConfigTotp(
  props: PageProps<Extract<KcContext, { pageId: 'login-config-totp.ftl' }>, I18n>,
) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { url, isAppInitiatedAction, totp, mode, messagesPerField } = kcContext;
  const { msg, msgStr, advancedMsg } = i18n;
  const [submitting, setSubmitting] = useState(false);
  const manual = mode === 'manual';

  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      headerNode={msg('loginTotpTitle')}
      displayMessage={!messagesPerField.existsError('totp', 'userLabel')}
    >
      <ol id="kc-totp-settings" className="mb-6 grid gap-4">
        <Step n={1}>
          <p>{msg('loginTotpStep1')}</p>
          <ul id="kc-totp-supported-apps" className="mt-1 list-disc ps-5">
            {totp.supportedApplications.map((app) => (
              <li key={app}>{advancedMsg(app)}</li>
            ))}
          </ul>
        </Step>
        {manual ? (
          <Step n={2}>
            <p>{msg('loginTotpManualStep2')}</p>
            <p
              id="kc-totp-secret-key"
              dir="ltr"
              className="mt-2 rounded-lg border bg-muted px-3 py-2 font-mono text-sm break-all text-foreground"
            >
              {totp.totpSecretEncoded}
            </p>
            <p className="mt-2">
              <TextLink id="mode-barcode" href={totp.qrUrl}>
                {msg('loginTotpScanBarcode')}
              </TextLink>
            </p>
            <p className="mt-2">{msg('loginTotpManualStep3')}</p>
            <ul className="mt-1 grid gap-0.5 text-xs" dir="ltr">
              <li id="kc-totp-type">
                {msg('loginTotpType')}: {msg(`loginTotp.${totp.policy.type}`)}
              </li>
              <li id="kc-totp-algorithm">
                {msg('loginTotpAlgorithm')}: {totp.policy.getAlgorithmKey()}
              </li>
              <li id="kc-totp-digits">
                {msg('loginTotpDigits')}: {totp.policy.digits}
              </li>
              {totp.policy.type === 'totp' ? (
                <li id="kc-totp-period">
                  {msg('loginTotpInterval')}: {totp.policy.period}
                </li>
              ) : (
                <li id="kc-totp-counter">
                  {msg('loginTotpCounter')}: {totp.policy.initialCounter}
                </li>
              )}
            </ul>
          </Step>
        ) : (
          <Step n={2}>
            <p>{msg('loginTotpStep2')}</p>
            <img
              id="kc-totp-secret-qr-code"
              src={`data:image/png;base64, ${totp.totpSecretQrCode}`}
              alt=""
              className="mt-3 size-44 rounded-xl border bg-white p-2"
            />
            <p className="mt-2">
              <TextLink id="mode-manual" href={totp.manualUrl}>
                {msg('loginTotpUnableToScan')}
              </TextLink>
            </p>
          </Step>
        )}
        <Step n={3}>
          <p>{msg('loginTotpStep3')}</p>
          <p>{msg('loginTotpStep3DeviceName')}</p>
        </Step>
      </ol>

      <form
        id="kc-totp-settings-form"
        action={url.loginAction}
        method="post"
        className="grid gap-4"
        onSubmit={() => {
          setSubmitting(true);
          return true;
        }}
      >
        <FloatingInput
          id="totp"
          name="totp"
          label={`${msgStr('authenticatorCode')} *`}
          autoComplete="one-time-code"
          inputMode="numeric"
          dir="ltr"
          error={
            messagesPerField.existsError('totp') ? (
              <KcHtml id="input-error-otp-code" html={messagesPerField.get('totp')} />
            ) : undefined
          }
        />
        <input type="hidden" id="totpSecret" name="totpSecret" value={totp.totpSecret} />
        {mode && <input type="hidden" id="mode" name="mode" value={mode} />}
        <FloatingInput
          id="userLabel"
          name="userLabel"
          label={`${msgStr('loginTotpDeviceName')}${totp.otpCredentials.length >= 1 ? ' *' : ''}`}
          autoComplete="off"
          error={
            messagesPerField.existsError('userLabel') ? (
              <KcHtml id="input-error-otp-label" html={messagesPerField.get('userLabel')} />
            ) : undefined
          }
        />
        <Checkbox id="logout-sessions" name="logout-sessions" value="on" defaultChecked>
          {msg('logoutOtherSessions')}
        </Checkbox>
        <SubmitButton
          id="saveTOTPBtn"
          submitting={submitting}
          label={msgStr('doSubmit')}
          busyLabel={msgStr('agricoopSending')}
        />
        {isAppInitiatedAction && (
          <SecondaryButton id="cancelTOTPBtn" name="cancel-aia" value="true">
            {msg('doCancel')}
          </SecondaryButton>
        )}
      </form>
    </Template>
  );
}
