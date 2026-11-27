import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@agricoop/ui';
import { CartProvider, cartOps, EMPTY_CART } from '@/cart/cart';
import '@/i18n';
import ar from '@/i18n/locales/ar.json';
import fr from '@/i18n/locales/fr.json';
import { routeTree } from '@/routeTree.gen';

// Anonymous visitor: the storefront and the verification page work without signing in.
vi.mock('react-oidc-context', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: undefined,
    signinRedirect: vi.fn(),
  }),
}));

/* -------------------------------------------------------------------------------------------- */

describe('cart', () => {
  const coopA = { code: 'COOPA', nom: 'A' };
  const huile = { produit_id: 'p1', code: 'HVE', nom: 'Huile', prix_mad: '75.00', disponible: 3 };
  const savon = { produit_id: 'p2', code: 'SAV', nom: 'Savon', prix_mad: '19.99', disponible: 10 };

  it('adds, merges lines and caps at the available stock', () => {
    let { cart } = cartOps.add(EMPTY_CART, coopA, huile, 2);
    ({ cart } = cartOps.add(cart, coopA, huile, 5));
    ({ cart } = cartOps.add(cart, coopA, savon, 3));
    expect(cart.lines.map((l) => [l.code, l.quantite])).toEqual([
      ['HVE', 3],
      ['SAV', 3],
    ]);
    expect(cartOps.count(cart)).toBe(6);
    expect(cartOps.total(cart)).toBe('284.97'); // 3 × 75.00 + 3 × 19.99, no float error
  });

  it('keeps one cooperative per cart', () => {
    const { cart } = cartOps.add(EMPTY_CART, coopA, huile, 1);
    const other = cartOps.add(cart, { code: 'COOPB', nom: 'B' }, savon, 1);
    expect(other.result).toBe('other_coop');
    expect(other.cart).toBe(cart);
  });

  it('removes a line at quantity 0 and resets when empty', () => {
    const { cart } = cartOps.add(EMPTY_CART, coopA, huile, 1);
    expect(cartOps.setQuantity(cart, 'p1', 0)).toEqual(EMPTY_CART);
  });
});

/* -------------------------------------------------------------------------------------------- */

const srcDir = join(__dirname, '..', 'src');
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === 'generated' || name === 'ui' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.gen.ts') ? [path] : [];
  });
}
function has(dict: unknown, key: string): boolean {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return false;
    const obj = node as Record<string, unknown>;
    node = part in obj ? obj[part] : (obj[`${part}_one`] ?? obj[`${part}_other`]);
    if (node === undefined) return false;
  }
  return true;
}

describe('translations', () => {
  const used = new Set<string>();
  const prefixes = new Set<string>();
  for (const file of sourceFiles(srcDir)) {
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1]!);
    for (const m of code.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g)) prefixes.add(m[1]!);
  }
  it.each([
    ['fr', fr],
    ['ar', ar],
  ])('%s defines every key used in the code', (_lang, dict) => {
    expect(used.size).toBeGreaterThan(50);
    expect([...used].filter((k) => !has(dict, k))).toEqual([]);
    expect([...prefixes].filter((p) => !has(dict, p))).toEqual([]);
  });
});

/* -------------------------------------------------------------------------------------------- */

const verification = {
  resultat: 'authentique',
  alertes: [],
  statut_qr: 'actif',
  niveau: 'unite',
  produit: { nom: "Huile d'olive vierge extra 5 L", famille: 'alimentaire', categorie: 'huile' },
  cooperative: { code: 'COOP01', nom: 'Coopérative Zitoun', province: 'Ouezzane' },
  lot: { numero: 'HVE-5L-001', date_fabrication: '2026-01-01', date_peremption: '2027-06-01' },
  numero_serie: 7,
  nb_scans: 1,
};

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CartProvider>
          <RouterProvider router={router} />
        </CartProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('verification page /v/:token', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': status < 300 ? 'application/json' : 'application/problem+json' },
      }),
    );

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows "Authentique" with the product details, and records exactly one scan', async () => {
    respond(200, verification);
    renderAt('/v/AAAAAAAAAAAAAAAAAAAAAA');
    expect(await screen.findByText('Authentique ✓', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText("Huile d'olive vierge extra 5 L")).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    const verifyCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/qr/v1/verify/'),
    );
    expect(verifyCalls).toHaveLength(1);
    expect(String(verifyCalls[0]![0])).toBe('/qr/v1/verify/AAAAAAAAAAAAAAAAAAAAAA');
  });

  it('shows "Attention" with every alert explained', async () => {
    respond(200, {
      ...verification,
      resultat: 'alerte',
      alertes: ['villes_multiples', 'lot_perime'],
    });
    renderAt('/v/AAAAAAAAAAAAAAAAAAAAAA');
    expect(await screen.findByText('Attention ⚠')).toBeInTheDocument();
    expect(screen.getByText(/plusieurs villes/)).toBeInTheDocument();
    expect(screen.getByText(/péremption de ce lot est dépassée/)).toBeInTheDocument();
  });

  it('warns about possible counterfeits for unknown codes', async () => {
    respond(404, {
      type: 'urn:agricoop:problem:qr_inconnu',
      title: 'Unknown QR code',
      status: 404,
      code: 'qr_inconnu',
    });
    renderAt('/v/BBBBBBBBBBBBBBBBBBBBBB');
    expect(await screen.findByText('Code inconnu ⚠')).toBeInTheDocument();
    expect(screen.getByText(/contrefaçon/)).toBeInTheDocument();
  });
});
