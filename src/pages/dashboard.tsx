// Dashboard.tsx
import './dashboard.scss'
import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, onSnapshot, orderBy, limit, query, getDocs, where, doc, getDoc } from 'firebase/firestore'
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

function startOfTodayMs() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}


function energyWhFromDocsAscending(docs: any[]): number {
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

function todayIdString() {
    const d = new Date();
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, "0");
    const D = String(d.getDate()).padStart(2, "0");
    return `${Y}-${M}-${D}`;
}


type DashboardProps = {
    onChangePage: (page: number) => void;
};

export default function Dashboard({ onChangePage }: DashboardProps) {
    const [energyTodayWh, setEnergyTodayWh] = useState<number>(0);
    const [energyTodayWhPerComponent, setEnergyTodayWhPerComponent] = useState<Record<string, number>>({});

    const [latestRL1, setLatestRL1] = useState<Record<string, any>>({});
    const [assetIsOn, setAssetIsOn] = useState<Record<string, boolean>>({});
    const subUnsubsRef = useRef<Map<string, Unsubscribe>>(new Map());
    const [compMeta, setCompMeta] = useState<Record<string, { name: string, type?: string, limitWh?: number }>>({});
    const [div6Chosen, setDiv6Chosen] = useState<"limit" | "usage">("limit");

    const [unreadByType, setUnreadByType] = useState<Partial<Record<InfoType, number>>>({});

    const todayStartMs = useMemo(() => startOfTodayMs(), []);

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

            const usedWh = energyTodayWhPerComponent[name] ?? 0;

            const limitWh = meta?.limitWh ?? 0;

            return {
                id: compId,
                name,
                usedWh,
                limitWh,
            };
        });
    }, [compIds, compMeta, energyTodayWhPerComponent]);

    const onlineCount = useMemo(() => {
        // assetIsOn = { asset1: true, asset2: false, ... }
        return Object.values(assetIsOn).filter(Boolean).length;
    }, [assetIsOn]);

    type InfoType = keyof typeof informationTypeMapping;

    const totalPower = useMemo(() => {
        return Object.values(latestRL1).reduce((sum, d: any) => {
            if (!d) return sum;
            const ts = typeof d.ts === "number" ? d.ts : 0;
            if (ts < todayStartMs) return sum;           // ⬅️ ignore old samples

            const p = typeof d["daya-aktif"] === "number" ? d["daya-aktif"] : 0;
            return sum + p;
        }, 0);
    }, [latestRL1, todayStartMs]);


    const totalUnread = Object.values(unreadByType).reduce(
        (sum, val) => sum + (val ?? 0),
        0
    );

    const { powerNow, latestTimestamp } = useMemo(() => {
        let p = 0;
        let last = 0;

        for (const data of Object.values(latestRL1) as any[]) {
            if (!data) continue;

            const ts = typeof data.ts === "number" ? data.ts : 0;

            // last ever (for LastUpdatedLabel)
            if (ts && ts > last) last = ts;

            // current power: only today
            if (ts >= todayStartMs && typeof data["daya-aktif"] === "number") {
                p += data["daya-aktif"];
            }
        }

        return { powerNow: p, latestTimestamp: last };
    }, [latestRL1, todayStartMs]);

    const usageRows = useMemo(() => {
    // only components with data today
    const entriesToday = Object.entries(latestRL1).filter(
        ([, data]: [string, any]) =>
            data && typeof data.ts === "number" && data.ts >= todayStartMs
    );

    const total = entriesToday.reduce((sum, [, data]: [string, any]) => {
        const p = typeof data["daya-aktif"] === "number" ? data["daya-aktif"] : 0;
        return sum + p;
    }, 0);

    return entriesToday
        .sort(([, a]: any, [, b]: any) => (b?.["daya-aktif"] ?? 0) - (a?.["daya-aktif"] ?? 0))
        .map(([compId, data]: [string, any]) => {
            const power = typeof data?.["daya-aktif"] === "number" ? data["daya-aktif"] : 0;
            const pct = total > 0 ? (power / total) * 100 : 0;
            return { compId, data, power, pct };
        });
}, [latestRL1, todayStartMs]);



    const latestTs = latestTimestamp;

    useEffect(() => {
        const assetIds = ["asset1", "asset2", "asset3", "asset4"];

        const unsubs = assetIds.map((assetId) =>
            onSnapshot(
                doc(db, "components", assetId),
                (snap) => {
                    const data = snap.data() as any | undefined;
                    const on = !!data?.info.isOn;

                    setAssetIsOn((prev) => ({
                        ...prev,
                        [assetId]: on,
                    }));
                },
                (err) => {
                    console.error(`asset listener error for ${assetId}:`, err.code, err.message);
                }
            )
        );

        return () => {
            unsubs.forEach((u) => u());
        };
    }, []);

    useEffect(() => {
        // 1) listen components list
        const compsUnsub = onSnapshot(collection(db, "components"),
            (snap) => {
                const meta: Record<string, { name: string; type?: string; limitWh?: number }> = {};
                snap.docs.forEach((doc) => {
                    const d = doc.data();
                    meta[doc.id] = { name: d.name ?? doc.id, type: d.type ?? "Unknown", limitWh: typeof d.info.powerLimit === "number" ? d.info.powerLimit : 0,};
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
            setEnergyTodayWh(0);
            setEnergyTodayWhPerComponent({});
            return;
        }

        const todayId = todayIdString(); // e.g. "2025-12-08"

        (async () => {
            const queries = compIds.map(async (compId) => {
                const ref = doc(db, "components", compId, "PL1", todayId);
                const snap = await getDoc(ref);

                const compName =
                    compMeta[compId]?.name ??
                    latestRL1[compId]?.name ??
                    compId;

                if (!snap.exists()) {
                    return { compName, Wh: 0 };
                }

                const d = snap.data() as any;
                // adjust if your field name / units differ
                const Wh = typeof d.totEnergy === "number" ? d.totEnergy : 0;

                return { compName, Wh };
            });

            const results = await Promise.all(queries);

            const total = results.reduce((sum, r) => sum + r.Wh, 0);
            setEnergyTodayWh(Number(total.toFixed(3)));

            const map: Record<string, number> = {};
            for (const { compName, Wh } of results) {
                map[compName] = Number(Wh.toFixed(3));
            }

            setEnergyTodayWhPerComponent(map);
        })().catch((err) => console.error("energyTodayWh (PL1) calc error:", err));
    }, [compIds, compMeta, latestRL1]);

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
                        <h1>{energyTodayWh} Wh</h1>
                    </div>
                </div>

                <div className='div3'>
                    <div>
                        <h2>Connections Active</h2>
                        <DashboardLogo />
                    </div>
                    <div>
                        <h1>{onlineCount}/3</h1>
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

                <div className={`div5 ${usageRows.length === 0 ? "no-data" : ""}`}>
                    <div>
                        <h2>Usage Percentage</h2>
                        <h2 className='view-all' onClick={() => onChangePage(1)}>View All</h2>
                    </div>
                    <div>
                        {usageRows.length === 0 ? (
                            <p>No data for today.</p>
                        ) : (
                            usageRows.map(({ compId, data, power, pct }) => (
                            <div key={compId} className="usage-row">
                                <h3>{data?.name ?? compId}</h3>
                                <h3>{data?.type ?? compId}</h3>
                                <h3>{power.toFixed(2)} W</h3>
                                <h3>{pct.toFixed(2)} %</h3>
                            </div>
                            ))
                        )}
                    </div>
                </div>

                <div className={`div6 ${usageRows.length === 0 ? "no-data" : ""}`}>
                    <div>
                        <h2>Component Usage (Today)</h2>
                        <div>
                            <h2 className={`${div6Chosen === "limit" ? "selected" : ""}`} onClick={() => {setDiv6Chosen("limit")}}>Limit</h2>
                            <h2 className={`${div6Chosen === "usage" ? "selected" : ""}`} onClick={() => {setDiv6Chosen("usage")}}>Usage</h2>
                        </div>
                    </div>
                    <div>
                        {(div6Chosen === "limit") ? <PowerLimitGraph data={powerLimitData} /> : <></>}
                        {div6Chosen === "usage" && (
                            usageRows.length === 0 ? (
                                <p>No data for today.</p>
                            ) : (
                                <PowerMoneyConsumption WhUsagePerComponent={energyTodayWhPerComponent}/>
                            )
                        )}
                    </div>
                </div>

                <div className={`div7 ${usageRows.length === 0 ? "no-data" : ""}`}>
                    <h2>Electric Consumption (Today)</h2>
                    <div>
                        {usageRows.length === 0 ? (
                            <p>No data for today.</p>
                        ) : (
                            <TotalPowerTodayMulti
                                compIds={compIds}
                                latestTs={latestTs}
                                compLabels={compLabels}
                                stacked={true}
                            />
                        )}
                    </div>
                </div>

                <div className='div8'>
                    <div>
                        <h2>Unread Notifications</h2>
                        <h2 className='view-all' onClick={() => onChangePage(2)}>View All</h2>
                    </div>

                    <div>
                        {totalUnread === 0 ? (
                            <p>No unread notifications.</p>
                        ) : (
                            (Object.entries(unreadByType) as [InfoType, number][]).map(([cat, count]) => (
                                <div key={cat} className={`notif-card ${informationTypeMapping[cat]}`}>
                                    <h1>{count ?? 0}</h1>
                                    <h4>{informationTypeMapping[cat]}</h4>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}