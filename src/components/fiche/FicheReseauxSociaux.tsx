import { RESEAUX, RESEAU_LABELS, libelleLienSocial, type ReseauSocial } from "@/lib/socialLinks";
import { TikTokIcon, PinterestIcon, InstagramIcon, FacebookIcon } from "@/components/icons/SocialIcons";

const ICONS: Record<ReseauSocial, (p: { className?: string }) => JSX.Element> = {
  tiktok: (p) => <TikTokIcon className={p.className} />,
  instagram: (p) => <InstagramIcon className={p.className} />,
  facebook: (p) => <FacebookIcon className={p.className} />,
  pinterest: (p) => <PinterestIcon className={p.className} />,
};

interface Props {
  liens: Partial<Record<ReseauSocial, string | null>>;
  nom: string;
}

/** Icônes monochromes, uniquement pour les liens réellement renseignés. */
export default function FicheReseauxSociaux({ liens, nom }: Props) {
  const presents = RESEAUX.filter((r) => !!liens[r]);
  if (presents.length === 0) return null;

  return (
    <div>
      <h3 className="font-sans text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
        Retrouvez-nous
      </h3>
      <div className="flex flex-wrap gap-2">
        {presents.map((r) => {
          const url = liens[r] as string;
          const Icon = ICONS[r];
          return (
            <a
              key={r}
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              title={`${nom} sur ${RESEAU_LABELS[r]} — ${libelleLienSocial(r, url)}`}
              aria-label={`${nom} sur ${RESEAU_LABELS[r]}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-or-riche hover:text-or-riche"
            >
              <Icon className="h-[18px] w-[18px]" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
