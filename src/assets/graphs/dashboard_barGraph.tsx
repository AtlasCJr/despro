// dashboard_barGraph.tsx
import { memo, useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

type PowerLimitRow = {
    id: string;
    name: string;
    usedKWh: number;   // penggunaan hari ini (total sebenarnya)
    limitKWh: number;  // batas harian (bisa NaN / undefined)
};

type PowerLimitGraphProps = {
    data: PowerLimitRow[];
};

const COLORS = ["#0f766e", "#22c55e", "#eab308", "#f97316", "#ef4444", "#6366f1"];

export const PowerLimitGraph = memo(function PowerLimitGraph({ data }: PowerLimitGraphProps) {
    const processedData = useMemo(
        () => data.map((d) => {
            const limit = Number.isFinite(d.limitKWh) ? d.limitKWh : NaN;

            let usedKWh = d.usedKWh;       // bagian hijau solid di dalam limit
            let unusedKWh = 0;             // sisa sebelum limit (diarsir)
            let overLimitKWh = 0;          // bagian merah di atas limit

            if (Number.isFinite(limit)) {
                if (d.usedKWh <= limit) {
                    usedKWh = d.usedKWh;
                    unusedKWh = Math.max(limit - d.usedKWh, 0);
                } else {
                    usedKWh = limit;
                    overLimitKWh = d.usedKWh - limit;
                    unusedKWh = 0;
                }
            } else {
                usedKWh = d.usedKWh;
                unusedKWh = 0;
                overLimitKWh = 0;
            }

            return {
                ...d,
                limitKWh: limit,
                usedKWh,
                unusedKWh,
                overLimitKWh,
            };
        }),
        [data]
    );

    return (
        <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                data={processedData}
                margin={{ top: 0, right: 0, left: 50, bottom: 0 }}
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
                <XAxis dataKey="name" />

                {/* Y-axis di kanan */}
                <YAxis orientation="right" />

                <Tooltip
                    formatter={(value: any, name: string, entry: any) => {
                        const vNum = typeof value === "number" ? value : Number(value ?? 0);

                        const payload = entry?.payload ?? {};
                        const limit = payload.limitKWh as number;
                        const totalUsedReal = (payload.usedKWh ?? 0) + (payload.overLimitKWh ?? 0);
                        const over = payload.overLimitKWh ?? 0;

                        const limitText = Number.isFinite(limit)
                            ? `${limit.toFixed(3)} kWh`
                            : "Tidak ada limit";

                        if (name === "Used") {
                            if (over > 0) {
                                return [
                                    `${totalUsedReal.toFixed(3)} kWh (Over: ${over.toFixed(
                                    3
                                    )} kWh)`,
                                    `Used (Limit: ${limitText})`,
                                ];
                            }
                            return [`${totalUsedReal.toFixed(3)} kWh`, `Used (Limit: ${limitText})`];
                        }

                        if (name === "Unused") {
                            return [`${vNum.toFixed(3)} kWh`, "Remaining"];
                        }

                        if (name === "Over Limit") {
                            return [`${vNum.toFixed(3)} kWh`, "Over Limit"];
                        }

                        return [vNum, name];
                    }}
                />

                <Legend
                    verticalAlign="top"
                    align="left"
                    layout="horizontal"
                    wrapperStyle={{paddingBottom: 12}}
                    />

                {/* Bagian sisa sebelum limit (diarsir hijau) */}
                <Bar
                    dataKey="unusedKWh"
                    name="Unused"
                    stackId="usage"
                    fill="url(#unusedPattern)"
                />

                {/* Bagian pemakaian sampai limit (hijau solid) */}
                <Bar
                    dataKey="usedKWh"
                    name="Used"
                    stackId="usage"
                    fill={COLORS[0]}
                />

                {/* Bagian yang over limit (merah) */}
                <Bar
                    dataKey="overLimitKWh"
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
