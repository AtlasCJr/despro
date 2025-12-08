import "./notifications.scss"

import { useMemo, useState } from "react"
import { RightAngle } from "../assets/icons"
import { useNotificationData } from "../hooks/useNotificationData"
import { notificationTypeMap } from "../hooks/notifstruct"

const mapDay = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ] as const;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function toJsDate(d: any): Date {
    if (!d) return new Date(NaN);

    // Firestore Timestamp
    if (typeof d?.toDate === "function") {
        return d.toDate(); // already correct instant
    }

    // Strings / numbers / Date
    return new Date(d);   // JS will respect Z or +07:00 if present
}



function formatDate(dateLike: any): string {
    const date = toJsDate(dateLike);

    const dateStrWib = date.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
    });
    const nowStrWib = new Date().toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
    });

    const isToday = dateStrWib === nowStrWib;

    return isToday
        ? date.toLocaleTimeString("id-ID", {
              timeZone: "Asia/Jakarta",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
          })
        : date.toLocaleDateString("id-ID", {
              timeZone: "Asia/Jakarta",
              day: "numeric",
              month: "short",
          });
}


export default function Notifications() {
    const [isActive, setActive] = useState<number | string>("");
    const [showNotif, setShowNotif] = useState<boolean[]>([true, true, true]);

    const types = useMemo(() => ["Normal", "Critical", "Warning"] as const, []);
    const infoTypes = useMemo(() => ["Monitor", "Configuration", "Network", "Others"] as const, []);


    const notifType = [0, 1, 2] as const;

    const notifOpts = useMemo(
        () => ({
            sinceTs: Date.now() - 90 * 24 * 60 * 60 * 1000,
            order: "desc" as const,
            limit: 50,
            // types: [...types],
            // infoTypes: [...infoTypes],
            // isRead: false,
        }),
        [types, infoTypes]
    );

    const {notifications, unreadCount, loading, error, markRead, markAllRead, remove, removeAll } = useNotificationData(notifOpts);

    function changeShowNotif(x: number) {
        setShowNotif((prev) => {
            const next = [...prev];
            next[x] = !next[x];
            return next;
        });
    }

    async function handleClick(index: number) {
        const n = notifications[index];
        if (!n) return;

        // Toggle accordion (use id for stability if list changes)
        setActive((prev) => (prev !== n.id ? n.id : ""));

        // If unread, mark as read in Firestore (the hook’s query will then drop it from view)
        if (!n.isRead) {
            try {
                await markRead(n.id, true);
            } catch (e) {
                console.error("markRead failed:", e);
            }
        }
    }

  return (
        <div className="notifications">
            <h1>Notifications</h1>

            <div className="toolbar">
                {loading ? <span className="muted">Loading…</span> : null}
                {error ? <span className="error">Error: {String((error as any)?.message || error)}</span> : null}
                <span className="badge">Unread: {unreadCount === 0 ? "None" : unreadCount}</span>
                <button
                    className="mark-all"
                    disabled={!notifications.length}
                    onClick={() => markAllRead()}
                    title="Mark page as read"
                >
                    Mark all as read
                </button>
                <button
                    className="delete-all"
                    disabled={!notifications.length}
                    onClick={() => removeAll()}
                    title="Delete all"
                >
                    Delete all
                </button>
            </div>

            <div className="container">
                <div className="filter">
                <div
                    className={showNotif[0] ? "on" : ""}
                    onClick={() => changeShowNotif(0)}
                    role="button"
                >
                    <h3 style={{color: "grey"}}>Normal</h3>
                </div>

                <div
                    className={showNotif[1] ? "on" : ""}
                    onClick={() => changeShowNotif(1)}
                    role="button"
                >
                    <h3 style={{color: "rgba(224, 191, 41, 1)"}}>Warning</h3>
                </div>

                <div
                    className={showNotif[2] ? "on" : ""}
                    onClick={() => changeShowNotif(2)}
                    role="button"
                >
                    <h3 style={{color: "red"}}>Critical</h3>
                </div>
                </div>

                <div className="content">
                    {notifications.map((data, index) => {
                        const typeIdx = notifType.indexOf(data.type as (typeof notifType)[number]);
                        if (typeIdx === -1 || !showNotif[typeIdx]) return null;

                        const opened = isActive === data.id;
                        const date = toJsDate(data.date);

                        return (
                            <div key={data.id} className={`accordion ${opened ? "active" : ""}`}>
                                <div
                                    className={`accordion-header ${data.isRead ? "read" : ""}`}
                                    onClick={() => handleClick(index)}
                                >
                                    <div className={`circle ${notificationTypeMap[data["type"]]}`}/>
                                    <div>
                                        <h3>{data["info-type"]}</h3>
                                    </div>

                                    <div>
                                        <h3>{data.name}</h3>
                                        <div />
                                    </div>

                                    <div>
                                        <h3>{formatDate(date)}</h3>
                                        <RightAngle />
                                    </div>
                                </div>

                                <div className="accordion-content">
                                    <h2>
                                        {`
                                            ${mapDay[date.getDay()]}, 
                                            ${date.getDate()} 
                                            ${date.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", month: "short" })} 
                                            ${date.getFullYear()}, 
                                            ${date.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,}).replaceAll('.', ':')}
                                        `}
                                    </h2>
                                    <p>{data.content}</p>

                                    <div className="row actions">
                                        <button onClick={() => markRead(data.id, true)} disabled={data.isRead}> Mark read </button>
                                        <button className="danger" onClick={() => remove(data.id)}> Delete </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {!loading && !error && notifications.length === 0 ? (
                        <div className="empty">No notifications match the current filter.</div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
