import { memo, useMemo } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from "recharts";

type PowerLimitRow = {
    id: string;
    name: string;
    usedWh: number;
    limitWh: number;
};

type PowerLimitGraphProps = {
    data: PowerLimitRow[];
};

const COLORS = ["#0f766e", "#22c55e", "#eab308", "#f97316", "#ef4444", "#6366f1"];

export const PowerLimitGraph = memo(function PowerLimitGraph({ data }: PowerLimitGraphProps) {
    const processedData = useMemo(
        () =>
            data.map((d) => {
                const limit = Number.isFinite(d.limitWh) ? d.limitWh : NaN;

                let usedWh = d.usedWh;
                let unusedWh = 0;
                let overLimitWh = 0;

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

    // 🔹 Dynamic right margin based on max value digits
    const rightMargin = useMemo(() => {
        let maxVal = 0;

        for (const d of processedData) {
            const total = (d.usedWh ?? 0) + (d.unusedWh ?? 0) + (d.overLimitWh ?? 0);
            if (total > maxVal) maxVal = total;
        }

        const digits = maxVal > 0 ? Math.floor(Math.log10(maxVal)) + 1 : 1;

        if (digits >= 5) return 50;
        if (digits === 4) return 40;
        if (digits === 3) return 30;
        if (digits === 2) return 20;
        return 10;
    }, [processedData]);

    return (
        <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={processedData}
                    margin={{ top: 0, right: rightMargin, left: 50, bottom: 0 }}
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
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        label={{
                            value: "Energy (Wh)",
                            position: "Left",
                            angle: 90,
                            fontSize: 12,
                            dx: rightMargin,
                        }}
                    />

                    <Tooltip
                        formatter={(value: any, name: string, entry: any) => {
                            const vNum =
                                typeof value === "number" ? value : Number(value ?? 0);

                            const payload = entry?.payload ?? {};
                            const limit = payload.limitWh as number;
                            const totalUsedReal =
                                (payload.usedWh ?? 0) + (payload.overLimitWh ?? 0);
                            const over = payload.overLimitWh ?? 0;

                            const limitText = Number.isFinite(limit)
                                ? `${limit.toFixed(3)} Wh`
                                : "-";

                            if (name === "Used") {
                                if (over > 0) {
                                    return [
                                        `${totalUsedReal.toFixed(3)} Wh (Over: ${over.toFixed(
                                            3
                                        )} Wh)`,
                                        `Used (Limit: ${limitText})`,
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
                        contentStyle={{ fontSize: 12 }}
                    />

                    <Legend
                        verticalAlign="top"
                        align="left"
                        layout="horizontal"
                        wrapperStyle={{ paddingBottom: 12, fontSize: 15 }}
                    />

                    <Bar
                        dataKey="unusedWh"
                        name="Unused"
                        stackId="usage"
                        fill="url(#unusedPattern)"
                    />
                    <Bar
                        dataKey="usedWh"
                        name="Used"
                        stackId="usage"
                        fill={COLORS[0]}
                    />
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
