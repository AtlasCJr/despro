import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where, limit as qlimit, QueryDocumentSnapshot, updateDoc } from "firebase/firestore";
import type { QueryConstraint, Unsubscribe } from "firebase/firestore";
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

        const next = !component.info.isOn

        await updateDoc(doc(db, "components", componentId), {
            "info.isOn": next,
        });
    }

    async function changePowerLimit(limit:number) {
        if (!componentId || !component?.info) return;

        if (limit === 0) {
            await updateDoc(doc(db, "components", componentId), {
                "info.isLimited": false,
            });
            await updateDoc(doc(db, "components", componentId), {
                "info.powerLimit": NaN,
            });
        } else {
            await updateDoc(doc(db, "components", componentId), {
                "info.isLimited": true,
            });
            await updateDoc(doc(db, "components", componentId), {
                "info.powerLimit": limit,
            });
        }
    }

    async function changeName(name:string) {
        if (!componentId || !component?.info) return;

        await updateDoc(doc(db, "components", componentId), {
            "name": name,
        });
    }

    async function changeType(type:string) {
        if (!componentId || !component?.info) return;

        await updateDoc(doc(db, "components", componentId), {
            "type": type,
        });
    }

    return { component, layers, loading, error, toggleOnOff, changePowerLimit, changeName, changeType };
}