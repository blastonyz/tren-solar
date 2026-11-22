"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import { ShaderChunk, Vector3, type Vector3Tuple } from "three";
import { TOWNS } from "@/lib/route";
import type { Alert, Telemetry } from "@/lib/types";
import { Hud } from "./Hud";
import { RouteBar } from "./RouteBar";
import { StationPanel } from "./StationPanel";
import { useTrip } from "./trip";

// three r181+ eliminó este chunk. El suelo proyectado de drei igual lo incluye,
// y el include que no resuelve tira en cada frame.
const chunks = ShaderChunk as Record<string, string>;
if (!chunks.cube_uv_reflection_fragment) {
  chunks.cube_uv_reflection_fragment = "";
}

const MODEL_URL = "/models/mesh.glb";
const STATION_URL = "/models/estacion_volcan.glb";
const DRACO_DECODER = "/draco/";

const SCENES = [
  { id: "sunrise", label: "Amanecer", file: "/hdri/klippad_sunrise_2_2k.hdr" },
  { id: "canyon", label: "Cañón", file: "/hdri/valley_of_desolation_2k.hdr" },
  { id: "dusk", label: "Atardecer", file: "/hdri/toposcope_sunset_2k.hdr" },
  { id: "pan", label: "Salinas", file: "/hdri/aarfontein_pan_2k.hdr" },
] as const;

/**
 * El GLB ya tiene el techo en +Y y el largo en Z. El giro de -90° en X lo dejaba parado.
 * El grupo exterior lo acuesta 90° sobre Z, con el techo hacia arriba y el largo en X.
 */
function Train() {
  const { scene } = useGLTF(MODEL_URL, DRACO_DECODER, true);
  const scale = 14;
  return (
    <group rotation={[0, 0, -Math.PI / 2]}>
      <group rotation={[0, Math.PI / 2, 0]} scale={scale}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL, DRACO_DECODER, true);

/**
 * Estación "Volcán" (Blender, Z arriba). La fachada mira hacia las vías y el andén queda
 * del lado +Z; el giro de 180° en Y lo pasa al fondo para que la fachada mire a la cámara inicial.
 */
function Station() {
  const { scene } = useGLTF(STATION_URL, DRACO_DECODER, true);
  return <primitive object={scene} rotation={[0, Math.PI, 0]} />;
}

useGLTF.preload(STATION_URL, DRACO_DECODER, true);

function Loader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/70">
      <p className="text-sm tracking-[0.3em] text-arena/80 uppercase">
        Cargando escena · {Math.round(progress)}%
      </p>
    </div>
  );
}

type SceneId = (typeof SCENES)[number]["id"];

/** Ambiente que acompaña a cada estación. El visitante puede cambiarlo con los botones. */
const STATION_SCENE: Record<string, SceneId> = {
  volcan: "sunrise",
  purmamarca: "canyon",
  maimara: "pan",
  tilcara: "dusk",
  uquia: "sunrise",
  humahuaca: "canyon",
};

interface CameraGoal {
  position: Vector3Tuple;
  target: Vector3Tuple;
}

const HOME_GOAL: CameraGoal = { position: [11, 3.2, 15], target: [0, 1.6, 0] };

/** Cada estación mira el tren desde un ángulo distinto; el objetivo corrido deja lugar al panel. */
function goalForStation(index: number): CameraGoal {
  const angle = -0.85 + index * 0.34;
  const radius = 14 + (index % 2) * 3;
  const height = 2.4 + (index % 3) * 0.8;
  return {
    position: [Math.sin(angle) * radius, height, Math.cos(angle) * radius],
    target: [2.2, 1.6, 0],
  };
}

