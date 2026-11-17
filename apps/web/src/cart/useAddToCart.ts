import type { ProduitCatalogue } from '@agricoop/shared';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCart } from '@/cart/cart';
import { useCartDrawer } from '@/cart/drawer-context';
import { useFlyToCart } from '@/cart/fly';

/**
 * Adds a product to the cart the same way everywhere (cards, product page): one cooperative per
 * cart (asks before replacing), the thumbnail flies to the cart icon, and the toast's action opens
 * the cart drawer.
 */
export function useAddToCart() {
  const { t } = useTranslation();
  const cart = useCart();
  const drawer = useCartDrawer();
  const fly = useFlyToCart();

  return (
    produit: ProduitCatalogue,
    coop: { code: string; nom: string },
    quantite: number,
    origin?: { element: Element | null; image: string },
  ): boolean => {
    const item = {
      produit_id: produit.produit_id,
      code: produit.code,
      nom: produit.nom,
      prix_mad: produit.prix_mad,
      disponible: produit.disponible,
      categorie: produit.categorie,
      famille: produit.famille,
    };
    if (cart.add(coop, item, quantite) === 'other_coop') {
      // One order = one cooperative: offer to start a new cart.
      if (!window.confirm(t('cart.otherCoop', { coop: cart.cart.coopNom ?? '' }))) return false;
      cart.add(coop, item, quantite, { replace: true });
    }
    if (origin) fly(origin.element, origin.image);
    toast.success(t('cart.added', { nom: produit.nom }), {
      action: { label: t('cart.view'), onClick: () => drawer.setOpen(true) },
    });
    return true;
  };
}
