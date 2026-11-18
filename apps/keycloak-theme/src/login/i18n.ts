import { i18nBuilder } from 'keycloakify/login';
import type { ThemeName } from '../kc.gen';

/*
 * Keycloak's messages, with our own strings (agricoop*) and a few rewordings so the tone matches
 * the storefront and the back office. Every key exists in fr, ar and en.
 */
const { useI18n, ofTypeI18n: _ofTypeI18n } = i18nBuilder
  .withThemeName<ThemeName>()
  .withCustomTranslations({
    fr: {
      agricoopEyebrow: 'Coopératives oléicoles du Maroc',
      agricoopTagline: "L'or vert des collines, de la coopérative à votre table",
      agricoopTaglineSub: "Un seul compte pour la boutique et l'espace coopérative.",
      agricoopSecure: 'Connexion sécurisée',
      agricoopShowPassword: 'Afficher le mot de passe',
      agricoopHidePassword: 'Masquer le mot de passe',
      agricoopCapsLock: 'La touche Verr. Maj est activée',
      agricoopSigningIn: 'Connexion…',
      agricoopLanguage: 'Langue',
      agricoopThemeLight: 'Clair',
      agricoopThemeDark: 'Sombre',
      agricoopThemeSystem: 'Système',
      agricoopTheme: 'Thème',
      // Rewordings
      loginAccountTitle: 'Connexion à votre compte',
      doLogIn: 'Se connecter',
      usernameOrEmail: 'Identifiant ou e-mail',
      noAccount: 'Pas encore de compte ?',
      doRegister: 'Créer un compte',
      invalidUserMessage: 'Identifiant ou mot de passe incorrect.',
    },
    ar: {
      agricoopEyebrow: 'تعاونيات الزيتون في المغرب',
      agricoopTagline: 'الذهب الأخضر للتلال، من التعاونية إلى مائدتك',
      agricoopTaglineSub: 'حساب واحد للمتجر ولفضاء التعاونية.',
      agricoopSecure: 'اتصال آمن',
      agricoopShowPassword: 'إظهار كلمة المرور',
      agricoopHidePassword: 'إخفاء كلمة المرور',
      agricoopCapsLock: 'مفتاح الأحرف الكبيرة مفعّل',
      agricoopSigningIn: 'جارٍ تسجيل الدخول…',
      agricoopLanguage: 'اللغة',
      agricoopThemeLight: 'فاتح',
      agricoopThemeDark: 'داكن',
      agricoopThemeSystem: 'النظام',
      agricoopTheme: 'المظهر',
      loginAccountTitle: 'تسجيل الدخول إلى حسابك',
      doLogIn: 'تسجيل الدخول',
      usernameOrEmail: 'اسم المستخدم أو البريد الإلكتروني',
      noAccount: 'ليس لديك حساب بعد؟',
      doRegister: 'إنشاء حساب',
      invalidUserMessage: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    },
    en: {
      agricoopEyebrow: 'Olive cooperatives of Morocco',
      agricoopTagline: 'Green gold from the hills, from the cooperative to your table',
      agricoopTaglineSub: 'One account for the shop and the cooperative workspace.',
      agricoopSecure: 'Secure sign-in',
      agricoopShowPassword: 'Show password',
      agricoopHidePassword: 'Hide password',
      agricoopCapsLock: 'Caps Lock is on',
      agricoopSigningIn: 'Signing in…',
      agricoopLanguage: 'Language',
      agricoopThemeLight: 'Light',
      agricoopThemeDark: 'Dark',
      agricoopThemeSystem: 'System',
      agricoopTheme: 'Theme',
      loginAccountTitle: 'Sign in to your account',
      doLogIn: 'Sign in',
      usernameOrEmail: 'Username or email',
      noAccount: 'No account yet?',
      doRegister: 'Create an account',
      invalidUserMessage: 'Invalid username or password.',
    },
  })
  .build();

type I18n = typeof _ofTypeI18n;

export { type I18n, useI18n };
