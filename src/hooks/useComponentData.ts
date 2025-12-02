import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where, limit as qlimit, QueryDocumentSnapshot } from "firebase/firestore";
import type { QueryConstraint, Unsubscribe } from "firebase/firestore";
import { runTransaction } from "firebase/firestore"
import type { ComponentStruct } from "./datastruct";
import { db } from "../firebase";

type Layer = "RL1" | "RL2" | "RL3" | "RL4" | "PL1" | "PL2" | "PL3" | "PL4" | "PL5";

export interface UseBundleOpts {
    sinceTs?: number;
    untilTs?: number;
    limitPerLayer?: number;
    order?: "asc" | "desc";
    include?: Layer[];
}

const ALL_LAYERS: Layer[] = ["RL1", "RL2", "RL3", "RL4", "PL1", "PL2", "PL3", "PL4", "PL5"];
type LayersState = Record<Layer, any[]>;
type AnyDoc = Record<string, any>;

function docsWithId<T>(docs: QueryDocumentSnapshot<T>[]) {
    return docs.map((d) => ({ id: d.id, ...d.data() })) as (T & { id: string })[];
}

function upsertArray<T>(
    existing: T[] | undefined,
    index: number,
    value: T,
    filler: T
): T[] {
    const arr = Array.isArray(existing) ? [...existing] : [];
    // ensure no holes before index
    while (arr.length <= index) {
        arr.push(filler);
    }
    arr[index] = value;
    return arr;
}

async function updateBridgeForComponent(
    componentId: string,
    updater: (data: any, index: number) => void
) {
    const compRef = doc(db, "components", componentId);
    const bridgeRef = doc(db, "website-esp32", "bridge");

    await runTransaction(db, async (tx) => {
        const compSnap = await tx.get(compRef);
        if (!compSnap.exists()) return;

        const compData = compSnap.data() as any;
        const index: number = compData.bridgeIndex;   // we stored this in the doc
        if (index == null) return;

        const bridgeSnap = await tx.get(bridgeRef);
        const bridgeData = bridgeSnap.data() || {};

        // let the caller mutate the arrays
        updater(bridgeData, index);

        tx.update(bridgeRef, bridgeData);
    });
}


function buildConstraintsForLayer(layer: Layer, opts: UseBundleOpts): QueryConstraint[] {
    const cs: QueryConstraint[] = [];

    if (layer.startsWith("RL")) {
        // raw layers use ts + optional since/until/order
        if (typeof opts.sinceTs === "number") cs.push(where("ts", ">=", opts.sinceTs));
        if (typeof opts.untilTs === "number") cs.push(where("ts", "<=", opts.untilTs));
        cs.push(orderBy("ts", opts.order === "desc" ? "desc" : "asc"));
    } else {
        // PL* -> no time requirements at all (no where/orderBy on ts/start)
        // If you want a stable order, you can optionally do:
        // cs.push(orderBy("__name__")); // lexicographic by doc id (optional)
    }

    if (typeof opts.limitPerLayer === "number") cs.push(qlimit(opts.limitPerLayer));
    return cs;
}

