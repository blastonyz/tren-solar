import type { Category } from "@/lib/types";

const PALETTE: Record<Category, { sky: [string, string]; far: string; mid: string; near: string }> = {
  excursion: { sky: ["#f6c177", "#e08a4b"], far: "#b5523b", mid: "#7e3a2f", near: "#3b1f1c" },
  lodging: { sky: ["#9ec5d8", "#d9e4dd"], far: "#7c9aa6", mid: "#566f7a", near: "#2c3b43" },
  product: { sky: ["#f2c46d", "#e9a23b"], far: "#c2762f", mid: "#8a4d22", near: "#42260f" },
  food: { sky: ["#f0a98c", "#d96c4f"], far: "#a8452f", mid: "#6e2c20", near: "#34140f" },
  culture: { sky: ["#c9b3e3", "#8f74b8"], far: "#6c5494", mid: "#463566", near: "#241a38" },
  transport: { sky: ["#ffd98a", "#f5a83c"], far: "#c97b2a", mid: "#8a4f1c", near: "#2e1a0b" },
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Ilustración de la Quebrada para las ofertas sin foto: capas de cerros, distintas por oferta. */
export function CardArt({ id, category, image }: { id: string; category: Category; image?: string }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />;
  }
  const c = PALETTE[category];
  const h = hash(id);
  const p = (shift: number, range: number) => 10 + ((h >>> shift) % range);
  const far = `0,70 ${p(0, 30)},${p(3, 22)} ${40 + p(5, 20)},${p(7, 24) + 20} ${70 + p(9, 18)},${p(11, 22)} 200,${p(13, 20) + 25} 200,100 0,100`;
  const mid = `0,85 ${p(2, 40)},${p(4, 18) + 40} ${60 + p(6, 20)},${p(8, 18) + 50} 200,${p(10, 18) + 35} 200,100 0,100`;
  const near = `0,100 0,${p(12, 12) + 78} ${50 + p(14, 30)},${p(16, 10) + 84} 200,${p(18, 12) + 76} 200,100`;
  const gid = `sky-${id}`;
  return (
    <svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" aria-hidden className="h-full w-full transition duration-500 group-hover:scale-105">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.sky[0]} />
          <stop offset="1" stopColor={c.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="200" height="100" fill={`url(#${gid})`} />
      <circle cx={30 + (h % 140)} cy={26} r="9" fill="#fff6dc" opacity="0.85" />
      <polygon points={far} fill={c.far} />
      <polygon points={mid} fill={c.mid} />
      <polygon points={near} fill={c.near} />
    </svg>
  );
}
