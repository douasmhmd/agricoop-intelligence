import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Authenticity } from '@/home/Authenticity';
import { Categories } from '@/home/Categories';
import { CoopHighlights } from '@/home/CoopHighlights';
import { Featured } from '@/home/Featured';
import { Hero } from '@/home/Hero';
import { Newsletter } from '@/home/Newsletter';
import { Story } from '@/home/Story';
import { useHomeData } from '@/home/useHomeData';
import { selectFeatured, summarizeGroupes } from '@/lib/home';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const { coopsQuery, coops, produits, summaries, cataloguesPending } = useHomeData();
  const featured = useMemo(() => selectFeatured(produits), [produits]);
  const groupes = useMemo(() => summarizeGroupes(produits), [produits]);
  const provinces = useMemo(() => new Set(coops.map((c) => c.province)).size, [coops]);

  return (
    <>
      <Hero />
      {/* Below the fold: the browser skips their style, layout and paint until they near the
          viewport (content-visibility), which keeps the first paint fast on phones. */}
      <div className="defer-render">
        <Story coops={coops.length} produits={produits.length} provinces={provinces} />
        <Featured produits={featured} pending={coopsQuery.isPending || cataloguesPending} />
        <Categories groupes={groupes} />
        <Authenticity />
        <CoopHighlights
          summaries={summaries}
          pending={coopsQuery.isPending}
          error={coopsQuery.error}
        />
        <Newsletter />
      </div>
    </>
  );
}
