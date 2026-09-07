import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  normaliserLienSocial,
  RESEAU_LABELS,
  RESEAU_PLACEHOLDERS,
  type ReseauSocial,
} from "@/lib/socialLinks";
import { TikTokIcon, PinterestIcon, InstagramIcon, FacebookIcon } from "@/components/icons/SocialIcons";

const ICONS: Record<ReseauSocial, (p: { className?: string }) => JSX.Element> = {
  tiktok: (p) => <TikTokIcon className={p.className} />,
  instagram: (p) => <InstagramIcon className={p.className} />,
  facebook: (p) => <FacebookIcon className={p.className} />,
  pinterest: (p) => <PinterestIcon className={p.className} />,
};

interface Props {
  reseau: ReseauSocial;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Champ réseau social : saisie libre, normalisation au blur uniquement
 * (transformer à la frappe casserait le collage et la position du curseur).
 */
export default function SocialLinkInput({ reseau, value, onChange, disabled }: Props) {
  const [error, setError] = useState<string | null>(null);
  const Icon = ICONS[reseau];

  const handleBlur = () => {
    const result = normaliserLienSocial(reseau, value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onChange(result.value ?? "");
  };

  return (
    <div className="space-y-2">
      <Label className="font-sans text-sm flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {RESEAU_LABELS[reseau]}
      </Label>
      <Input
        type="text"
        inputMode="url"
        maxLength={255}
        disabled={disabled}
        placeholder={RESEAU_PLACEHOLDERS[reseau]}
        value={value}
        onChange={(e) => {
          if (error) setError(null);
          onChange(e.target.value);
        }}
        onBlur={handleBlur}
        className={cn(error && "border-destructive focus-visible:ring-destructive")}
        aria-invalid={!!error}
      />
      {error && <p className="font-sans text-xs text-destructive">{error}</p>}
    </div>
  );
}
