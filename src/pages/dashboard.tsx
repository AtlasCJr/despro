// Dashboard.tsx
import './dashboard.scss'
import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, onSnapshot, orderBy, limit, query, getDocs, where } from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { db } from '../firebase'

import { DashboardLogo, ComponentsLogo, UpdateLogo, SumLogo } from '../assets/icons';
import { TotalPowerTodayMulti } from '../assets/graphs/dashboard_areaGraph';
import { PowerMoneyConsumption } from '../assets/graphs/dashboard_pieGraph';
import { PowerLimitGraph } from '../assets/graphs/dashboard_barGraph';
import { LastUpdatedLabel } from '../assets/LastUpdatedLabel'

// helpers
function dayWindowFromLatest(latestMs: number) {
    const end = latestMs;                      // stop at the latest point we have
    const d = new Date(latestMs);              // local time (Asia/Jakarta on your machine)
    const startDate = new Date(d);
    startDate.setHours(0, 0, 0, 0);            // local midnight of that day
    const start = startDate.getTime();
    return { startMs: start, endMs: end };
}

function energyKWhFromDocsAscending(docs: any[]): number {
    if (!docs.length) return 0;

    let wh = 0;
    for (let i = 1; i < docs.length; i++) {
        const p0 = Number(docs[i - 1]["daya-aktif"]) || 0;   // Watts
        const p1 = Number(docs[i]["daya-aktif"]) || 0;       // Watts
        const t0 = Number(docs[i - 1].ts);                   // ms
        const t1 = Number(docs[i].ts);                       // ms
        if (!t0 || !t1 || t1 <= t0) continue;

        const hours = (t1 - t0) / (1000 * 60 * 60);          // hours
        wh += ((p0 + p1) / 2) * hours;                       // trapezoid in Wh
    }
    return wh / 1000;
}


