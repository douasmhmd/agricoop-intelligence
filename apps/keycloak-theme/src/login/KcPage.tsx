import type { ClassKey } from 'keycloakify/login';
import DefaultPage from 'keycloakify/login/DefaultPage';
import { lazy, Suspense } from 'react';
import { useI18n } from './i18n';
import type { KcContext } from './KcContext';
import Template from './Template';

const UserProfileFormFields = lazy(() => import('./UserProfileFormFields'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const LoginResetPassword = lazy(() => import('./pages/LoginResetPassword'));
const LoginUpdatePassword = lazy(() => import('./pages/LoginUpdatePassword'));
const LoginOtp = lazy(() => import('./pages/LoginOtp'));
const LoginConfigTotp = lazy(() => import('./pages/LoginConfigTotp'));
const LoginVerifyEmail = lazy(() =>
  import('./pages/MessagePages').then((m) => ({ default: m.LoginVerifyEmail })),
);
const ErrorPage = lazy(() =>
  import('./pages/MessagePages').then((m) => ({ default: m.ErrorPage })),
);
const InfoPage = lazy(() => import('./pages/MessagePages').then((m) => ({ default: m.InfoPage })));
const LogoutConfirm = lazy(() =>
  import('./pages/MessagePages').then((m) => ({ default: m.LogoutConfirm })),
);
const LoginPageExpired = lazy(() =>
  import('./pages/MessagePages').then((m) => ({ default: m.LoginPageExpired })),
);
const SelectAuthenticator = lazy(() =>
  import('./pages/MessagePages').then((m) => ({ default: m.SelectAuthenticator })),
);

/** The registration form asks for the password twice. */
const doMakeUserConfirmPassword = true;

/**
 * Pages without their own component (profile update, IdP linking, WebAuthn…) render Keycloakify's
 * default markup inside our Template with these classes, and our user-profile fields.
 */
const classes = {
  kcFormGroupClass: 'grid gap-1.5 mb-4',
  kcLabelClass: 'text-sm font-medium',
  kcInputClass:
    'h-11 w-full rounded-lg border border-input bg-card px-3 text-base shadow-soft focus-visible:border-ring focus-visible:outline-none aria-invalid:border-destructive',
  kcInputErrorMessageClass: 'text-sm text-destructive',
  kcButtonClass:
    'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-60',
  kcButtonPrimaryClass: 'bg-primary text-primary-foreground hover:bg-primary/90',
  kcButtonDefaultClass: 'border bg-card hover:bg-muted',
  kcButtonBlockClass: 'w-full',
  kcButtonLargeClass: 'h-12 text-base',
  kcFormOptionsWrapperClass: 'text-sm',
  kcFormSettingClass: 'flex flex-wrap items-center justify-between gap-2',
} satisfies { [key in ClassKey]?: string };

export default function KcPage({ kcContext }: { kcContext: KcContext }) {
  const { i18n } = useI18n({ kcContext });
  return (
    <Suspense>
      {(() => {
        const common = { i18n, classes, Template, doUseDefaultCss: false } as const;
        switch (kcContext.pageId) {
          case 'login.ftl':
            return <Login kcContext={kcContext} {...common} />;
          case 'register.ftl':
            return <Register kcContext={kcContext} {...common} />;
          case 'login-reset-password.ftl':
            return <LoginResetPassword kcContext={kcContext} {...common} />;
          case 'login-update-password.ftl':
            return <LoginUpdatePassword kcContext={kcContext} {...common} />;
          case 'login-otp.ftl':
            return <LoginOtp kcContext={kcContext} {...common} />;
          case 'login-config-totp.ftl':
            return <LoginConfigTotp kcContext={kcContext} {...common} />;
          case 'login-verify-email.ftl':
            return <LoginVerifyEmail kcContext={kcContext} {...common} />;
          case 'error.ftl':
            return <ErrorPage kcContext={kcContext} {...common} />;
          case 'info.ftl':
            return <InfoPage kcContext={kcContext} {...common} />;
          case 'logout-confirm.ftl':
            return <LogoutConfirm kcContext={kcContext} {...common} />;
          case 'login-page-expired.ftl':
            return <LoginPageExpired kcContext={kcContext} {...common} />;
          case 'select-authenticator.ftl':
            return <SelectAuthenticator kcContext={kcContext} {...common} />;
          default:
            return (
              <DefaultPage
                kcContext={kcContext}
                i18n={i18n}
                classes={classes}
                Template={Template}
                doUseDefaultCss={false}
                UserProfileFormFields={UserProfileFormFields}
                doMakeUserConfirmPassword={doMakeUserConfirmPassword}
              />
            );
        }
      })()}
    </Suspense>
  );
}
