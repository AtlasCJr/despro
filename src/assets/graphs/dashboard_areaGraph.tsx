import { memo, useEffect, useState, useMemo, useCallback } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { db } from "../../firebase";

function dayWindowFrom(latestMs?: number) {
    const endMs = latestMs || Date.now();
    const d = new Date(endMs);
    d.setHours(0, 0, 0, 0);
    return { startMs: d.getTime(), endMs };
}

type Row = { name: string } & Record<string, number | string>;

type Props = {
    compIds: string[];
    latestTs?: number;
    compLabels?: Record<string, string>;
    stacked?: boolean;
};

export const TotalPowerTodayMulti = memo(function TotalPowerTodayMulti({
    compIds,
    latestTs,
    compLabels,
    stacked = false,
}: Props) {
    const [series, setSeries] = useState<Row[]>([]);

    //----------------------------------------------------------------------
    // 1) Firestore fetch function (memoized so identity is stable)
    //----------------------------------------------------------------------
    const fetchSeries = useCallback(async () => {
        if (!compIds.length) {
            setSeries([]);
            return;
        }

        const { startMs, endMs } = dayWindowFrom(latestTs);
        const bucket = new Map<number, Record<string, number>>();

        await Promise.all(
            compIds.map(async (id) => {
                const q1 = query(
                    collection(db, "components", id, "RL1"),
                    where("ts", ">=", startMs),
                    where("ts", "<=", endMs),
                    orderBy("ts", "asc")
                );

                const snap = await getDocs(q1);

                snap.docs.forEach((doc) => {
                    const x = doc.data();
                    const ts = Number(x.ts);
                    const p = Number(x["daya-aktif"]) || 0;
                    const minute = Math.floor(ts / 60000) * 60000;

                    const row = bucket.get(minute) ?? {};
                    row[id] = (row[id] ?? 0) + p;
                    bucket.set(minute, row);
                });
            })
        );

        const minutes = Array.from(bucket.keys()).sort((a, b) => a - b);

        const rows: Row[] = minutes.map((t) => {
            const row: Row = {
                name: new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };

            const vals = bucket.get(t) ?? {};
            for (const id of compIds) row[id] = vals[id] ?? 0;

            return row;
        });

        setSeries(rows);
    }, [compIds, latestTs]);

    //----------------------------------------------------------------------
    // 2) Firestore effect — triggers only when compIds or latestTs change
    //----------------------------------------------------------------------
    useEffect(() => {
        fetchSeries();
    }, [fetchSeries]);

    //----------------------------------------------------------------------
    // 3) Static palette (never reallocated)
    //----------------------------------------------------------------------
    const palette = useMemo(
        () => [
            "#2563eb",
            "#7c3aed",
            "#16a34a",
            "#dc2626",
            "#f59e0b",
            "#0891b2",
            "#9333ea",
            "#0284c7",
        ],
        []
    );

    return (
        <div className="chart">
            <ResponsiveContainer width="100%">
                <AreaChart
                    data={series}
                    margin={{ top: 10, right: 10, left: 10, bottom: 40 }}
                >
                    <defs>
                        {compIds.map((id, i) => (
                            <linearGradient key={id} id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="0%"
                                    stopColor={palette[i % palette.length]}
                                    stopOpacity={0.35}
                                />
                                <stop
                                    offset="100%"
                                    stopColor={palette[i % palette.length]}
                                    stopOpacity={0.05}
                                />
                            </linearGradient>
                        ))}
                    </defs>

                    <CartesianGrid stroke="#EEEEEE" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={24} minTickGap={60} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip formatter={(val: number) => val.toFixed(2) + " W"} />

                    <Legend verticalAlign="bottom" align="center" wrapperStyle={{ position: "relative" }} />

                    {compIds.map((id, i) => (
                        <Area
                            key={id}
                            dataKey={id}
                            name={compLabels?.[id] ?? id}
                            type="monotone"
                            stroke={palette[i % palette.length]}
                            strokeWidth={1}
                            fill={`url(#grad-${id})`}
                            {...(stacked ? { stackId: "1" } : {})}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
});
