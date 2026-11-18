import type { ClassKey } from 'keycloakify/login';
import DefaultPage from 'keycloakify/login/DefaultPage';
import { lazy, Suspense } from 'react';
import { useI18n } from './i18n';
import type { KcContext } from './KcContext';
import Template from './Template';

const UserProfileFormFields = lazy(() => import('keycloakify/login/UserProfileFormFields'));
const Login = lazy(() => import('./pages/Login'));

/** The registration form asks for the password twice. */
const doMakeUserConfirmPassword = true;

/**
 * Keycloakify's default pages render inside our Template with these classes (design-system look)
 * until each page gets its own component.
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
        switch (kcContext.pageId) {
          case 'login.ftl':
            return (
              <Login
                kcContext={kcContext}
                i18n={i18n}
                classes={classes}
                Template={Template}
                doUseDefaultCss={false}
              />
            );
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
