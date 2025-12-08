// useNotificationData.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, limit as qlimit, onSnapshot, orderBy, query, QueryConstraint, QueryDocumentSnapshot, startAfter, updateDoc, where, writeBatch, getDocs, type Unsubscribe } from "firebase/firestore";
import { db } from "../firebase";
import type { NotificationStruct } from "./notifstruct";


export type NotificationKind = 0 | 1 | 2;
export type NotificationInfoType = "Power Limit" | "Network" | "Monitor" | "Others" | "Configuration";


export interface UseNotificationOpts {
    /** Filter by created/occurred time (epoch ms) */
    sinceTs?: number;
    untilTs?: number;

    /** Filter by read status */
    isRead?: boolean;

    /** Filter by categories */
    types?: NotificationKind[]; // ["Alert", "Warning", "Normal"]
    infoTypes?: NotificationInfoType[]; // ["Monitor", "Network", ...]

    /** Sort & quantity */
    order?: "asc" | "desc";
    limit?: number;

    /** Pagination: pass the last doc id or snapshot to continue */
    cursorId?: string; // optional convenience—if provided, will startAfter that doc
}

type WithId<T> = T & { id: string };

function docsWithId<T>(docs: QueryDocumentSnapshot<T>[]) {
    return docs.map((d) => ({ id: d.id, ...d.data() })) as WithId<T>[];
}

/** Build Firestore constraints for notifications collection */
function buildConstraints(opts: UseNotificationOpts): QueryConstraint[] {
    const cs: QueryConstraint[] = [];

    // Equality / IN filters
    if (typeof opts.isRead === "boolean") cs.push(where("isRead", "==", opts.isRead));
    if (opts.types?.length) cs.push(where("type", "in", dedupe(opts.types).slice(0, 10)));
    if (opts.infoTypes?.length)
        cs.push(where("info-type", "in", dedupe(opts.infoTypes).slice(0, 10)));

    // Range filters on date (Timestamp)
    if (typeof opts.sinceTs === "number") cs.push(where("date", ">=", new Date(opts.sinceTs)));
    if (typeof opts.untilTs === "number") cs.push(where("date", "<=", new Date(opts.untilTs)));

    // Required order when using range filters
    cs.push(orderBy("date", opts.order === "asc" ? "asc" : "desc"));

    if (typeof opts.limit === "number") cs.push(qlimit(opts.limit));
    return cs;
}

function dedupe<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}


export function useNotificationData(opts: UseNotificationOpts = {}) {
    const [notifications, setNotifications] = useState<WithId<NotificationStruct>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const unsubsRef = useRef<Unsubscribe | null>(null);
    const constraints = useMemo(() => buildConstraints(opts), [
        opts.sinceTs,
        opts.untilTs,
        opts.isRead,
        JSON.stringify(opts.types || []),
        JSON.stringify(opts.infoTypes || []),
        opts.order,
        opts.limit,
    ]);

    useEffect(() => {
        setLoading(true);
        setError(null);

        // Cleanup old listener
        if (unsubsRef.current) {
            unsubsRef.current();
            unsubsRef.current = null;
        }

        const baseCol = collection(db, "notifications");
        // Optional cursor support by id: fetch the doc and use startAfter
        if (opts.cursorId) {
            // Lightweight helper: attach a one-time fetch for cursor and then bind live query
            const cursorDocRef = doc(db, "notifications", opts.cursorId);
            // Use a tiny once-off listener to grab the snapshot, then attach main listener
            const off = onSnapshot(cursorDocRef, (cursorSnap) => {
                off(); // stop this one-time listener
                const qMain = query(baseCol, ...constraints, startAfter(cursorSnap));
                unsubsRef.current = onSnapshot(
                qMain,
                    (snap) => {
                        const rows = docsWithId<NotificationStruct>(snap.docs as any);
                        setNotifications(rows);
                        setUnreadCount(rows.reduce((a, n) => a + (n.isRead ? 0 : 1), 0));
                        setLoading(false);
                    },
                    (err) => {
                        setError(err);
                        setLoading(false);
                    }
                );
            });
        } else {
            const qMain = query(baseCol, ...constraints);
            unsubsRef.current = onSnapshot(
                qMain,
                (snap) => {
                    const rows = docsWithId<NotificationStruct>(snap.docs as any);
                    setNotifications(rows);
                    setUnreadCount(rows.reduce((a, n) => a + (n.isRead ? 0 : 1), 0));
                    setLoading(false);
                },
                (err) => {
                    setError(err);
                    setLoading(false);
                }
            );
        }

    return () => {
        if (unsubsRef.current) {
            unsubsRef.current();
            unsubsRef.current = null;
        }
        };
    }, [opts.cursorId, constraints]);

    /** ── Actions (fire-and-forget) ──────────────────────────────────────── */

    async function markRead(id: string, read = true) {
        await updateDoc(doc(db, "notifications", id), { isRead: read });
    }

    async function markAllRead(ids?: string[]) {
        let targetIds: string[];

        if (ids && ids.length) {
            // explicit list – keep current behaviour
            targetIds = ids;
        } else {
            // 🔴 NEW: query ALL unread notifications from Firestore
            const qUnread = query(
                collection(db, "notifications"),
                where("isRead", "==", false)
            );
            const snap = await getDocs(qUnread);
            targetIds = snap.docs.map((d) => d.id);
        }

        const batchSize = 400;
        for (let i = 0; i < targetIds.length; i += batchSize) {
            const chunk = targetIds.slice(i, i + batchSize);
            const b = writeBatch(db);
            chunk.forEach((nid) => {
                b.update(doc(db, "notifications", nid), { isRead: true });
            });
            await b.commit();
        }
    }

    async function remove(id: string) {
        await deleteDoc(doc(db, "notifications", id));
    }

    async function removeAll(ids?: string[]) {
        let targetIds: string[];

        if (ids && ids.length) {
            // If caller passes an explicit list, use that
            targetIds = ids;
        } else {
            // Otherwise: delete ALL notifications in the collection
            const snap = await getDocs(collection(db, "notifications"));
            targetIds = snap.docs.map((d) => d.id);
        }

        const batchSize = 400; // stay under Firestore 500 limit
        for (let i = 0; i < targetIds.length; i += batchSize) {
            const chunk = targetIds.slice(i, i + batchSize);
            const b = writeBatch(db);
            chunk.forEach((nid) => {
                b.delete(doc(db, "notifications", nid));
            });
            await b.commit();
        }
    }

    return {
        notifications,
        unreadCount,
        loading,
        error,
        markRead,
        markAllRead,
        remove,
        removeAll
    };
}
