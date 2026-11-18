/*
 * Message-style pages: e-mail verification, error, info, logout confirmation, page expired and
 * choosing another way to sign in. Ids, names and links are Keycloak's.
 */
import { cn } from '@agricoop/ui';
import type { PageProps } from 'keycloakify/login/pages/PageProps';
import {
  ArrowLeft,
  CircleAlert,
  Clock,
  Info as InfoIcon,
  KeyRound,
  LogOut,
  MailCheck,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { I18n } from '../i18n';
import type { KcContext } from '../KcContext';
import { Instruction, KcHtml, SubmitButton, TextLink } from './parts';

type Page<Id extends KcContext['pageId']> = PageProps<Extract<KcContext, { pageId: Id }>, I18n>;

function Medallion({
  icon: Icon,
  tone = 'primary',
}: {
  icon: LucideIcon;
  tone?: 'primary' | 'danger';
}) {
  return (
    <span
      className={cn(
        'mb-4 grid size-12 place-items-center rounded-full border shadow-soft',
        tone === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-accent text-primary',
      )}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

function BackLink({
  href,
  children,
  id,
}: {
  href: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <a
      id={id}
      href={href}
      className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      {children}
    </a>
  );
}

export function LoginVerifyEmail(props: Page<'login-verify-email.ftl'>) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { url, user } = kcContext;
  const { msg } = i18n;
  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      displayInfo
      headerNode={msg('emailVerifyTitle')}
      infoNode={
        <span>
          {msg('emailVerifyInstruction2')}{' '}
          <TextLink href={url.loginAction}>{msg('doClickHere')}</TextLink>{' '}
          {msg('emailVerifyInstruction3')}
        </span>
      }
    >
      <Medallion icon={MailCheck} />
      <Instruction>{msg('emailVerifyInstruction1', user?.email ?? '')}</Instruction>
    </Template>
  );
}

export function ErrorPage(props: Page<'error.ftl'>) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { message, client, skipLink } = kcContext;
  const { msg } = i18n;
  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      displayMessage={false}
      headerNode={msg('errorTitle')}
    >
      <Medallion icon={CircleAlert} tone="danger" />
      <p id="kc-error-message" className="text-sm leading-relaxed">
        <KcHtml html={message.summary} />
      </p>
      {!skipLink && client?.baseUrl !== undefined && (
        <BackLink id="backToApplication" href={client.baseUrl}>
          {msg('backToApplication')}
        </BackLink>
      )}
    </Template>
  );
}

export function InfoPage(props: Page<'info.ftl'>) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { messageHeader, message, requiredActions, skipLink, pageRedirectUri, actionUri, client } =
    kcContext;
  const { msg, advancedMsgStr } = i18n;
  const summary = [
    message.summary?.trim() ?? '',
    requiredActions
      ? `<b>${requiredActions.map((a) => advancedMsgStr(`requiredAction.${a}`)).join(', ')}</b>`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      displayMessage={false}
      headerNode={<KcHtml html={messageHeader ? advancedMsgStr(messageHeader) : message.summary} />}
    >
      <Medallion icon={InfoIcon} />
      <p id="kc-info-message" className="text-sm leading-relaxed text-muted-foreground">
        <KcHtml html={summary} />
      </p>
      {!skipLink &&
        (pageRedirectUri ? (
          <BackLink href={pageRedirectUri}>{msg('backToApplication')}</BackLink>
        ) : actionUri ? (
          <a
            href={actionUri}
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90"
          >
            {msg('proceedWithAction')}
          </a>
        ) : client.baseUrl ? (
          <BackLink href={client.baseUrl}>{msg('backToApplication')}</BackLink>
        ) : null)}
    </Template>
  );
}

export function LogoutConfirm(props: Page<'logout-confirm.ftl'>) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { url, client, logoutConfirm } = kcContext;
  const { msg, msgStr } = i18n;
  const [submitting, setSubmitting] = useState(false);
  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      headerNode={msg('logoutConfirmTitle')}
    >
      <Medallion icon={LogOut} />
      <div id="kc-logout-confirm" className="grid gap-5">
        <Instruction>{msg('logoutConfirmHeader')}</Instruction>
        <form
          action={url.logoutConfirmAction}
          method="post"
          onSubmit={() => {
            setSubmitting(true);
            return true;
          }}
        >
          <input type="hidden" name="session_code" value={logoutConfirm.code} />
          <SubmitButton
            id="kc-logout"
            name="confirmLogout"
            submitting={submitting}
            label={msgStr('doLogout')}
            busyLabel={msgStr('agricoopSending')}
          />
        </form>
        {!logoutConfirm.skipLink && client.baseUrl && (
          <BackLink href={client.baseUrl}>{msg('backToApplication')}</BackLink>
        )}
      </div>
    </Template>
  );
}

export function LoginPageExpired(props: Page<'login-page-expired.ftl'>) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { url } = kcContext;
  const { msg } = i18n;
  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      headerNode={msg('pageExpiredTitle')}
    >
      <Medallion icon={Clock} />
      <div id="instruction1" className="grid gap-3 text-sm text-muted-foreground">
        <p>
          {msg('pageExpiredMsg1')}{' '}
          <TextLink id="loginRestartLink" href={url.loginRestartFlowUrl}>
            {msg('doClickHere')}
          </TextLink>
        </p>
        <p>
          {msg('pageExpiredMsg2')}{' '}
          <TextLink id="loginContinueLink" href={url.loginAction}>
            {msg('doClickHere')}
          </TextLink>
        </p>
      </div>
    </Template>
  );
}

export function SelectAuthenticator(props: Page<'select-authenticator.ftl'>) {
  const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
  const { url, auth } = kcContext;
  const { msg, advancedMsg } = i18n;
  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={doUseDefaultCss}
      classes={classes}
      displayInfo={false}
      headerNode={msg('loginChooseAuthenticator')}
    >
      <form
        id="kc-select-credential-form"
        action={url.loginAction}
        method="post"
        className="grid gap-2"
      >
        {auth.authenticationSelections.map((selection, i) => (
          <button
            key={i}
            type="submit"
            name="authenticationExecution"
            value={selection.authExecId}
            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-start shadow-soft transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
              <KeyRound className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {advancedMsg(selection.displayName)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {advancedMsg(selection.helpText)}
              </span>
            </span>
          </button>
        ))}
      </form>
    </Template>
  );
}
