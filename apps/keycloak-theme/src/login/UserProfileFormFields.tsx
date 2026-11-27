/*
 * Keycloak user-profile fields (registration, profile update, IdP review, e-mail update), rendered
 * with the design system's floating inputs. Validation (Keycloak validators, password policy,
 * server errors, password confirmation) comes from Keycloakify's useUserProfileForm; only the
 * rendering is ours. Field names are the attribute names Keycloak expects.
 */
import { cn, FloatingInput } from '@agricoop/ui';
import type { Attribute } from 'keycloakify/login/KcContext';
import { useUserProfileForm } from 'keycloakify/login/lib/useUserProfileForm';
import type { UserProfileFormFieldsProps } from 'keycloakify/login/UserProfileFormFieldsProps';
import { useEffect } from 'react';
import type { I18n } from './i18n';
import type { KcContext } from './KcContext';

/** HTML input type for a user-profile `inputType` annotation. */
function htmlType(attribute: Attribute): string {
  if (attribute.name === 'password' || attribute.name === 'password-confirm') return 'password';
  const inputType = attribute.annotations.inputType;
  if (inputType?.startsWith('html5-')) return inputType.slice('html5-'.length);
  if (attribute.name === 'email') return 'email';
  return 'text';
}

/** Identifiers, e-mails and passwords are typed left-to-right even on Arabic pages. */
const LTR = new Set(['username', 'email', 'password', 'password-confirm']);

export default function UserProfileFormFields(props: UserProfileFormFieldsProps<KcContext, I18n>) {
  const { kcContext, i18n, onIsFormSubmittableValueChange, doMakeUserConfirmPassword } = props;
  const { advancedMsg, advancedMsgStr, msgStr } = i18n;
  const {
    formState: { formFieldStates, isFormSubmittable },
    dispatchFormAction,
  } = useUserProfileForm({ kcContext, i18n, doMakeUserConfirmPassword });

  useEffect(() => {
    onIsFormSubmittableValueChange(isFormSubmittable);
  }, [isFormSubmittable, onIsFormSubmittableValueChange]);

  return (
    <div className="grid gap-4">
      {formFieldStates.map(({ attribute, displayableErrors, valueOrValues }) => {
        const value = typeof valueOrValues === 'string' ? valueOrValues : (valueOrValues[0] ?? '');
        if (attribute.annotations.inputType === 'hidden') {
          return <input key={attribute.name} type="hidden" name={attribute.name} value={value} />;
        }
        if (attribute.name === 'password-confirm' && !doMakeUserConfirmPassword) return null;

        const label = `${advancedMsgStr(attribute.displayName ?? attribute.name)}${attribute.required ? ' *' : ''}`;
        const error =
          displayableErrors.length > 0 ? (
            <span id={`input-error-${attribute.name}`}>
              {displayableErrors.map((e, i) => (
                <span key={i} className="block">
                  {e.errorMessage}
                </span>
              ))}
            </span>
          ) : undefined;
        const helper =
          attribute.annotations.inputHelperTextAfter ?? attribute.annotations.inputHelperTextBefore;
        const update = (next: string) =>
          dispatchFormAction({ action: 'update', name: attribute.name, valueOrValues: next });
        const blur = () =>
          dispatchFormAction({ action: 'focus lost', name: attribute.name, fieldIndex: undefined });

        // Choice lists (not used by the AgriCoop realm today): a styled native select.
        if (attribute.annotations.inputType === 'select' && attribute.validators.options) {
          return (
            <label key={attribute.name} className="grid gap-1.5 text-sm">
              <span className="font-medium">{label}</span>
              <select
                id={attribute.name}
                name={attribute.name}
                value={value}
                onChange={(e) => update(e.target.value)}
                onBlur={blur}
                aria-invalid={error ? true : undefined}
                className={cn(
                  'h-12 rounded-lg border border-input bg-card px-3 text-base shadow-soft',
                  'focus-visible:border-ring focus-visible:outline-none aria-invalid:border-destructive',
                )}
              >
                <option value="" />
                {attribute.validators.options.options.map((option) => (
                  <option key={option} value={option}>
                    {advancedMsgStr(option)}
                  </option>
                ))}
              </select>
              {error && <span className="text-sm text-destructive">{error}</span>}
            </label>
          );
        }

        const isPassword = htmlType(attribute) === 'password';
        return (
          <FloatingInput
            key={attribute.name}
            id={attribute.name}
            name={attribute.name}
            type={htmlType(attribute)}
            label={label}
            value={value}
            onChange={(e) => update(e.target.value)}
            onBlur={blur}
            autoComplete={attribute.autocomplete}
            disabled={attribute.readOnly}
            required={attribute.required}
            dir={LTR.has(attribute.name) ? 'ltr' : undefined}
            error={error}
            hint={helper ? advancedMsg(helper) : undefined}
            {...(isPassword
              ? {
                  toggleLabels: {
                    show: msgStr('agricoopShowPassword'),
                    hide: msgStr('agricoopHidePassword'),
                  },
                  capsLockMessage: msgStr('agricoopCapsLock'),
                }
              : {})}
          />
        );
      })}
    </div>
  );
}
