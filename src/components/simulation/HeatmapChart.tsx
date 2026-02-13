import { useMemo } from "react";

interface HeatmapChartProps {
  x: number[];
  y: number[];
  z: number[][];
  xLabel: string;
  yLabel: string;
  title: string;
}

export function HeatmapChart({
  x,
  y,
  z,
  xLabel,
  yLabel,
  title,
}: HeatmapChartProps) {
  const { cells, maxZ, minZ } = useMemo(() => {
    let maxZ = -Infinity;
    let minZ = Infinity;
    const cells: { x: number; y: number; z: number; xIdx: number; yIdx: number }[] = [];

    z.forEach((row, yIdx) => {
      row.forEach((value, xIdx) => {
        cells.push({ x: x[xIdx], y: y[yIdx], z: value, xIdx, yIdx });
        if (value > maxZ) maxZ = value;
        if (value < minZ) minZ = value;
      });
    });

    return { cells, maxZ, minZ };
  }, [x, y, z]);

  const getColor = (value: number) => {
    const range = maxZ - minZ || 1;
    const normalized = (value - minZ) / range;
    // Cyan gradient
    const hue = 185;
    const saturation = 80;
    const lightness = 20 + normalized * 40;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const cellWidth = 100 / x.length;
  const cellHeight = 100 / y.length;

  return (
    <div className="panel p-4">
      <h3 className="panel-header mb-4 -mx-4 -mt-4 rounded-t-lg">{title}</h3>
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative aspect-square">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              {cells.map((cell, i) => (
                <rect
                  key={i}
                  x={cell.xIdx * cellWidth}
                  y={(y.length - 1 - cell.yIdx) * cellHeight}
                  width={cellWidth}
                  height={cellHeight}
                  fill={getColor(cell.z)}
                  stroke="hsl(220, 15%, 15%)"
                  strokeWidth={0.2}
                >
                  <title>
                    {xLabel}: {cell.x.toFixed(2)}, {yLabel}: {cell.y.toFixed(2)}, U_real: {cell.z.toFixed(4)}
                  </title>
                </rect>
              ))}
            </svg>
            {/* X axis labels */}
            <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-muted-foreground">
              <span>{x[0]}</span>
              <span>{x[Math.floor(x.length / 2)]}</span>
              <span>{x[x.length - 1]}</span>
            </div>
            {/* Y axis labels */}
            <div className="absolute -left-8 top-0 bottom-0 flex flex-col justify-between text-xs text-muted-foreground">
              <span>{y[y.length - 1].toFixed(1)}</span>
              <span>{y[Math.floor(y.length / 2)].toFixed(1)}</span>
              <span>{y[0].toFixed(1)}</span>
            </div>
          </div>
          <div className="text-center mt-8 text-xs text-muted-foreground">
            {xLabel}
          </div>
        </div>
        {/* Color scale */}
        <div className="w-6 flex flex-col items-center">
          <div
            className="w-4 flex-1 rounded"
            style={{
              background: `linear-gradient(to bottom, hsl(185, 80%, 60%), hsl(185, 80%, 20%))`,
            }}
          />
          <div className="flex flex-col justify-between h-full absolute right-0 text-xs text-muted-foreground">
            <span>{maxZ.toFixed(2)}</span>
            <span>{minZ.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="text-center -rotate-90 absolute left-0 top-1/2 text-xs text-muted-foreground origin-center" style={{ transform: 'translateX(-100%) rotate(-90deg)' }}>
        {yLabel}
      </div>
    </div>
  );
}