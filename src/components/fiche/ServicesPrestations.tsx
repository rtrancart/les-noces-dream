import { Check, Minus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { FieldGroup, Field } from "@/lib/servicesPrestations";

interface ServicesPrestationsProps {
  groups: FieldGroup[];
  onDevis?: () => void;
  previewMode?: boolean;
}

function BooleanRow({ field }: { field: Field }) {
  const isYes = field.value === true;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-2.5",
        !isYes && "text-muted-foreground",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
            isYes ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {isYes ? (
            <Check className="h-3 w-3" strokeWidth={2.5} />
          ) : (
            <Minus className="h-3 w-3" strokeWidth={2.5} />
          )}
        </div>
        <span className="font-sans text-sm leading-snug">{field.label}</span>
      </div>
      {!isYes && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Non
        </span>
      )}
    </div>
  );
}

function SelectRow({ field }: { field: Field }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2.5 last:border-b-0">
      <span className="font-sans text-[13px] text-muted-foreground">{field.label}</span>
      <span className="break-words text-right font-sans text-sm font-medium text-foreground">
        {String(field.value)}
      </span>
    </div>
  );
}

function MultiRow({ field }: { field: Field }) {
  const items = Array.isArray(field.value) ? (field.value as string[]) : [];
  if (items.length === 0) return null;
  return (
    <div className="py-2.5">
      <p className="font-sans text-[13px] text-muted-foreground mb-2">{field.label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-secondary/60 px-3 py-1.5 font-sans text-xs text-foreground"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function TextRow({ field }: { field: Field }) {
  return (
    <div className="py-2.5">
      <p className="font-sans text-[13px] text-muted-foreground mb-1">{field.label}</p>
      <p className="whitespace-pre-line break-words font-sans text-sm leading-relaxed text-foreground">
        {String(field.value)}
      </p>
    </div>
  );
}

function FieldRenderer({ field }: { field: Field }) {
  switch (field.type) {
    case "boolean":
      return <BooleanRow field={field} />;
    case "select":
      return <SelectRow field={field} />;
    case "multi":
      return <MultiRow field={field} />;
    default:
      return <TextRow field={field} />;
  }
}

function GroupHeader({
  group,
  expanded,
  onToggle,
}: {
  group: FieldGroup;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const Icon = group.icon;
  return (
    <div
      className={cn(
        "flex min-h-[52px] items-center gap-3 px-4 py-3",
        onToggle && "cursor-pointer",
      )}
      onClick={onToggle}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-foreground">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      <span className="flex-1 font-sans text-base font-medium text-foreground">
        {group.title}
      </span>
      {group.summary && (
        <span className="hidden max-w-[45%] truncate font-sans text-xs text-muted-foreground sm:block">
          {group.summary}
        </span>
      )}
      {onToggle && (
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      )}
    </div>
  );
}

function GroupContent({ group }: { group: FieldGroup }) {
  return (
    <div className="space-y-1 px-4 pb-4">
      {group.fields.map((field) => (
        <FieldRenderer key={field.key} field={field} />
      ))}
    </div>
  );
}

function MobileAccordion({ groups }: { groups: FieldGroup[] }) {
  return (
    <Accordion type="multiple" defaultValue={[groups[0]?.id]} className="w-full md:hidden">
      {groups.map((group) => {
        const Icon = group.icon;
        return (
          <AccordionItem
            key={group.id}
            value={group.id}
            className="rounded-xl border border-border bg-card shadow-soft overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
              <div className="flex flex-1 items-center gap-3 text-left">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-foreground">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <span className="font-sans text-base font-medium text-foreground">
                  {group.title}
                </span>
              </div>
              {group.summary && (
                <span className="mr-3 hidden max-w-[40%] truncate font-sans text-xs text-muted-foreground sm:inline">
                  {group.summary}
                </span>
              )}
            </AccordionTrigger>
            <AccordionContent className="pb-0 pt-0">
              <GroupContent group={group} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function DesktopSections({ groups }: { groups: FieldGroup[] }) {
  return (
    <div className="hidden md:grid md:grid-cols-2 md:gap-4">
      {groups.map((group) => (
        <div
          key={group.id}
          className="rounded-xl border border-border bg-card p-4 shadow-soft"
        >
          <GroupHeader group={group} />
          <div className="mt-2 border-t border-border/60 pt-2">
            <GroupContent group={group} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ServicesPrestations({
  groups,
  onDevis,
  previewMode = false,
}: ServicesPrestationsProps) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-xl font-semibold text-foreground">
        Services & Prestations
      </h2>

      <MobileAccordion groups={groups} />
      <DesktopSections groups={groups} />

      {!previewMode && onDevis && (
        <div className="space-y-2 pt-2">
          <Button
            onClick={onDevis}
            className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Demander un devis
          </Button>
          <p className="text-center font-sans text-[11px] text-muted-foreground">
            Réponse habituelle sous 24 h
          </p>
        </div>
      )}
    </div>
  );
}
