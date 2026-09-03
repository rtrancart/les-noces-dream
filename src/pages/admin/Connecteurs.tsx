import { BrevoConnectionPanel } from "@/components/admin/BrevoConnectionPanel";
import { CampagneInvitationsPanel } from "@/components/admin/CampagneInvitationsPanel";
import { MigratePhotosBatchPanel } from "@/components/admin/MigratePhotosBatchPanel";
import { PennylaneConnectionPanel } from "@/components/admin/PennylaneConnectionPanel";
import { PrerenderSnapshotsPanel } from "@/components/admin/PrerenderSnapshotsPanel";


export default function AdminConnecteurs() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-foreground">Connecteurs</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          Connexions et outils techniques externes (Brevo, Pennylane, migration photos).
        </p>
      </div>

      <BrevoConnectionPanel />

      <PennylaneConnectionPanel />

      <MigratePhotosBatchPanel />

      <PrerenderSnapshotsPanel />

      <CampagneInvitationsPanel />


    </div>
  );
}
