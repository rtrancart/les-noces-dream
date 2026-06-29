import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import CategoryPicker from "@/components/CategoryPicker";
import LocationPicker, { type CitySearchData } from "@/components/LocationPicker";
import { useCategoryTree } from "@/hooks/useCategoryTree";

type Variant = "hero" | "header-desktop" | "header-mobile";

interface Props {
  variant?: Variant;
  onSubmit?: () => void;
}

export default function SearchBar({ variant = "hero", onSubmit }: Props) {
  const navigate = useNavigate();
  const { data: categoryTree = [] } = useCategoryTree();
  const [categorySlugs, setCategorySlugs] = useState<string[]>([]);
  const [locationZones, setLocationZones] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState<CitySearchData | null>(null);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (categorySlugs.length > 0) params.set("categorie", categorySlugs.join(","));
    if (citySearch) {
      params.set(
        "ville",
        `${citySearch.lat},${citySearch.lng},${citySearch.radius},${encodeURIComponent(citySearch.label)}`
      );
    } else if (locationZones.length > 0) {
      params.set("lieu", locationZones.join(","));
    }
    onSubmit?.();
    navigate(params.size ? `/recherche?${params.toString()}` : "/recherche");
  };

  if (variant === "hero") {
    return (
      <div className="bg-card rounded-md shadow-elevated flex flex-col sm:flex-row items-stretch gap-0 p-3 w-full max-w-[768px]">
        <div className="flex items-center flex-1 border-b sm:border-b-0 sm:border-r border-border pr-0 sm:pr-3 pb-3 sm:pb-0 h-14">
          <CategoryPicker
            categories={categoryTree}
            value={categorySlugs}
            onChange={setCategorySlugs}
            placeholder="Quelle catégorie ?"
          />
        </div>
        <div className="flex items-center flex-1 h-14 px-0 sm:px-2 pt-3 sm:pt-0">
          <LocationPicker
            value={locationZones}
            onChange={setLocationZones}
            citySearch={citySearch}
            onCitySearchChange={setCitySearch}
            placeholder="Où ?"
          />
        </div>
        <Button
          onClick={handleSearch}
          className="h-14 px-8 shrink-0 text-base font-medium mt-3 sm:mt-0"
        >
          Rechercher
        </Button>
      </div>
    );
  }

  if (variant === "header-mobile") {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center bg-white border border-[hsl(var(--header-or-fonce)/0.3)] rounded-md h-12 px-3">
          <CategoryPicker
            categories={categoryTree}
            value={categorySlugs}
            onChange={setCategorySlugs}
            placeholder="Quelle catégorie ?"
          />
        </div>
        <div className="flex items-center bg-white border border-[hsl(var(--header-or-fonce)/0.3)] rounded-md h-12 px-3">
          <LocationPicker
            value={locationZones}
            onChange={setLocationZones}
            citySearch={citySearch}
            onCitySearchChange={setCitySearch}
            placeholder="Où ?"
          />
        </div>
        <Button
          onClick={handleSearch}
          className="bg-[hsl(var(--header-or-fonce))] hover:bg-[hsl(var(--header-or-to))] text-white gap-2 h-11"
        >
          <Search className="w-4 h-4" />
          Rechercher
        </Button>
      </div>
    );
  }

  // header-desktop
  return (
    <div className="bg-card rounded-md shadow-sm flex flex-col md:flex-row items-stretch gap-0 p-2 w-full max-w-[820px] mx-auto">
      <div className="flex items-center flex-1 border-b md:border-b-0 md:border-r border-border pr-0 md:pr-3 pb-2 md:pb-0 h-12">
        <CategoryPicker
          categories={categoryTree}
          value={categorySlugs}
          onChange={setCategorySlugs}
          placeholder="Quelle catégorie ?"
        />
      </div>
      <div className="flex items-center flex-1 h-12 px-0 md:px-2 pt-2 md:pt-0">
        <LocationPicker
          value={locationZones}
          onChange={setLocationZones}
          citySearch={citySearch}
          onCitySearchChange={setCitySearch}
          placeholder="Où ?"
        />
      </div>
      <Button
        onClick={handleSearch}
        className="h-12 px-6 shrink-0 text-sm font-medium mt-2 md:mt-0 bg-[hsl(var(--header-or-fonce))] hover:bg-[hsl(var(--header-or-to))] text-white gap-2"
      >
        <Search className="w-4 h-4" />
        Rechercher
      </Button>
    </div>
  );
}
