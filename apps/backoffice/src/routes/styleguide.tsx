/*
 * Living style guide of @agricoop/ui: every token and base component, in both themes and both
 * directions (theme toggle + language switcher at the top). Not in the navigation: open /styleguide.
 */
import {
  Badge,
  BrandMark,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Input,
  Label,
  Ornament,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  ThemeToggle,
  useDirection,
  ZelligeBackdrop,
} from '@agricoop/ui';
import { fadeUp, revealViewport, scaleIn, slideInFromStart, stagger } from '@agricoop/ui/motion';
import { COMMANDE_STATUTS, type CommandeStatut } from '@agricoop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { Eye, Flag, MoreHorizontal, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Money } from '@/components/common';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export const Route = createFileRoute('/styleguide')({ component: Styleguide });

const statutVariant: Record<
  CommandeStatut,
  'info' | 'warning' | 'default' | 'success' | 'secondary'
> = {
  creee: 'info',
  payee: 'warning',
  expediee: 'default',
  livree: 'success',
  annulee: 'secondary',
};

const SEMANTIC = [
  'background',
  'card',
  'muted',
  'secondary',
  'accent',
  'primary',
  'gold',
  'terracotta',
  'success',
  'warning',
  'info',
  'destructive',
] as const;

// Literal class names: Tailwind only generates classes it can read in the source.
const DISPLAY_SIZES = [
  ['display-2xl', 'text-display-2xl'],
  ['display-xl', 'text-display-xl'],
  ['display-lg', 'text-display-lg'],
  ['display-md', 'text-display-md'],
  ['display-sm', 'text-display-sm'],
] as const;

const SCALES = ['olive', 'gold', 'terracotta', 'sand'] as const;
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const SAMPLE_ROWS: { ref: string; ville: string; statut: CommandeStatut; montant: string }[] = [
  { ref: 'D2F00003', ville: 'Fès', statut: 'payee', montant: '220.00' },
  { ref: 'D2F00002', ville: 'Casablanca', statut: 'expediee', montant: '947.20' },
  { ref: 'D2F00001', ville: 'Fès', statut: 'livree', montant: '205.00' },
  { ref: '9A41C0DE', ville: 'Rabat', statut: 'creee', montant: '80.00' },
  { ref: '77B2E91F', ville: 'Tanger', statut: 'annulee', montant: '36.00' },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <motion.section
      id={id}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={revealViewport}
      className="scroll-mt-6 space-y-5"
    >
      <h2 className="font-display text-display-sm font-semibold">{title}</h2>
      {children}
    </motion.section>
  );
}

function Styleguide() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl space-y-14 pb-24">
      <header className="grain relative overflow-hidden rounded-2xl border bg-card px-6 py-10 shadow-soft sm:px-10">
        <ZelligeBackdrop />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <BrandMark className="size-8" />
              <span className="font-display text-lg font-semibold">AgriCoop</span>
            </div>
            <h1 className="font-display text-display-lg font-semibold">{t('styleguide.title')}</h1>
            <p className="max-w-xl text-muted-foreground">{t('styleguide.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle
              labels={{
                group: t('theme.group'),
                light: t('theme.light'),
                dark: t('theme.dark'),
                system: t('theme.system'),
              }}
            />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <Colors />
      <Typography />
      <Buttons />
      <Fields />
      <Badges />
      <Cards />
      <TabsAndTable />
      <Overlays />
      <MotionDemo />
      <Textures />
    </div>
  );
}

