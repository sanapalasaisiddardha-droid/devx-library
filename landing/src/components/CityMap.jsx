import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MapControls, Text, Html } from "@react-three/drei";
import { CITY, EXTENT, GRID, PITCH, BLOCK } from "../lib/city";
import { books } from "../data/books";

/**
 * The DevX world — a stylized low-poly city (white blocks, glowing book
 * buildings, parks) rendered with react-three-fiber. Pan / zoom / orbit via
 * MapControls; the camera flies to a book when picked in the sidebar.
 */

const PURPLE = "#a06bff";
const LIME = "#c3ef3e";
const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

/* ---------- instanced plain buildings ---------- */
function WhiteBuildings() {
  const ref = useRef();
  useLayoutEffect(() => {
    CITY.whites.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.scale.set(b.w, b.h, b.w);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
      // subtle warm-white variance so the city doesn't look flat
      const v = 0.92 + ((i * 37) % 13) / 13 * 0.08;
      ref.current.setColorAt(i, tmpColor.setRGB(v, v, v * 0.985));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[null, null, CITY.whites.length]} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial roughness={0.85} metalness={0} />
    </instancedMesh>
  );
}

/* ---------- instanced trees (trunks + crowns) ---------- */
function Trees() {
  const trunks = useRef();
  const crowns = useRef();
  useLayoutEffect(() => {
    CITY.trees.forEach((t, i) => {
      dummy.position.set(t.x, 0.3 * t.s, t.z);
      dummy.scale.set(0.14 * t.s, 0.6 * t.s, 0.14 * t.s);
      dummy.updateMatrix();
      trunks.current.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, (0.6 + 0.55) * t.s, t.z);
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      crowns.current.setMatrixAt(i, dummy.matrix);
      const g = 0.55 + ((i * 29) % 10) / 10 * 0.2;
      crowns.current.setColorAt(i, tmpColor.setRGB(0.42 * g + 0.25, 0.62 * g + 0.28, 0.3 * g + 0.16));
    });
    trunks.current.instanceMatrix.needsUpdate = true;
    crowns.current.instanceMatrix.needsUpdate = true;
    if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={trunks} args={[null, null, CITY.trees.length]} castShadow>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#8a7357" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[null, null, CITY.trees.length]} castShadow>
        <icosahedronGeometry args={[0.62, 0]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

/* ---------- one glowing book building ---------- */
function BookBuilding({ spot, onOpen, onHover }) {
  const mesh = useRef();
  const [hover, setHover] = useState(false);
  const base = spot.featured ? LIME : PURPLE;

  useFrame((_, dt) => {
    if (!mesh.current) return;
    const target = hover ? 1.09 : 1;
    mesh.current.scale.x += (spot.w * target - mesh.current.scale.x) * Math.min(1, dt * 9);
    mesh.current.scale.z = mesh.current.scale.x;
    mesh.current.scale.y += (spot.h * target - mesh.current.scale.y) * Math.min(1, dt * 9);
    mesh.current.material.emissiveIntensity += ((hover ? 0.85 : 0.42) - mesh.current.material.emissiveIntensity) * Math.min(1, dt * 8);
  });

  return (
    <mesh
      ref={mesh}
      position={[spot.x, spot.h / 2, spot.z]}
      scale={[spot.w, spot.h, spot.w]}
      castShadow
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); onHover(spot); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); onHover(null); document.body.style.cursor = ""; }}
      onClick={(e) => { e.stopPropagation(); onOpen(spot.book, spot); }}
    >
      <boxGeometry />
      <meshStandardMaterial
        color={base}
        emissive={base}
        emissiveIntensity={0.42}
        transparent
        opacity={0.92}
        roughness={0.35}
      />
      {hover && (
        <Html position={[0, 0.75, 0]} center zIndexRange={[50, 40]} style={{ pointerEvents: "none" }}>
          <div className="flex w-52 items-center gap-2.5 rounded-xl border border-white/10 bg-[#15131f]/95 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
            <img src={spot.book.cover} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide" style={{ color: base }}>
                {spot.book.category}
              </p>
              <p className="line-clamp-2 text-xs font-semibold leading-snug text-white">{spot.book.title}</p>
              <p className="mt-0.5 text-[10px] text-white/50">Click to read</p>
            </div>
          </div>
        </Html>
      )}
    </mesh>
  );
}

