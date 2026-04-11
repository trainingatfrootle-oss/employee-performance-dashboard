interface PersonalityPentagonProps {
  traitLabels: string[];
  scores: number[];
}

// Fixed trait order and their dedicated colors
const TRAIT_CONFIG: {
  key: string;
  label: string;
  color: string;
  low: string;
  high: string;
}[] = [
  {
    key: "Introverted ↔ Extroverted",
    label: "Introverted ↔ Extroverted",
    color: "#6366f1", // indigo
    low: "Introverted",
    high: "Extroverted",
  },
  {
    key: "Calm ↔ Emotionally reactive",
    label: "Calm ↔ Emotionally reactive",
    color: "#0ea5e9", // sky blue
    low: "Calm",
    high: "Emotionally Reactive",
  },
  {
    key: "Risk-averse ↔ Risk-taker",
    label: "Risk-averse ↔ Risk-taker",
    color: "#f59e0b", // amber
    low: "Risk-Averse",
    high: "Risk-Taker",
  },
  {
    key: "Organized ↔ Spontaneous",
    label: "Organized ↔ Spontaneous",
    color: "#10b981", // emerald
    low: "Organized",
    high: "Spontaneous",
  },
  {
    key: "Self-doubting ↔ Confident",
    label: "Self-doubting ↔ Confident",
    color: "#f43f5e", // rose
    low: "Self-Doubting",
    high: "Confident",
  },
];

function resolveConfig(label: string) {
  const exact = TRAIT_CONFIG.find(
    (t) => t.key.toLowerCase() === label.toLowerCase(),
  );
  if (exact) return exact;
  return (
    TRAIT_CONFIG.find((t) =>
      label.toLowerCase().includes(t.key.split("↔")[0].trim().toLowerCase()),
    ) ?? TRAIT_CONFIG[0]
  );
}

function getTraitResult(cfg: (typeof TRAIT_CONFIG)[0], score: number): string {
  if (score < 3) return cfg.low;
  if (score === 3) return "Neutral";
  return cfg.high;
}

export function PersonalityPentagon({
  traitLabels,
  scores,
}: PersonalityPentagonProps) {
  const cx = 160;
  const cy = 160;
  const maxR = 100;
  const outerR = 110;
  const n = 5;

  const angles = Array.from(
    { length: n },
    (_, i) => ((-90 + i * 72) * Math.PI) / 180,
  );

  function point(r: number, idx: number): [number, number] {
    return [cx + r * Math.cos(angles[idx]), cy + r * Math.sin(angles[idx])];
  }

  function polygonPoints(radius: number) {
    return angles.map((_, i) => point(radius, i).join(",")).join(" ");
  }

  const configs = traitLabels.map(resolveConfig);

  // Score polygon
  const scorePoints = scores
    .map((s, i) => point((Math.min(Math.max(s, 0), 5) / 5) * maxR, i).join(","))
    .join(" ");

  const levels = [1, 2, 3, 4, 5];
  const labelR = outerR + 32;

  return (
    <div className="flex flex-col items-center w-full">
      <svg
        width="340"
        height="340"
        viewBox="0 0 340 340"
        className="overflow-visible"
        role="img"
        aria-label="Personality pentagon chart"
      >
        <title>Personality Analysis Pentagon Chart</title>

        {/* Outer border pentagon */}
        <polygon
          points={polygonPoints(outerR)}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="2"
        />

        {/* Inner concentric level rings */}
        {levels.slice(0, 4).map((level) => (
          <polygon
            key={`level-${level}`}
            points={polygonPoints((level / 5) * maxR)}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="0.75"
            opacity="0.4"
            strokeDasharray="3 3"
          />
        ))}

        {/* Colored axis lines — one per trait */}
        {angles.map((_, axisIdx) => {
          const [x, y] = point(outerR, axisIdx);
          const color = configs[axisIdx]?.color ?? "#94a3b8";
          return (
            <line
              key={`axis-${angles[axisIdx]?.toFixed(3) ?? axisIdx}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke={color}
              strokeWidth="1.5"
              opacity="0.5"
            />
          );
        })}

        {/* Score polygon — gradient fill using defs */}
        <defs>
          <radialGradient id="pentagonFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.08" />
          </radialGradient>
        </defs>
        <polygon
          points={scorePoints}
          fill="url(#pentagonFill)"
          stroke="#6366f1"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Colored score dots per trait */}
        {scores.map((s, dotIdx) => {
          const [x, y] = point(
            (Math.min(Math.max(s, 0), 5) / 5) * maxR,
            dotIdx,
          );
          const color = configs[dotIdx]?.color ?? "#6366f1";
          return (
            <circle
              key={`dot-${traitLabels[dotIdx] ?? dotIdx}`}
              cx={x}
              cy={y}
              r="6"
              fill={color}
              stroke="white"
              strokeWidth="2"
            />
          );
        })}

        {/* Labels at each vertex */}
        {traitLabels.map((label, labelIdx) => {
          const [lx, ly] = point(labelR, labelIdx);
          const score = scores[labelIdx] ?? 0;
          const cfg = configs[labelIdx];
          const result = getTraitResult(cfg, score);
          let anchor: "start" | "middle" | "end" = "middle";
          if (lx < cx - 20) anchor = "end";
          else if (lx > cx + 20) anchor = "start";

          const parts = label.split("↔").map((p) => p.trim());
          const shortLabel =
            parts.length === 2 ? `${parts[0]} ↔ ${parts[1]}` : label;

          return (
            <g key={`label-${traitLabels[labelIdx] ?? labelIdx}`}>
              <text
                x={lx}
                y={ly - 6}
                textAnchor={anchor}
                fontSize="8.5"
                fill="hsl(var(--muted-foreground))"
                className="select-none"
              >
                {shortLabel}
              </text>
              <text
                x={lx}
                y={ly + 7}
                textAnchor={anchor}
                fontSize="9.5"
                fontWeight="700"
                fill={cfg.color}
                className="select-none"
              >
                {score}/5 — {result}
              </text>
            </g>
          );
        })}

        {/* Center label */}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize="9"
          fill="hsl(var(--muted-foreground))"
          opacity="0.5"
          className="select-none"
        >
          Score
        </text>
      </svg>

      {/* Per-trait legend */}
      <div className="mt-3 w-full max-w-sm border rounded-lg p-3 bg-muted/30">
        <p className="text-xs font-semibold text-muted-foreground mb-2 text-center tracking-wide uppercase">
          Personality Traits
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {TRAIT_CONFIG.map((t) => (
            <div key={t.key} className="flex items-center gap-2">
              {/* Color swatch */}
              <span
                className="flex-shrink-0 inline-block w-3 h-3 rounded-full border-2 border-white shadow-sm"
                style={{ background: t.color }}
              />
              {/* Trait label */}
              <span className="text-xs text-foreground font-medium">
                {t.low}
              </span>
              <span className="text-xs text-muted-foreground mx-0.5">↔</span>
              <span className="text-xs text-foreground font-medium">
                {t.high}
              </span>
            </div>
          ))}
        </div>
        {/* Score scale hint */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t text-[10px] text-muted-foreground">
          <span>1–2 = Left trait</span>
          <span>3 = Neutral</span>
          <span>4–5 = Right trait</span>
        </div>
      </div>
    </div>
  );
}