function Colors() {
  const { t } = useTranslation();
  return (
    <Section id="couleurs" title={t('styleguide.colors')}>
      <h3 className="text-sm font-medium text-muted-foreground">{t('styleguide.semantic')}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {SEMANTIC.map((name) => (
          <div key={name} className="overflow-hidden rounded-lg border bg-card shadow-soft">
            <div className="h-16 border-b" style={{ background: `var(--${name})` }} />
            <p className="px-3 py-2 font-mono text-xs">{name}</p>
          </div>
        ))}
      </div>
      <h3 className="pt-2 text-sm font-medium text-muted-foreground">{t('styleguide.scales')}</h3>
      <div className="space-y-2" dir="ltr">
        {SCALES.map((scale) => (
          <div key={scale} className="flex items-center gap-3">
            <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{scale}</span>
            <div className="grid flex-1 grid-cols-11 overflow-hidden rounded-md border">
              {STEPS.map((step) => (
                <div
                  key={step}
                  title={`${scale}-${step}`}
                  className="h-9"
                  style={{ background: `var(--color-${scale}-${step})` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Typography() {
  const { t } = useTranslation();
  return (
    <Section id="typographie" title={t('styleguide.typography')}>
      <Card>
        <CardContent className="space-y-6">
          {DISPLAY_SIZES.map(([name, className]) => (
            <div key={name} className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-baseline">
              <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                {name}
              </span>
              <p className={`font-display font-semibold ${className}`}>
                {t('styleguide.sampleHeadline')}
              </p>
            </div>
          ))}
          <Ornament className="py-2" />
          <div className="grid gap-6 md:grid-cols-2">
            <p className="text-lg leading-relaxed">{t('styleguide.sampleBody')}</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Manrope</span> — UI ·{' '}
                <span className="font-display font-semibold text-foreground">Fraunces</span> —
                display
              </p>
              <p lang="ar" dir="rtl" className="font-sans text-base text-foreground">
                IBM Plex Sans Arabic — زيت الزيتون البكر الممتاز
              </p>
              <p lang="ar" dir="rtl" className="font-display text-xl font-semibold text-foreground">
                Noto Kufi Arabic — تعاونية البركة
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}

function Buttons() {
  const { t } = useTranslation();
  return (
    <Section id="boutons" title={t('styleguide.buttons')}>
      <Card>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>{t('styleguide.primary')}</Button>
            <Button variant="gold">{t('styleguide.gold')}</Button>
            <Button variant="secondary">{t('styleguide.secondary')}</Button>
            <Button variant="outline">{t('styleguide.outline')}</Button>
            <Button variant="ghost">{t('styleguide.ghost')}</Button>
            <Button variant="destructive">{t('styleguide.danger')}</Button>
            <Button variant="link">{t('styleguide.link')}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xl" shape="pill" variant="gold">
              <ShoppingBag /> {t('styleguide.addToCart')}
            </Button>
            <Button size="lg" shape="pill">
              {t('styleguide.addToCart')}
            </Button>
            <Button size="sm" variant="outline">
              <Plus /> {t('styleguide.primary')}
            </Button>
            <Button size="xs" variant="secondary">
              {t('styleguide.secondary')}
            </Button>
            <Button size="icon" variant="outline" aria-label={t('styleguide.menu')}>
              <MoreHorizontal />
            </Button>
            <Button disabled>{t('styleguide.fieldDisabled')}</Button>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}

function Fields() {
  const { t } = useTranslation();
  const [actif, setActif] = useState(true);
  return (
    <Section id="champs" title={t('styleguide.fields')}>
      <Card>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="sg-nom">{t('styleguide.fieldName')}</Label>
            <Input id="sg-nom" placeholder="Huile d'olive vierge extra 1 L" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-prix">{t('styleguide.fieldPrice')}</Label>
            <Input id="sg-prix" defaultValue="0" aria-invalid dir="ltr" inputMode="decimal" />
            <p className="text-xs text-destructive">{t('styleguide.fieldInvalid')}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-notes">{t('styleguide.fieldNotes')}</Label>
            <Textarea id="sg-notes" />
          </div>
          <div className="grid content-start gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sg-off">{t('styleguide.fieldDisabled')}</Label>
              <Input id="sg-off" disabled defaultValue="HVE-1L" />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="sg-actif" checked={actif} onCheckedChange={setActif} />
              <Label htmlFor="sg-actif">{t('styleguide.switchLabel')}</Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}

function Badges() {
  const { t } = useTranslation();
  return (
    <Section id="badges" title={t('styleguide.badges')}>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {COMMANDE_STATUTS.map((s) => (
              <Badge key={s} variant={statutVariant[s]} dot>
                {t(`statut.${s}`)}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{t('famille.alimentaire')}</Badge>
            <Badge variant="gold">{t('famille.coffret')}</Badge>
            <Badge variant="terracotta">{t('famille.cosmetique')}</Badge>
            <Badge variant="outline">HVE-1L</Badge>
            <Badge variant="destructive" dot>
              {t('qrStatut.signale')}
            </Badge>
            <Badge variant="synthetic">{t('synthetic.badge')}</Badge>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}

function Cards() {
  const { t } = useTranslation();
  return (
    <Section id="cartes" title={t('styleguide.cards')}>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('styleguide.cardStatic')}</CardTitle>
            <CardDescription>{t('styleguide.cardStaticHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-display-sm font-semibold">
              <Money value="12480.50" />
            </p>
          </CardContent>
        </Card>
        <Card interactive tabIndex={0}>
          <CardHeader>
            <CardTitle>{t('styleguide.cardInteractive')}</CardTitle>
            <CardDescription>{t('styleguide.cardInteractiveHint')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="success" dot>
              {t('statut.livree')}
            </Badge>
            <Badge variant="synthetic">{t('synthetic.badge')}</Badge>
          </CardContent>
        </Card>
        <Card className="grain relative overflow-hidden">
          <ZelligeBackdrop />
          <CardHeader className="relative z-10">
            <CardTitle className="font-display text-xl">Coopérative Al Baraka</CardTitle>
            <CardDescription>Taounate</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <Ornament />
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}

function TabsAndTable() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  return (
    <Section id="tableau" title={`${t('styleguide.tabs')} · ${t('styleguide.table')}`}>
      <Tabs defaultValue="tous">
        <TabsList>
          <TabsTrigger value="tous">{t('lots.tous')}</TabsTrigger>
          <TabsTrigger value="payee">{t('statut.payee')}</TabsTrigger>
          <TabsTrigger value="expediee">{t('statut.expediee')}</TabsTrigger>
          <TabsTrigger value="livree">{t('statut.livree')}</TabsTrigger>
        </TabsList>
        <TabsContent value="tous">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex items-center justify-end border-b px-4 py-2">
              <Button size="sm" variant="ghost" onClick={() => setLoading((v) => !v)}>
                {t('styleguide.skeleton')}
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('commandes.ref')}</TableHead>
                  <TableHead>{t('commandes.ville')}</TableHead>
                  <TableHead>{t('commandes.statut')}</TableHead>
                  <TableHead className="text-end">{t('commandes.montant')}</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">{t('common.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 4 }, (_, i) => (
                      <TableRow key={i}>
                        {[16, 20, 14, 12, 4].map((w, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4" style={{ width: `${w * 4}px` }} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : SAMPLE_ROWS.map((r) => (
                      <TableRow key={r.ref}>
                        <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                        <TableCell>{r.ville}</TableCell>
                        <TableCell>
                          <Badge variant={statutVariant[r.statut]} dot>
                            {t(`statut.${r.statut}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          <Money value={r.montant} />
                        </TableCell>
                        <TableCell>
                          <RowMenu />
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        {(['payee', 'expediee', 'livree'] as const).map((s) => (
          <TabsContent key={s} value={s}>
            <Card>
              <CardContent className="flex items-center gap-3">
                <Badge variant={statutVariant[s]} dot>
                  {t(`statut.${s}`)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {SAMPLE_ROWS.filter((r) => r.statut === s).length}
                </span>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </Section>
  );
}

function RowMenu() {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={t('common.actions')}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <Eye /> {t('styleguide.menuView')}
          <DropdownMenuShortcut>⌘H</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Flag /> {t('styleguide.menuFlag')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <Trash2 /> {t('styleguide.menuDelete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Overlays() {
  const { t } = useTranslation();
  return (
    <Section id="superpositions" title={t('styleguide.overlays')}>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">{t('styleguide.openDialog')}</Button>
            </DialogTrigger>
            <DialogContent closeLabel={t('common.close')}>
              <DialogHeader>
                <DialogTitle>{t('styleguide.dialogTitle')}</DialogTitle>
                <DialogDescription>{t('styleguide.dialogText')}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="sg-lot">{t('lots.numero')}</Label>
                <Input id="sg-lot" placeholder="HVE-1L-2026-001" dir="ltr" />
              </div>
              <DialogFooter>
                <Button variant="outline">{t('common.cancel')}</Button>
                <Button>{t('common.save')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <SheetDemo side="end" label={t('styleguide.openSheet')} />
          <SheetDemo side="bottom" label={t('styleguide.openBottomSheet')} />
          <RowMenu />
        </CardContent>
        <CardContent className="flex flex-wrap items-center gap-3 border-t pt-6">
          <span className="text-sm font-medium text-muted-foreground">
            {t('styleguide.toasts')}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.success(t('styleguide.toastSuccess'))}
          >
            {t('styleguide.toastSuccess')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.error(t('styleguide.toastError'))}
          >
            {t('styleguide.toastError')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.info(t('styleguide.toastInfo'))}
          >
            {t('styleguide.toastInfo')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.warning(t('styleguide.toastWarning'))}
          >
            {t('styleguide.toastWarning')}
          </Button>
        </CardContent>
      </Card>
    </Section>
  );
}

function SheetDemo({ side, label }: { side: 'end' | 'bottom'; label: string }) {
  const { t } = useTranslation();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">{label}</Button>
      </SheetTrigger>
      <SheetContent side={side} closeLabel={t('common.close')}>
        <SheetHeader>
          <SheetTitle>{t('styleguide.sheetTitle')}</SheetTitle>
          <SheetDescription>{t('styleguide.sheetText')}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3">
          {['Huile d’olive vierge extra 1 L', 'Savon solide à l’huile d’olive 100 g'].map((nom) => (
            <div key={nom} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="arch h-14 w-11 shrink-0 bg-gradient-to-b from-gold-300 to-olive-600" />
              <p className="text-sm font-medium">{nom}</p>
            </div>
          ))}
        </div>
        <SheetFooter>
          <Button size="lg" shape="pill" variant="gold">
            {t('styleguide.checkout')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function MotionDemo() {
  const { t } = useTranslation();
  const dir = useDirection();
  const [run, setRun] = useState(0);
  return (
    <Section id="mouvement" title={t('styleguide.motion')}>
      <Card>
        <CardHeader>
          <CardDescription>{t('styleguide.motionHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button size="sm" variant="outline" onClick={() => setRun((n) => n + 1)}>
            {t('styleguide.replay')}
          </Button>
          <div key={run} className="grid gap-4 md:grid-cols-3" dir={dir}>
            <motion.ul
              variants={stagger(0.08)}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              <li className="font-mono text-xs text-muted-foreground" dir="ltr">
                stagger + fadeUp
              </li>
              {[1, 2, 3, 4].map((i) => (
                <motion.li
                  key={i}
                  variants={fadeUp}
                  className="h-8 rounded-md bg-gradient-to-r from-olive-200 to-olive-100 dark:from-olive-800 dark:to-olive-900"
                />
              ))}
            </motion.ul>
            <motion.ul
              variants={stagger(0.08)}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              <li className="font-mono text-xs text-muted-foreground" dir="ltr">
                slideInFromStart ({dir})
              </li>
              {[1, 2, 3, 4].map((i) => (
                <motion.li
                  key={i}
                  custom={dir}
                  variants={slideInFromStart}
                  className="h-8 rounded-md bg-gradient-to-r from-gold-200 to-gold-100 dark:from-gold-800 dark:to-gold-900"
                />
              ))}
            </motion.ul>
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                scaleIn
              </p>
              <motion.div
                variants={scaleIn}
                initial="hidden"
                animate="visible"
                className="grid h-[9.5rem] place-items-center rounded-lg bg-gradient-to-br from-terracotta-200 to-terracotta-100 dark:from-terracotta-800 dark:to-terracotta-900"
              >
                <BrandMark className="size-12 text-primary" />
              </motion.div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}

function Textures() {
  const { t } = useTranslation();
  return (
    <Section id="matieres" title={t('styleguide.textures')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <figure className="space-y-2">
          <div className="relative h-40 overflow-hidden rounded-lg border bg-card">
            <ZelligeBackdrop fade="none" />
          </div>
          <figcaption className="text-sm text-muted-foreground">
            {t('styleguide.zellige')}
          </figcaption>
        </figure>
        <figure className="space-y-2">
          <div className="grain h-40 rounded-lg border bg-gradient-to-br from-sand-100 to-sand-300 dark:from-sand-800 dark:to-sand-950" />
          <figcaption className="text-sm text-muted-foreground">{t('styleguide.grain')}</figcaption>
        </figure>
        <figure className="space-y-2">
          <div className="flex h-40 items-end justify-center rounded-lg border bg-card pt-4">
            <div className="arch h-full w-28 bg-gradient-to-b from-gold-300 via-olive-400 to-olive-700 shadow-lifted" />
          </div>
          <figcaption className="text-sm text-muted-foreground">{t('styleguide.arch')}</figcaption>
        </figure>
        <figure className="space-y-2">
          <div className="relative h-40 overflow-hidden rounded-lg border bg-gradient-to-br from-olive-500 via-gold-400 to-terracotta-400">
            <div className="glass absolute inset-x-4 top-4 flex h-12 items-center gap-2 rounded-xl border border-white/30 px-3">
              <BrandMark className="size-6 text-primary" />
              <span className="font-display font-semibold">AgriCoop</span>
            </div>
          </div>
          <figcaption className="text-sm text-muted-foreground">{t('styleguide.glass')}</figcaption>
        </figure>
      </div>
      <figure className="space-y-2 pt-2">
        <Ornament />
        <figcaption className="text-center text-sm text-muted-foreground">
          {t('styleguide.ornament')}
        </figcaption>
      </figure>
    </Section>
  );
}
