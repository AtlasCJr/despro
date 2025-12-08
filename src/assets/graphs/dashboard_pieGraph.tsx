import { memo } from "react";
import { ResponsiveContainer, PieChart, Pie, Tooltip, Legend, Cell, LabelList } from "recharts";

import { Num2Currency } from '../../utils/Num2Currency'

const COLORS = ["#0f766e", "#22c55e", "#eab308", "#f97316", "#ef4444", "#6366f1"];

type PowerMoneyProps = { WhUsagePerComponent: Record<string, number> };

export const PowerMoneyConsumption = memo(function PowerMoneyConsumption({ WhUsagePerComponent }: PowerMoneyProps) {
    const data = Object.entries(WhUsagePerComponent).map(([name, Wh]) => {
        const raw = Number(Wh.toFixed(3));
        const value = raw > 0 && raw < 0.001 ? 0.001 : raw; // tiny but visible
        return { name, value };
    });

    if (data.every(d => d.value === 0)) {
        return <p>No usage today.</p>;
    }

    return (
        <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        innerRadius={100}
                        outerRadius={120}
                        paddingAngle={6}
                    >
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}

                        <LabelList
                            dataKey="value"
                            position="outside"
                            formatter={(v) => `${Num2Currency(Number(v), "Rp.")}`}
                        />

                    </Pie>

                    <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} Wh`, "Usage"]} contentStyle={{fontSize: 12}} />

                    <Legend
                        verticalAlign="top"
                        align="center"
                        layout="horizontal"
                        wrapperStyle={{ position: "relative", fontSize: 15 }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
});
