import type { Championship } from "@/lib/storage";

interface ChampionBeltOverlayProps {
  championships: Championship[];
  size?: "sm" | "md" | "lg";
}

export function ChampionBeltOverlay({ championships, size = "md" }: ChampionBeltOverlayProps) {
  if (!championships.length) return null;

  const maxBelts = size === "sm" ? 1 : 2;
  const belts = championships.slice(0, maxBelts);

  const beltWidth = size === "sm" ? "56%" : size === "md" ? "52%" : "54%";

  const positions = [
    { bottom: "4%",  right: "3%",  rotate: -20, zIndex: 8 },
    { bottom: "16%", right: "12%", rotate: -17, zIndex: 7 },
  ] as const;

  return (
    <>
      {belts.map((c, i) => {
        const pos = positions[i];
        return (
          <div
            key={c.id}
            className="absolute pointer-events-none select-none"
            style={{
              bottom: pos.bottom,
              right: pos.right,
              width: beltWidth,
              zIndex: pos.zIndex,
              transform: `rotate(${pos.rotate}deg)`,
              filter:
                "drop-shadow(0 2px 6px rgba(0,0,0,0.95)) drop-shadow(0 0 14px rgba(0,0,0,0.7))",
            }}
          >
            {c.imageUrl ? (
              <img
                src={c.imageUrl}
                alt={c.name}
                className="w-full h-auto object-contain"
                draggable={false}
              />
            ) : (
              <div
                className="px-1.5 py-0.5 text-[7px] font-bold tracking-wider uppercase leading-none text-center whitespace-nowrap rounded-sm"
                style={{
                  background:
                    "linear-gradient(135deg, #b8962e 0%, #f0c53a 50%, #b8962e 100%)",
                  color: "#1a0e00",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.9)",
                }}
              >
                {c.name
                  .replace(/championship/i, "")
                  .replace(/title/i, "")
                  .trim()
                  .slice(0, 14)}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
