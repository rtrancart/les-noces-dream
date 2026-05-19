/**
 * ChartePendingGuard
 *
 * Historiquement, ce composant forçait la redirection vers /pro/charte tant
 * que la charte n'était pas signée. Dans le modèle définitif des statuts,
 * la signature de la charte est **non bloquante** : le prestataire peut
 * compléter et soumettre sa fiche sans avoir signé la charte. La publication
 * effective (passage en `actif`) reste conditionnée à la signature, mais
 * l'accès à l'espace pro ne l'est plus.
 *
 * Le guard est conservé comme passe-plat pour ne pas casser l'arbre de
 * routes existant. Le rappel visuel de signature se fait via les bandeaux
 * (ProviderInfoBanner, WelcomeBanner).
 */
export default function ChartePendingGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
