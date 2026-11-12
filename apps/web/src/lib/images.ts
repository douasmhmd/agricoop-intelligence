/*
 * Storefront imagery: placeholder photographs from Unsplash (Unsplash License: free to use, no
 * attribution required — we still credit Unsplash in the footer). Served by images.unsplash.com
 * (allowed in the CSP), resized on the fly. <Picture> falls back to a branded gradient when an
 * image cannot load. Products have no photo in the API yet, so they get one per category.
 */
export const PHOTOS = {
  grove: '1785440944109-4021897d9e13', // olive grove, stone wall, blue sky
  harvest: '1753703986291-6f95a7f299ba', // hands sorting harvested olives
  branch: '1758818710855-b60cf3b74de6', // olive branch against the sky
  leaves: '1758641283518-59ade23743ae', // olive branch close-up
  huile: '1474979266404-7eaacbcd87c5', // olive oil cruet with olives
  huileAlt: '1552592074-ea7a91b851b3', // oil dispenser bottle
  olives: '1727176401986-6289c5121eef', // green olives on a plate
  olivesAlt: '1698775942613-3e9fc114b2a1', // pile of green olives
  savon: '1618840152526-92682643af2d', // white soap bars with leaves
  savonAlt: '1584305574647-0cc949a2bb9f', // green olive soap tied with twine
  coffret: '1764509195128-e2f389ac3235', // ornate metal box
  infusion: '1715016813310-3536d991cdce', // dried olive leaves
  soin: '1763503834047-ac85c4105c0b', // jar of cream
  capillaire: '1600634999627-c52556dff978', // oil dropper bottle
} as const;

export type PhotoKey = keyof typeof PHOTOS;

const WIDTHS = [400, 640, 960, 1280, 1600, 2000] as const;

export function photoUrl(key: PhotoKey, width: number, quality = 72): string {
  return `https://images.unsplash.com/photo-${PHOTOS[key]}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

/** Props for <Picture>: responsive srcset, a tiny blurred placeholder and a sensible default. */
export function photo(key: PhotoKey, sizes: string, maxWidth = 1600) {
  const widths = WIDTHS.filter((w) => w <= maxWidth);
  return {
    src: photoUrl(key, widths.at(-1) ?? maxWidth),
    srcSet: widths.map((w) => `${photoUrl(key, w)} ${w}w`).join(', '),
    sizes,
    placeholder: `https://images.unsplash.com/photo-${PHOTOS[key]}?auto=format&fit=crop&w=32&q=30&blur=60`,
  };
}

/** Photos per category; several products of one category alternate between them. */
const CATEGORY_PHOTOS: Record<string, PhotoKey[]> = {
  huile: ['huile', 'huileAlt'],
  olives_table: ['olives', 'olivesAlt'],
  savon: ['savon', 'savonAlt'],
  infusion: ['infusion'],
  soin: ['soin'],
  capillaire: ['capillaire'],
  coffret: ['coffret'],
};

/**
 * Category of a catalogue product → its illustrative photo. `variant` (e.g. the product's rank
 * among the products of the same category on the page) alternates between the category's photos.
 */
export function productPhoto(categorie: string, famille: string, variant = 0): PhotoKey {
  const options =
    CATEGORY_PHOTOS[categorie] ??
    (famille === 'cosmetique' ? ['soin'] : famille === 'coffret' ? ['coffret'] : ['olivesAlt']);
  return options[Math.abs(variant) % options.length]!;
}