/* ---------- streets: glowing lines between blocks ---------- */
function Streets() {
  const lines = useMemo(() => {
    const arr = [];
    for (let k = 0; k <= GRID; k++) {
      const off = (k - GRID / 2) * PITCH;
      arr.push({ x: off, z: 0, w: 0.22, l: GRID * PITCH + 6, rot: 0 });
      arr.push({ x: 0, z: off, w: 0.22, l: GRID * PITCH + 6, rot: Math.PI / 2 });
    }
    return arr;
  }, []);
  return (
    <group>
      {lines.map((s, i) => (
        <mesh key={i} position={[s.x, 0.02, s.z]} rotation={[-Math.PI / 2, 0, s.rot]}>
          <planeGeometry args={[s.w, s.l]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- camera flight (intro + fly-to-book) ---------- */
function Flight({ flyTo, onArrived }) {
  const { camera, controls } = useThree();
  const goal = useRef(null); // {pos: V3, look: V3, cb}

  // intro: fly from way out to the last-read book (or centre)
  useEffect(() => {
    let look = new THREE.Vector3(0, 2, 0);
    const last = Number(localStorage.getItem("siddlib.lastBook"));
    const spot = CITY.bookSpots.find((s) => s.book.id === last);
    if (spot) look = new THREE.Vector3(spot.x, spot.h / 2, spot.z);
    camera.position.set(look.x + 120, 160, look.z + 170);
    goal.current = { pos: new THREE.Vector3(look.x + 26, 34, look.z + 42), look, cb: null };
  }, [camera]);

  // sidebar-driven flight
  useEffect(() => {
    if (!flyTo) return;
    const spot = CITY.bookSpots.find((s) => s.book.id === flyTo.book.id);
    if (!spot) { onArrived?.(flyTo.book); return; }
    const look = new THREE.Vector3(spot.x, spot.h / 2, spot.z);
    goal.current = {
      pos: new THREE.Vector3(spot.x + 10, 14, spot.z + 16),
      look,
      cb: flyTo.open ? () => onArrived?.(flyTo.book) : null,
    };
  }, [flyTo, onArrived]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    controls.enabled = false;
    const k = 1 - Math.exp(-3.2 * dt);
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.look, k);
    controls.update();
    if (camera.position.distanceTo(g.pos) < 0.35) {
      controls.enabled = true;
      const cb = g.cb;
      goal.current = null;
      cb && cb();
    }
  });
  return null;
}

/* ---------- scene ---------- */
function Scene({ onOpen, flyTo, onArrived, onHover }) {
  return (
    <>
      <color attach="background" args={["#edeae2"]} />
      <fog attach="fog" args={["#edeae2", 110, 300]} />

      <hemisphereLight intensity={0.75} color="#ffffff" groundColor="#cfcabb" />
      <directionalLight
        position={[45, 90, 25]}
        intensity={1.35}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-bias={-0.0004}
      />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#e6e3da" roughness={1} />
      </mesh>

      {/* block plinths */}
      {CITY.parks.map((p, i) => (
        <mesh key={`park${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.015, p.z]} receiveShadow>
          <planeGeometry args={[BLOCK, BLOCK]} />
          <meshStandardMaterial color="#9cbf78" roughness={1} />
        </mesh>
      ))}

      <Streets />
      <WhiteBuildings />
      <Trees />

      {CITY.bookSpots.map((s) => (
        <BookBuilding key={s.book.id} spot={s} onOpen={onOpen} onHover={onHover} />
      ))}

      {/* district names, flat on the ground like map labels */}
      {CITY.labels.map((l) => (
        <Text
          key={l.name}
          position={[l.x, 0.06, l.z + BLOCK * 0.72]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={1.5}
          letterSpacing={0.12}
          color="#8f8a7c"
          anchorX="center"
          anchorY="middle"
        >
          {l.name.toUpperCase()}
        </Text>
      ))}

      <MapControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={10}
        maxDistance={180}
        minPolarAngle={0.3}
        maxPolarAngle={1.18}
        maxTargetRadius={EXTENT + 25}
      />
      <Flight flyTo={flyTo} onArrived={onArrived} />
    </>
  );
}

export default function CityMap({ onOpenBook, flyTo, onArrived }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 40, near: 0.5, far: 700, position: [120, 160, 170] }}
        gl={{ antialias: true }}
      >
        <Scene
          onOpen={(book, spot) => onOpenBook(book, spot)}
          flyTo={flyTo}
          onArrived={onArrived}
          onHover={setHovered}
        />
      </Canvas>

      {/* bottom hint */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-medium text-black/60 backdrop-blur-md">
        {hovered ? hovered.book.title : "Drag to pan · Scroll to zoom · Glowing buildings are books"}
      </div>
    </div>
  );
}