export default function Dashboard() {
    const [energyTodayKWh, setEnergyTodayKWh] = useState<number>(0);
    const [energyTodaykWhPerComponent, setEnergyTodayKWhPerComponent] = useState<Record<string, number>>({});

    const [latestRL1, setLatestRL1] = useState<Record<string, any>>({});
    const subUnsubsRef = useRef<Map<string, Unsubscribe>>(new Map());
    const [compMeta, setCompMeta] = useState<Record<string, { name: string, type?: string, limitKWh?: number }>>({});
    const [div6Chosen, setDiv6Chosen] = useState<"limit" | "usage">("limit");

    const [unreadByType, setUnreadByType] = useState<Partial<Record<InfoType, number>>>({});

    const informationTypeMapping = {
        0: "Normal",
        1: "Warning",
        2: "Critical",
        Unknown: "Uncategorized",
    } as const;

    const compIds = useMemo(() => Object.keys(latestRL1), [latestRL1]);

    const compLabels = useMemo(
        () =>
            Object.fromEntries(
            Object.entries(compMeta).map(([id, meta]) => [id, meta.name])
        ),
        [compMeta]
    );

        // Put this near your other useMemos
    const powerLimitData = useMemo(() => {
    return compIds.map((compId) => {
        const meta = compMeta[compId];
        const name = meta?.name ?? compId;

        // ⚠️ You stored per-component kWh with NAME keys, so use that
        const usedKWh = energyTodaykWhPerComponent[name] ?? 0;

        const limitKWh = meta?.limitKWh ?? 0;

        return {
        id: compId,
        name,
        usedKWh,
        limitKWh,
        };
    });
        }, [compIds, compMeta, energyTodaykWhPerComponent]);



    type InfoType = keyof typeof informationTypeMapping;

    const totalPower = useMemo(() => {
        return Object.values(latestRL1).reduce((sum, d: any) => {
            const p = typeof d?.["daya-aktif"] === "number" ? d["daya-aktif"] : 0;
            return sum + p;
        }, 0);
    }, [latestRL1]);

    const { powerNow, onlineCount, latestTimestamp } = useMemo(() => {
        let p = 0;
        let c = 0;
        let last = 0;

        for (const data of Object.values(latestRL1) as any[]) {
            if (!data) continue;

            if (typeof data["daya-aktif"] === "number") p += data["daya-aktif"];

            if (data.isOn) c++;

            if (data.ts && data.ts > last) last = data.ts;
        }

        return { powerNow: p, onlineCount: c, latestTimestamp: last };

    }, [latestRL1]);

    const latestTs = latestTimestamp;

    useEffect(() => {
        // 1) listen components list
        const compsUnsub = onSnapshot(collection(db, "components"),
            (snap) => {
                const meta: Record<string, { name: string; type?: string; limitKWh?: number }> = {};
                snap.docs.forEach((doc) => {
                    const d = doc.data();
                    meta[doc.id] = { name: d.name ?? doc.id, type: d.type ?? "Unknown", limitKWh: typeof d.info.powerLimit === "number" ? d.info.powerLimit : 0,};
                });
                setCompMeta(meta);

                const currentIds = new Set(snap.docs.map(d => d.id));

                // detach listeners for removed components
                for (const [compId, unsub] of subUnsubsRef.current.entries()) {
                    if (!currentIds.has(compId)) {
                        unsub();
                        subUnsubsRef.current.delete(compId);
                        setLatestRL1(prev => {
                            const copy = { ...prev };
                            delete copy[compId];
                            return copy;
                        });
                    }
                }

                // attach listeners for new components
                for (const d of snap.docs) {
                    const compId = d.id;
                    const compData = d.data();

                    if (subUnsubsRef.current.has(compId)) continue;

                    const q = query(
                        collection(db, "components", compId, "RL1"),
                        orderBy("ts", "desc"),
                        limit(1)
                    );

                    const unsub = onSnapshot(
                        q,
                        (rl1Snap) => {
                            const latest = rl1Snap.empty ? null : { id: rl1Snap.docs[0].id, ...rl1Snap.docs[0].data() };
                            setLatestRL1(prev => ({
                                ...prev,
                                [compId]: {
                                    ...(latest ?? {}),
                                    name: compData.name,
                                    type: compData.type
                                }
                            }));
                        },
                        (err) => console.error(`RL1 listener error for ${compId}:`, err.code, err.message)
                    );

                    subUnsubsRef.current.set(compId, unsub);
                }
            },

            (err) => console.error("components listener error:", err.code, err.message)
        );

        return () => {
            compsUnsub();
            for (const [, unsub] of subUnsubsRef.current.entries()) unsub();
            subUnsubsRef.current.clear();
        };
    }, []);

    useEffect(() => {
        if (compIds.length === 0) {
            setEnergyTodayKWh(0);
            setEnergyTodayKWhPerComponent({});
            return;
        }

        const { startMs, endMs } = dayWindowFromLatest(latestTs);

        (async () => {
            // 1️⃣ Build queries only (no await inside loop)
            const queries = compIds.map((compId) => {
                const q1 = query(
                    collection(db, "components", compId, "RL1"),
                    where("ts", ">=", startMs),
                    where("ts", "<", endMs),
                    orderBy("ts", "asc")
                );

                // return the promise, NOT awaiting here
                return getDocs(q1).then((snap) => {
                    const arr = snap.docs.map(d => d.data());
                    const kWh = energyKWhFromDocsAscending(arr) || 0;

                    const compName =
                        compMeta[compId]?.name ??
                        latestRL1[compId]?.name ??
                        compId;

                    return { compName, kWh };
                });
            });

            // 2️⃣ Execute ALL Firestore fetches in parallel
            const results = await Promise.all(queries);

            // 3️⃣ Total energy
            const total = results.reduce((sum, r) => sum + r.kWh, 0);
            setEnergyTodayKWh(Number(total.toFixed(3)));

            // 4️⃣ Per component map
            const map: Record<string, number> = {};
            for (const { compName, kWh } of results) {
                map[compName] = Number(kWh.toFixed(3));
            }

            setEnergyTodayKWhPerComponent(map);
            
        })().catch((err) => console.error("energyTodayKWh calc error:", err));
    }, [latestTs, latestRL1]);



    useEffect(() => {
        const qUnreadAll = query(
            collection(db, "notifications"),
            where("isRead", "==", false)
        );

        const unsub = onSnapshot(qUnreadAll, (snap) => {
            const byType: Record<string, number> = {};

            snap.docs.forEach((d) => {
                const x = d.data() as any;
                const t = (x?.type ?? "Unknown") as InfoType;
                
                byType[t] = (byType[t] ?? 0) + 1;
            });

            setUnreadByType(byType);
        });

        return () => unsub();
    }, []);


    return (
        <div className='dashboard'>
            <h1>Dashboard</h1>

            <div className='grid-parent'>
                <div className='div1'>
                    <div>
                        <h2>Current Power</h2>
                        <ComponentsLogo />
                    </div>
                    <div>
                        <h1>{Math.round(powerNow)} W</h1>
                    </div>
                </div>

                <div className='div2'>
                    <div>
                        <h2>Total Usage (Today)</h2>
                        <SumLogo />
                    </div>
                    <div>
                        <h1>{energyTodayKWh} kWh</h1>
                    </div>
                </div>

                <div className='div3'>
                    <div>
                        <h2>Connections Online</h2>
                        <DashboardLogo />
                    </div>
                    <div>
                        <h1>{onlineCount}/4</h1>
                    </div>
                </div>

                <div className='div4'>
                    <div>
                        <h2>Last Updated</h2>
                        <UpdateLogo />
                    </div>
                    <div>
                        <LastUpdatedLabel latestTs={latestTs} />
                    </div>
                </div>

                <div className='div5'>
                    <div>
                        <h2>Usage Percentage</h2>
                        <h2>View All</h2>
                    </div>
                    <div>
                    {Object.entries(latestRL1)
                        .sort(([, a]: any, [, b]: any) => (b?.["daya-aktif"] ?? 0) - (a?.["daya-aktif"] ?? 0))
                        .map(([compId, data]: [string, any]) => {
                            const power = typeof data?.["daya-aktif"] === "number" ? data["daya-aktif"] : 0;
                            const pct = totalPower > 0 ? (power / totalPower) * 100 : 0;

                            return (
                                <div key={compId} className="usage-row">
                                    {/* <ComponentsLogo /> */}
                                    <h3>{data?.name ?? compId}</h3>
                                    <h3>{data?.type ?? compId}</h3>
                                    <h3>{power.toFixed(2)} W</h3>
                                    <h3>{pct.toFixed(2)} %</h3>
                                </div>
                            );
                        })
                    }
                    </div>
                </div>

                <div className='div6'>
                    <div>
                        <h2>Component Usage (Today)</h2>
                        <div>
                            <h2 className={`${div6Chosen === "limit" ? "selected" : ""}`} onClick={() => {setDiv6Chosen("limit")}}>Limit</h2>
                            <h2 className={`${div6Chosen === "usage" ? "selected" : ""}`} onClick={() => {setDiv6Chosen("usage")}}>Usage</h2>
                        </div>
                    </div>
                    {(div6Chosen === "limit") ? <PowerLimitGraph data={powerLimitData} /> : <></>}
                    {(div6Chosen === "usage") ? <PowerMoneyConsumption kWhUsagePerComponent={energyTodaykWhPerComponent} /> : <></>}
                </div>

                <div className='div7'>
                    <h2>Electric Consumption (Today)</h2>
                    <TotalPowerTodayMulti
                        compIds={compIds}
                        latestTs={latestTs}
                        compLabels={compLabels}
                        stacked={true}
                    />
                </div>

                <div className='div8'>
                    <div>
                        <h2>Unread Notifications</h2>
                        <h2>View All</h2>
                    </div>

                    <div>
                        {(Object.entries(unreadByType) as [InfoType, number][]).map(([cat, count]) => (
                            <div key={cat} className="notif-card">
                                <h1>{count ?? 0}</h1>
                                <h4>{informationTypeMapping[cat]}</h4>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}