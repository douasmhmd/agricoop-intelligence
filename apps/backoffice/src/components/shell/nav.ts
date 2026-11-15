import {
  Boxes,
  Building2,
  ChartColumn,
  ChartLine,
  LayoutDashboard,
  type LucideIcon,
  Package,
  QrCode,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/auth/session';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

/** The back-office navigation, grouped; shared by the sidebar and the command palette. */
export function useNavGroups(): NavGroup[] {
  const { t } = useTranslation();
  const session = useSession();
  const groups: NavGroup[] = [
    {
      key: 'pilotage',
      label: t('nav.groups.pilotage'),
      items: [
        { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
        { to: '/analyses', label: t('nav.analyses'), icon: ChartColumn },
        { to: '/previsions', label: t('nav.previsions'), icon: ChartLine },
      ],
    },
    {
      key: 'catalogue',
      label: t('nav.groups.catalogue'),
      items: [
        { to: '/produits', label: t('nav.produits'), icon: Package },
        { to: '/lots', label: t('nav.lots'), icon: Boxes },
        { to: '/stock/alertes', label: t('nav.alertes'), icon: TriangleAlert },
      ],
    },
    {
      key: 'ventes',
      label: t('nav.groups.ventes'),
      items: [{ to: '/commandes', label: t('nav.commandes'), icon: ShoppingCart }],
    },
    {
      key: 'tracabilite',
      label: t('nav.groups.tracabilite'),
      items: [{ to: '/qr', label: t('nav.qr'), icon: QrCode }],
    },
  ];
  if (session?.isAdmin) {
    groups.push({
      key: 'plateforme',
      label: t('nav.groups.plateforme'),
      items: [{ to: '/admin/cooperatives', label: t('nav.admin'), icon: Building2 }],
    });
  }
  return groups;
}

/** Breadcrumb trail for a pathname: [label, link?] from the dashboard to the current page. */
export function useBreadcrumbs(pathname: string): { label: string; to?: string }[] {
  const { t } = useTranslation();
  const home = { label: t('nav.dashboard'), to: '/' };
  if (pathname === '/') return [{ label: t('nav.dashboard') }];
  const sections: [prefix: string, label: string, child?: string][] = [
    ['/produits', t('nav.produits')],
    ['/lots', t('nav.lots'), t('nav.lot')],
    ['/stock/alertes', t('nav.alertes')],
    ['/commandes', t('nav.commandes'), t('nav.commande')],
    ['/qr', t('nav.qr')],
    ['/analyses', t('nav.analyses')],
    ['/previsions', t('nav.previsions')],
    ['/admin/cooperatives', t('nav.admin')],
    ['/styleguide', t('nav.styleguide')],
  ];
  const match = sections.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!match) return [home];
  const [prefix, label, child] = match;
  return pathname === prefix || !child
    ? [home, { label }]
    : [home, { label, to: prefix }, { label: child }];
}
