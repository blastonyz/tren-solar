"use client";

import { useState } from "react";
import { Bridge } from "./Bridge";
import { Catalog } from "./Catalog";
import { Experience } from "./Experience";
import { Impact } from "./Impact";
import { TripDrawer } from "./TripDrawer";
import { WhatsAppPanel } from "./WhatsAppPanel";
import { CatalogProvider } from "./catalog-context";
import { useAlerts, useTelemetry } from "./live";
import { TripProvider, useTrip } from "./trip";

function FloatingTrip({ onClick, hidden }: { onClick: () => void; hidden: boolean }) {
  const trip = useTrip();
  if (hidden || trip.count === 0) return null;
  return (
    <button
      onClick={onClick}
      className="fixed right-4 bottom-4 z-40 rounded-full bg-solar px-5 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-solar"
    >
      Mi viaje · {trip.count}
    </button>
  );
}

export function App() {
  const telemetry = useTelemetry();
  const alerts = useAlerts() ?? [];
  const [townId, setTownId] = useState<string | null>(null);
  const [tripOpen, setTripOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);

  return (
    <CatalogProvider>
      <TripProvider>
        <Experience
          telemetry={telemetry}
          alerts={alerts}
          townId={townId}
          onTownChange={setTownId}
          onOpenTrip={() => setTripOpen(true)}
          onOpenWhatsApp={() => setWaOpen(true)}
        />
        <Bridge />
        <Catalog alerts={alerts} townId={townId} onTownChange={setTownId} />
        <Impact />
        <TripDrawer open={tripOpen} onClose={() => setTripOpen(false)} onRequestOpen={() => setTripOpen(true)} alerts={alerts} />
        <WhatsAppPanel open={waOpen} onClose={() => setWaOpen(false)} alerts={alerts} defaultTownId={townId} />
        <FloatingTrip onClick={() => setTripOpen(true)} hidden={tripOpen || waOpen} />
      </TripProvider>
    </CatalogProvider>
  );
}
