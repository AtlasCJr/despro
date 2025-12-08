// dashboard_barGraph.tsx
import { memo, useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

type PowerLimitRow = {
    id: string;
    name: string;
    usedWh: number;   // penggunaan hari ini (total sebenarnya)
    limitWh: number;  // batas harian (bisa NaN / undefined)
};

type PowerLimitGraphProps = {
    data: PowerLimitRow[];
};

const COLORS = ["#0f766e", "#22c55e", "#eab308", "#f97316", "#ef4444", "#6366f1"];

export const PowerLimitGraph = memo(function PowerLimitGraph({ data }: PowerLimitGraphProps) {
    const processedData = useMemo(
        () => data.map((d) => {
            const limit = Number.isFinite(d.limitWh) ? d.limitWh : NaN;

            let usedWh = d.usedWh;       // bagian hijau solid di dalam limit
            let unusedWh = 0;             // sisa sebelum limit (diarsir)
            let overLimitWh = 0;          // bagian merah di atas limit

            if (Number.isFinite(limit)) {
                if (d.usedWh <= limit) {
                    usedWh = d.usedWh;
                    unusedWh = Math.max(limit - d.usedWh, 0);
                } else {
                    usedWh = limit;
                    overLimitWh = d.usedWh - limit;
                    unusedWh = 0;
                }
            } else {
                usedWh = d.usedWh;
                unusedWh = 0;
                overLimitWh = 0;
            }

            return {
                ...d,
                limitWh: limit,
                usedWh,
                unusedWh,
                overLimitWh,
            };
        }),
        [data]
    );

    return (
        <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                data={processedData}
                margin={{ top: 0, right: 50, left: 50, bottom: 0 }}
                barCategoryGap={"5%"}
                barSize={50}
                barGap={2}
                >
                <defs>
                    <pattern
                        id="unusedPattern"
                        patternUnits="userSpaceOnUse"
                        width={6}
                        height={6}
                    >
                    <rect width="6" height="6" fill={COLORS[0]} />
                    <path
                        d="M0,6 l6,-6 M-1,1 l2,-2 M5,7 l2,-2"
                        stroke="#ffffff"
                        strokeWidth={2}
                    />
                    </pattern>
                </defs>

                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis 
                    orientation="right" 
                    tick={{fontSize: 12}} 
                    label={{value: "Energy (Wh)", position: "Left", angle: 90, fontSize: 12, dx: 40 }} 
                />

                <Tooltip
                    formatter={(value: any, name: string, entry: any) => {
                        const vNum = typeof value === "number" ? value : Number(value ?? 0);

                        const payload = entry?.payload ?? {};
                        const limit = payload.limitWh as number;
                        const totalUsedReal = (payload.usedWh ?? 0) + (payload.overLimitWh ?? 0);
                        const over = payload.overLimitWh ?? 0;

                        const limitText = Number.isFinite(limit)
                            ? `${limit.toFixed(3)} Wh`
                            : "-";

                        if (name === "Used") {
                            if (over > 0) {
                                return [
                                    `${totalUsedReal.toFixed(3)} Wh (Over: ${over.toFixed(3)} Wh)`,`Used (Limit: ${limitText})`,
                                ];
                            }
                            return [`${totalUsedReal.toFixed(3)} Wh`, `Used`];
                        }

                        if (name === "Unused") {
                            return [`${vNum.toFixed(3)} Wh`, "Remaining"];
                        }

                        if (name === "Over Limit") {
                            return [`${vNum.toFixed(3)} Wh`, "Over Limit"];
                        }

                        return [vNum, name];
                    }}

                    contentStyle={{fontSize: 12}}
                />

                <Legend
                    verticalAlign="top"
                    align="left"
                    layout="horizontal"
                    wrapperStyle={{paddingBottom: 12, fontSize: 15}}
                />

                {/* Bagian sisa sebelum limit (diarsir hijau) */}
                <Bar
                    dataKey="unusedWh"
                    name="Unused"
                    stackId="usage"
                    fill="url(#unusedPattern)"
                />

                {/* Bagian pemakaian sampai limit (hijau solid) */}
                <Bar
                    dataKey="usedWh"
                    name="Used"
                    stackId="usage"
                    fill={COLORS[0]}
                />

                {/* Bagian yang over limit (merah) */}
                <Bar
                    dataKey="overLimitWh"
                    name="Over Limit"
                    stackId="usage"
                    fill={COLORS[4]}
                    radius={[4, 4, 0, 0]}
                />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
});