/** Lleva la cámara a un objetivo con suavidad y suelta el control apenas el visitante la toca. */
function CameraRig({ goal }: { goal: CameraGoal }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as {
    target: Vector3;
    update: () => void;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  } | null;
  const goalPosition = useMemo(() => new Vector3(...goal.position), [goal]);
  const goalTarget = useMemo(() => new Vector3(...goal.target), [goal]);
  const done = useRef(false);

  useEffect(() => {
    done.current = false;
  }, [goal]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      done.current = true;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame((_, delta) => {
    if (done.current || !controls) return;
    const k = 1 - Math.exp(-delta * 2.4);
    camera.position.lerp(goalPosition, k);
    controls.target.lerp(goalTarget, k);
    controls.update();
    if (camera.position.distanceTo(goalPosition) < 0.05 && controls.target.distanceTo(goalTarget) < 0.05) {
      done.current = true;
    }
  });
  return null;
}

function TripButton({ onClick }: { onClick: () => void }) {
  const trip = useTrip();
  return (
    <button
      onClick={onClick}
      className="pointer-events-auto rounded-full border border-solar/60 bg-solar/15 px-4 py-2 text-sm text-amber-50 backdrop-blur transition hover:bg-solar/25"
    >
      Mi viaje{trip.count > 0 ? ` · ${trip.count}` : ""}
    </button>
  );
}

interface ExperienceProps {
  telemetry: Telemetry | null;
  alerts: Alert[];
  townId: string | null;
  onTownChange: (townId: string | null) => void;
  onOpenTrip: () => void;
  onOpenWhatsApp: () => void;
}

export function Experience({ telemetry, alerts, townId, onTownChange, onOpenTrip, onOpenWhatsApp }: ExperienceProps) {
  const [sceneId, setSceneId] = useState<SceneId>("sunrise");
  const [started, setStarted] = useState(false);

  const current = SCENES.find((s) => s.id === sceneId) ?? SCENES[0];
  const goal = useMemo(() => {
    if (!townId) return HOME_GOAL;
    return goalForStation(Math.max(0, TOWNS.findIndex((t) => t.id === townId)));
  }, [townId]);

  const selectTown = (id: string) => {
    onTownChange(id);
    setSceneId(STATION_SCENE[id] ?? "sunrise");
  };
  const topAlert = alerts[0];

  return (
    <main className="relative h-svh w-full overflow-hidden">
      <Canvas className="absolute inset-0" camera={{ position: HOME_GOAL.position, fov: 38 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Environment key={current.id} files={current.file} background ground={{ height: 5, radius: 90, scale: 90 }} />
          <group position={[0, 0.2, 0]}>
            <Train />
            <Station />
          </group>
          <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={30} blur={2.4} far={6} />
        </Suspense>
        <OrbitControls
          makeDefault
          target={HOME_GOAL.target}
          enablePan={false}
          enableZoom={false}
          autoRotate={!townId}
          autoRotateSpeed={0.45}
          minDistance={9}
          maxDistance={32}
          maxPolarAngle={Math.PI / 2 - 0.03}
        />
        <CameraRig goal={goal} />
      </Canvas>

      <Loader />

      {/* Velos para que el texto se lea sobre ambientes claros */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-44 bg-gradient-to-b from-black/70 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute top-0 left-0 z-[5] h-80 w-[44rem] max-w-full bg-[radial-gradient(ellipse_at_top_left,rgba(0,0,0,0.7),transparent_72%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-48 bg-gradient-to-t from-black/50 to-transparent" />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-3 p-4 sm:p-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.35em] text-arena uppercase [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">Quebrada de Humahuaca · Jujuy</p>
            <h1 className={`mt-2 font-bold tracking-tight text-white transition-all [text-shadow:0_2px_4px_rgba(0,0,0,0.75),0_6px_28px_rgba(0,0,0,0.7)] ${started ? "text-3xl sm:text-4xl" : "text-5xl sm:text-7xl"}`}>
              Jujuy <span className="text-solar">Pay</span>
            </h1>
            <p className="mt-1 text-sm font-medium tracking-wide text-arena [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">en el Tren Solar de la Quebrada</p>
            {!started && (
              <p className="mt-2 max-w-md text-sm text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)] sm:text-base">
                Turismo y economías regionales del NOA, medidos en tiempo real.
              </p>
            )}
            {started && topAlert && (
              <p className="mt-2 inline-block max-w-md rounded-full border border-solar/30 bg-amber-400/10 px-3 py-1 text-xs text-arena">
                {alerts.length} {alerts.length === 1 ? "alerta vigente" : "alertas vigentes"} · {topAlert.message}
              </p>
            )}
          </div>
          {started && (
            <div className="flex gap-2">
              <button
                onClick={onOpenWhatsApp}
                className="pointer-events-auto rounded-full border border-white/25 bg-black/30 px-4 py-2 text-sm text-white/85 backdrop-blur transition hover:border-white/50"
              >
                Avisos
              </button>
              <TripButton onClick={onOpenTrip} />
            </div>
          )}
        </header>

        {started && townId && (
          <div className="pointer-events-none absolute top-24 right-4 bottom-44 flex w-[calc(100%-2rem)] max-w-md sm:top-28 sm:right-8 sm:bottom-48">
            <StationPanel key={townId} townId={townId} alerts={alerts} telemetry={telemetry} onClose={() => onTownChange(null)} />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <nav className="pointer-events-auto flex flex-wrap gap-2">
              {SCENES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSceneId(s.id)}
                  className={`rounded-full border px-4 py-1.5 text-xs backdrop-blur transition ${
                    s.id === sceneId
                      ? "border-solar/80 bg-solar/20 text-amber-50"
                      : "border-white/20 bg-black/30 text-white/70 hover:border-white/50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
            {!started && (
              <div className="pointer-events-auto flex flex-col items-end gap-3">
                <button
                  onClick={() => {
                    setStarted(true);
                    selectTown("volcan");
                  }}
                  className="rounded-full bg-solar px-7 py-3 text-sm font-semibold text-black shadow-[0_0_30px_rgba(251,191,36,0.35)] transition hover:bg-solar"
                >
                  Empezar viaje
                </button>
                <Hud telemetry={telemetry} />
              </div>
            )}
          </div>
          <a
            href="#catalogo"
            className="pointer-events-auto self-center rounded-full border border-white/25 bg-black/35 px-4 py-1.5 text-xs text-white/85 backdrop-blur transition hover:border-white/50"
          >
            Ver todas las ofertas ↓
          </a>
          {started && <RouteBar selectedId={townId} onSelect={selectTown} telemetry={telemetry} alerts={alerts} />}
        </div>
      </div>

    </main>
  );
}