export function useComponentBundle(componentId: string, opts: UseBundleOpts = {}) {
    const include = opts.include?.length ? opts.include : ALL_LAYERS;
    const [component, setComponent] = useState<(ComponentStruct & { id: string }) | null>(null);
    const [layers, setLayers] = useState<LayersState>(() => {
        const init: Partial<LayersState> = {};
        for (const l of ALL_LAYERS) init[l] = [];
        return init as LayersState;
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown | null>(null);
    const unsubsRef = useRef<Unsubscribe[]>([]);

    useEffect(() => {
        if (!componentId) return;
        setLoading(true);
        setError(null);

        // Cleanup old listeners
        unsubsRef.current.forEach((u) => u());
        unsubsRef.current = [];

        // 1️⃣ Subscribe to the component doc
        const compRef = doc(db, "components", componentId);
        const uComp = onSnapshot(
            compRef,
            (snap) => {
                if (snap.exists()) {
                    setComponent({ id: snap.id, ...(snap.data() as ComponentStruct) });
                } else {
                    setComponent(null);
                }
            },
            
            (err) => setError(err)
        );

        unsubsRef.current.push(uComp);

        // 2️⃣ Subscribe to subcollections (RL1–RL4, PL1–PL5)
        include.forEach((layer) => {
            const colRef = collection(db, "components", componentId, layer);
            const q = query(colRef, ...buildConstraintsForLayer(layer, opts));
            const u = onSnapshot(
                q,
                (snap) => {
                const rows = docsWithId<AnyDoc>(snap.docs as any);

                    // console.log(`Layer ${layer}:`, snap.size, "docs");

                setLayers((prev) => ({ ...prev, [layer]: rows }));
                setLoading(false);
                },
                (err) => {
                    setError(err);
                    setLoading(false);
                }
            );
            unsubsRef.current.push(u);
        });

        return () => {
            unsubsRef.current.forEach((u) => u());
            unsubsRef.current = [];
        };
        
    }, [componentId, opts.sinceTs, opts.untilTs, opts.limitPerLayer, opts.order, include.join("|")]);
    
    async function toggleOnOff() {
        if (!componentId || !component?.info) return;

        const next = !component.info.isOn;

        await runTransaction(db, async (tx) => {
            const compRef = doc(db, "components", componentId);
            const bridgeRef = doc(db, "website-esp32", "bridge");

            const [compSnap, bridgeSnap] = await Promise.all([
            tx.get(compRef),
            tx.get(bridgeRef),
            ]);
            if (!compSnap.exists()) return;

            const compData = compSnap.data() as any;
            const index: number = compData.bridgeIndex;
            if (index == null) return;

            const bridgeData = (bridgeSnap.exists() ? bridgeSnap.data() : {}) as any;

            const isOnArr = upsertArray<boolean>(
            bridgeData.isOn as boolean[] | undefined,
            index,
            next,
            false
            );

            tx.update(compRef, { "info.isOn": next });
            tx.update(bridgeRef, { isOn: isOnArr });
        });
    }



    async function changePowerLimit(limit: number) {
        if (!componentId || !component?.info) return;

        await runTransaction(db, async (tx) => {
            const compRef = doc(db, "components", componentId);
            const bridgeRef = doc(db, "website-esp32", "bridge");

            const [compSnap, bridgeSnap] = await Promise.all([
            tx.get(compRef),
            tx.get(bridgeRef),
            ]);
            if (!compSnap.exists()) return;

            const compData = compSnap.data() as any;
            const index: number = compData.bridgeIndex;
            if (index == null) return;

            const bridgeData = (bridgeSnap.exists() ? bridgeSnap.data() : {}) as any;

            const nextInfo =
            limit === 0
                ? { "info.isLimited": false, "info.powerLimit": NaN }
                : { "info.isLimited": true, "info.powerLimit": limit };

            const limitArr = upsertArray<number>(
            bridgeData.energyLimit as number[] | undefined,
            index,
            limit === 0 ? NaN : limit,
            0            // filler (won't be used once you overwrite index)
            );

            tx.update(compRef, nextInfo);
            tx.update(bridgeRef, { energyLimit: limitArr });
        });
    }




    async function changeName(name: string) {
        if (!componentId || !component?.info) return;

        await runTransaction(db, async (tx) => {
            const compRef = doc(db, "components", componentId);
            const bridgeRef = doc(db, "website-esp32", "bridge");

            const [compSnap, bridgeSnap] = await Promise.all([
                tx.get(compRef),
                tx.get(bridgeRef),
            ]);
            if (!compSnap.exists()) return;

            const compData = compSnap.data() as any;
            const index: number = compData.bridgeIndex;
            if (index == null) return;

            const bridgeData = (bridgeSnap.exists() ? bridgeSnap.data() : {}) as any;

            const names = upsertArray<string>(
                bridgeData.componentName as string[] | undefined,
                index,
                name,
                ""          // filler so no element is undefined
            );

            // writes
            tx.update(compRef, { name });
            tx.update(bridgeRef, { componentName: names });
        });
    }




    async function changeType(type: string) {
        if (!componentId || !component?.info) return;

        await runTransaction(db, async (tx) => {
            const compRef = doc(db, "components", componentId);
            const bridgeRef = doc(db, "website-esp32", "bridge");

            const [compSnap, bridgeSnap] = await Promise.all([
            tx.get(compRef),
            tx.get(bridgeRef),
            ]);
            if (!compSnap.exists()) return;

            const compData = compSnap.data() as any;
            const index: number = compData.bridgeIndex;
            if (index == null) return;

            const bridgeData = (bridgeSnap.exists() ? bridgeSnap.data() : {}) as any;

            const typeArr = upsertArray<string>(
            bridgeData.type as string[] | undefined,
            index,
            type,
            ""
            );

            tx.update(compRef, { type });
            tx.update(bridgeRef, { type: typeArr });
        });
    }


    return { component, layers, loading, error, toggleOnOff, changePowerLimit, changeName, changeType };
}