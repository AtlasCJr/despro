
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend, Tooltip } from 'recharts';
import type { RawBase } from '../../hooks/datastruct';
import { memo, useMemo } from 'react';


// 1) Make the parser accept "YYYY-MM-DD", "YYYY-MM-DDTHH", "YYYY-MM-DDTHH:MM", "YYYY-MM-DDTHH:MM:SS"
function IDToDate(id?: string): number | null {
    if (!id || typeof id !== "string") return null;

    const [datePart, timePartRaw = ""] = id.split("T");
    const [Y, M, D] = (datePart || "").split("-").map(Number);

    const tPieces = timePartRaw.split(":").map(Number).filter(n => !Number.isNaN(n));
    const HH = tPieces[0] ?? 0;
    const MM = tPieces[1] ?? 0;
    const SS = tPieces[2] ?? 0;

    if ([Y, M, D, HH, MM, SS].some(n => Number.isNaN(n))) return null;
    return Date.UTC(Y, (M ?? 1) - 1, D ?? 1, HH, MM, SS);
}

// 2) Helper to pick a formatter based on the total span (ms) and average step (ms)
function makeTimeFormatter(spanMs: number, stepMs: number) {
    // IDK WHAT THIS IS FOR BUT JUST IN CASE
    stepMs = Math.max(stepMs, 1);

    const ONE_H  = 3600e3;
    const ONE_D  = 24 * ONE_H;
    const ONE_MO = 30 * ONE_D;

    if (spanMs <= 2 * ONE_D) {
        return (ms: number) =>
        new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (spanMs <= 2 * ONE_MO) {
        return (ms: number) =>
        new Date(ms).toLocaleDateString([], { day: "2-digit", month: "short" });
    }
    return (ms: number) =>
        new Date(ms).toLocaleDateString([], { month: "short", year: "numeric" });
}


type WithId<T> = T & { id: string };

interface ComponentChartProps {
  data: WithId<RawBase>[];
  toggleVar: boolean[];
  toggleAxis: number[];
}

// 👇 wrap in memo at the bottom
function ComponentChartInner({ data, toggleVar, toggleAxis }: ComponentChartProps) {
  // 🔹 1. Parse + sort data only when `data` changes
  const chartData = useMemo(
    () =>
      data
        .map((d) => {
          const t = IDToDate(d.id);
          if (t === null) return null;

          const dayaAktif = d["daya-aktif"] as number;
          const dayaReaktif = d["daya-reaktif"] as number;
          const dayaKompleks = d["daya-kompleks"] as number;
          const faktorDaya = d["faktor-daya"] as number;

          return {
            t,
            arus: d.arus,
            tegangan: d.tegangan,
            dayaAktif,
            dayaReaktif,
            dayaKompleks,
            faktorDaya,
          };
        })
        .filter(
          (
            x
          ): x is {
            t: number;
            arus: number;
            tegangan: number;
            dayaAktif: number;
            dayaReaktif: number;
            dayaKompleks: number;
            faktorDaya: number;
          } => !!x
        )
        .sort((a, b) => a.t - b.t),
    [data]
  );

  // 🔹 2. Derived time span + formatter memoized
  const { spanMs, stepMs } = useMemo(() => {
    if (!chartData.length) return { spanMs: 0, stepMs: 0 };
    const span = chartData[chartData.length - 1].t - chartData[0].t;
    const step = chartData.length > 1 ? span / (chartData.length - 1) : span;
    return { spanMs: span, stepMs: step };
  }, [chartData]);

  const tickFmt = useMemo(
    () => makeTimeFormatter(spanMs, stepMs),
    [spanMs, stepMs]
  );

  // 🔹 3. Axis side + flags memoized by toggleAxis/toggleVar
  const { currentSide, voltageSide, powerSide, pfSide, powerOn, pfOn } =
    useMemo(() => {
      const sideFor = (metricIdx: number): "left" | "right" | null => {
        const i = toggleAxis.indexOf(metricIdx);
        if (i === -1) return null;
        return i === 0 ? "left" : "right";
      };

      const currentSide = sideFor(0);
      const voltageSide = sideFor(1);
      const powerSide = sideFor(2);
      const pfSide = sideFor(3);

      const powerOn = !!(toggleVar[2] || toggleVar[3] || toggleVar[4]);
      const pfOn = !!toggleVar[5];

      return { currentSide, voltageSide, powerSide, pfSide, powerOn, pfOn };
    }, [toggleAxis, toggleVar]);

  const AXIS_ID = {
    current: "axis-current",
    voltage: "axis-voltage",
    power: "axis-power",
    pf: "axis-pf",
  } as const;

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={500} maxHeight={600} minHeight={400}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 60, left: 60, bottom: 25 }}
        >
          <defs>
            <linearGradient id="pArus" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#EEE" vertical={false} />

          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickMargin={24}
            minTickGap={60}
            tickFormatter={(ms) => tickFmt(ms as number)}
            axisLine={false}
            tickLine={false}
          />

          {currentSide && (
            <YAxis
              yAxisId={AXIS_ID.current}
              orientation={currentSide}
              label={{
                value: "Arus (A)",
                angle: currentSide === "left" ? -90 : 90,
                position:
                  currentSide === "left" ? "insideLeft" : "insideRight",
                offset: -30,
              }}
              tickFormatter={(v: number) => v.toFixed(2)}
              domain={[
                (min: number) => Math.max(0, min * 0.9),
                (max: number) => max * 1.1,
              ]}
              axisLine={false}
              tickLine={false}
              tickMargin={24}
            />
          )}

          {voltageSide && (
            <YAxis
              yAxisId={AXIS_ID.voltage}
              orientation={voltageSide}
              label={{
                value: "Tegangan (V)",
                angle: voltageSide === "left" ? -90 : 90,
                position:
                  voltageSide === "left" ? "insideLeft" : "insideRight",
                offset: -30,
              }}
              tickFormatter={(v: number) => v.toFixed(0)}
              domain={[
                (min: number) => min - 2,
                (max: number) => max + 2,
              ]}
              axisLine={false}
              tickLine={false}
              tickMargin={24}
            />
          )}

          {powerOn && powerSide && (
            <YAxis
              yAxisId={AXIS_ID.power}
              orientation={powerSide}
              label={{
                value: "Daya",
                angle: powerSide === "left" ? -90 : 90,
                position: powerSide === "left" ? "insideLeft" : "insideRight",
                offset: -30,
              }}
              tickFormatter={(v: number) => v.toFixed(1)}
              domain={[
                (min: number) => (min >= 0 ? 0 : min * 1.1),
                (max: number) => max * 1.1,
              ]}
              axisLine={false}
              tickLine={false}
              tickMargin={24}
            />
          )}

          {pfOn && pfSide && (
            <YAxis
              yAxisId={AXIS_ID.pf}
              orientation={pfSide}
              label={{
                value: "Faktor Daya",
                angle: pfSide === "left" ? -90 : 90,
                position: pfSide === "left" ? "insideLeft" : "insideRight",
                offset: -30,
              }}
              tickFormatter={(v: number) => v.toFixed(2)}
              domain={[0, 1]}
              axisLine={false}
              tickLine={false}
              tickMargin={24}
            />
          )}

          <Tooltip
            labelFormatter={(ms) =>
              new Date(ms as number).toLocaleString()
            }
            formatter={(val: number, name) =>
              name === "Arus"
                ? [val.toFixed(3) + " A", "Arus"]
                : name === "Tegangan"
                ? [val.toFixed(1) + " V", "Tegangan"]
                : name === "Daya Aktif"
                ? [val.toFixed(1) + " W", "Daya Aktif"]
                : name === "Daya Reaktif"
                ? [val.toFixed(1) + " VAR", "Daya Reaktif"]
                : name === "Daya Kompleks"
                ? [val.toFixed(1) + " VA", "Daya Kompleks"]
                : [val.toFixed(2), "Faktor Daya"]
            }
          />

          <Legend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ position: "relative" }}
          />

          {toggleVar[0] && currentSide && (
            <Line
              yAxisId={AXIS_ID.current}
              dataKey="arus"
              name="Arus"
              stroke="#1E90FF"
              dot={false}
            />
          )}
          {toggleVar[1] && voltageSide && (
            <Line
              yAxisId={AXIS_ID.voltage}
              dataKey="tegangan"
              name="Tegangan"
              stroke="#FF6B6B"
              dot={false}
            />
          )}
          {toggleVar[2] && powerSide && (
            <Line
              yAxisId={AXIS_ID.power}
              dataKey="dayaAktif"
              name="Daya Aktif"
              stroke="#FFD93D"
              dot={false}
            />
          )}
          {toggleVar[3] && powerSide && (
            <Line
              yAxisId={AXIS_ID.power}
              dataKey="dayaReaktif"
              name="Daya Reaktif"
              stroke="#9B59B6"
              dot={false}
            />
          )}
          {toggleVar[4] && powerSide && (
            <Line
              yAxisId={AXIS_ID.power}
              dataKey="dayaKompleks"
              name="Daya Kompleks"
              stroke="#16A085"
              dot={false}
            />
          )}
          {toggleVar[5] && pfSide && (
            <Line
              yAxisId={AXIS_ID.pf}
              dataKey="faktorDaya"
              name="Faktor Daya"
              stroke="#F39C12"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ✅ Memoized export
export default memo(ComponentChartInner);