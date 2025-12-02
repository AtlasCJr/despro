import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ComponentChart from "../assets/componentGraph";
import { useComponentBundle } from "../hooks/useComponentData";
import "./components.scss";

import { Num2Currency } from "../utils/Num2Currency";

import { RestartLogo, DeleteLogo, LimitLogo, PowerLogo } from "../assets/icons";

type Layer = "RL1" | "RL2" | "RL3" | "RL4" | "PL1" | "PL2" | "PL3" | "PL4" | "PL5";

const LAYER_BY_SCALE: Record<number, Layer> = {
    0: "RL1", // Today          -> Minutes 
    1: "RL2", // This Week      -> Hours
    2: "RL3", // This Month     -> 3-Hours
    3: "RL4", // This Year      -> Daily 
    4: "RL4", // All Time       -> Daily
}

const PROCESSED_LAYER_BY_SCALE: Record<number, Layer> = {
    0: "PL1", // Today          -> Minutes 
    1: "PL2", // This Week      -> Hours
    2: "PL3", // This Month     -> 3-Hours
    3: "PL4", // This Year      -> Daily 
    4: "PL5", // All Time       -> Daily
}

const ASSET_MAP: Record<number, string> = {
    0: "asset1",
    1: "asset2",
    2: "asset3",
    3: "asset4", 
    4: "asset5",
}


interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    customClassName?: string;  
}

function NoticePopup({ isOpen, onClose, children, customClassName }: ModalProps) {
    const prevOverflow = useRef<string | null>(null);
    const container = document.getElementById("modal-root") ?? document.body;

    useEffect(() => {
        if (!isOpen) return;
        
        prevOverflow.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        
        window.addEventListener("keydown", onKey);
        
        return () => {
            document.body.style.overflow = prevOverflow.current ?? "";
            window.removeEventListener("keydown", onKey);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className={`modal-backdrop${customClassName ? ` ${customClassName}` : ""}`} onMouseDown={onClose}>
            <div
                className="modal-panel"
                role="dialog"
                aria-modal="true"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        container
    );
}

export default function Components() {
    const [selected, setSelected] = useState<number>(0);
    const [scaleSelected, setScaleSelected] = useState<number>(0);
    const [toggleVar, setToggleVar] = useState<boolean[]>([true, true, false, false, false, false, false, false]);
    const [lastToggledAxis, setLastToggledAxis] = useState<number[]>([0, 1])

    const [errorMessageLimitingOn, toggleErrorMessageLimiting] = useState<boolean>(false)
    const [errorMessageLimiting, setErrorMessageLimiting] = useState<string>("")

    const activeLayer = useMemo<Layer>(() => LAYER_BY_SCALE[scaleSelected], [scaleSelected]);
    const activeProcessedLayer = useMemo<Layer>(() => PROCESSED_LAYER_BY_SCALE[scaleSelected], [scaleSelected]);
    const include = useMemo<Layer[]>(() => [activeLayer, activeProcessedLayer], [activeLayer, activeProcessedLayer]);
    const activeAsset = useMemo(() => ASSET_MAP[selected], [selected]);

    const { component, layers, loading, error, toggleOnOff, changePowerLimit, changeName, changeType } = useComponentBundle(activeAsset, {
        include: include,
        order: "asc",
        limitPerLayer: 1000
    });
    
    // if (component) console.log(component)
    // if (layers) console.log(layers)

    const [showPopup, setShowPopup] = useState([false, false, false, false]);
    const [tempName, setTempName] = useState<string>("");
    const [tempType, setTempType] = useState<string>("");
    const [tempLimit, setTempLimit] = useState(0);

    const RpPerkWh = 1699.53

    // inside Components()
    const processedRows = (layers?.[activeProcessedLayer] ?? []) as Array<Record<string, any>>;
    const plSummary = processedRows[0] ?? null; // if PL has a single summary doc

    // Optional fallbacks:
    const durationH   = plSummary?.duration ?? 0;        // hours
    const usedKWh     = plSummary?.usedPower ?? plSummary?.energy_kWh ?? 0;
    const avgKWh      = plSummary?.averageUsage ?? 0;    // Wh/h (or your schema)
    const peakKW      = plSummary?.peakUsage ?? 0;       // W
    const hasTripped  = !!plSummary?.hasTripped;
    const tripCount   = plSummary?.numTripped ?? 0;

    const maxSocket = 4

    // function changeScale(x: number) {
    //     setScaleSelected(x);
    // }

    function changeToggleVar(x: number) {
        setToggleVar((prev) => {
            const next = [...prev];
            next[x] = !next[x];
            return next;
        });
    }

    function changeToggleAxis(x: number) {
        setLastToggledAxis((prev) => {
            // clone previous list
            const history = [...prev];

            const idx = history.indexOf(x);

            if (idx !== -1) {
            // ---- axis currently active → turn OFF
            history.splice(idx, 1);
            } else {
            // ---- axis currently OFF → turn ON
            history.push(x);
            if (history.length > 2) history.pop(); // limit to 2
            }
            console.log(history)

            return history;
        });
    }

    return (
        <div className="components">
            <div className="card">
                <div
                    onClick={() => {
                        setToggleVar([true, true, false, false, false, false, false, false])
                        setLastToggledAxis([0, 1])
                        setScaleSelected(0)
                    }}
                >   
                    <div>
                        <div className={`${component?.info.isOn ? "on" : "off"}`} onClick={() => {toggleOnOff()}}>
                            <PowerLogo />
                        </div>
                    </div>
                    <div>
                        <div onClick={() => {setShowPopup([false, true, false, false])}}>
                            <LimitLogo />
                        </div>
                        
                        <NoticePopup customClassName="limit" isOpen={showPopup[1]} onClose={() => setShowPopup(Array(4).fill(false))}>
                            <h2><b>Change Power Limit</b></h2>
                            <p>
                                Change your power limit in Wh. Set to 0 if you want to remove the limit instead.
                            </p>

                            <p className={`error ${errorMessageLimitingOn ? "show" : ""}`}>
                                {errorMessageLimiting}
                            </p>

                            <div className="limit-input">
                                <input
                                    type="number"
                                    placeholder={String(component?.info.powerLimit ?? "")}
                                    value={tempLimit}
                                    onChange={(e) => setTempLimit(Number(e.target.value))}
                                />
                                <h2>Wh</h2>
                                <h2>=</h2>
                                <h2>{Num2Currency(tempLimit * RpPerkWh)}</h2>
                            </div>

                            <div className="modal-actions">
                                <button className="btn secondary" onClick={() => {
                                    setTempLimit(0);
                                    setShowPopup(Array(4).fill(false));
                                }}
                                > Cancel </button>
                                <button className="btn primary" onClick={() => {
                                    if(tempLimit < 0) {
                                        toggleErrorMessageLimiting(true)
                                        setErrorMessageLimiting("Number cannot be lower than 0!")
                                    } else if (Number.isNaN(tempLimit)) {
                                        toggleErrorMessageLimiting(true)
                                        setErrorMessageLimiting("Input is not a valid number!")
                                    }
                                    else {
                                        changePowerLimit(tempLimit)
                                        setTempLimit(0)
                                        setShowPopup(Array(4).fill(false));
                                    }
                                }}
                                > Change Limit </button>
                            </div>
                        </NoticePopup>
                    </div>

                    <div>
                        <div onClick={() => {setShowPopup([false, false, true, false])}}>
                            <DeleteLogo />
                        </div>

                        <NoticePopup customClassName="delete" isOpen={showPopup[2]} onClose={() => setShowPopup(Array(4).fill(false))}>
                            <h2><b>Confirm Deletion</b></h2>
                            <p>
                                Are you sure you want to delete all data from <b>{component?.name}</b>
                            </p>
                            <div className="modal-actions">
                                <button className="btn secondary" onClick={() => {
                                    // setTempName("");
                                    setShowPopup(Array(4).fill(false));
                                }}
                                > Cancel </button>
                                <button className="btn primary" onClick={() => {
                                    // componentData[selected].name = tempName
                                    // setTempName("")
                                    setShowPopup(Array(4).fill(false));
                                }}
                                > Delete </button>
                            </div>
                        </NoticePopup>
                    </div>

                    <RestartLogo />
                </div>

                <div>
                    <input
                        key={1}
                        type="text"
                        placeholder={loading ? "Loading...": component?.name}
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && tempName != component?.name) {
                                setShowPopup([false, false, false, true])
                                e.preventDefault();
                            }
                        }}
                        onBlur={() => {
                            if (tempName.trim() !== "") setShowPopup([false, false, false, true]);
                        }}
                    />

                    <NoticePopup customClassName="change-name" isOpen={showPopup[3]} onClose={() => setShowPopup(Array(4).fill(false))}>
                        <h2>Rename Component?</h2>
                        <p>
                            Change <b>{component?.name}</b> to <b>{tempName}</b>?
                        </p>
                        <div className="modal-actions change-name">
                            <button className="btn secondary" onClick={() => {
                                setTempName("");
                                setShowPopup(Array(4).fill(false));
                            }}
                            > Cancel </button>
                            <button className="btn primary" onClick={() => {
                                changeName(tempName)
                                setTempName("")
                                setShowPopup(Array(4).fill(false));
                                }}
                            > Change Name </button>
                        </div>
                    </NoticePopup>
                
                    <input
                        key={2}
                        type="text"
                        placeholder={loading ? "Loading...": component?.type}
                        value={tempType}
                        onChange={(e) => setTempType(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && tempType != component?.type) {
                                setShowPopup([true, false, false, false])
                                e.preventDefault();
                            }
                        }}
                        onBlur={() => {
                            if (tempName.trim() !== "") setShowPopup([true, false, false, false]);
                        }}
                    />

                    <NoticePopup customClassName="change-type" isOpen={showPopup[0]} onClose={() => setShowPopup(Array(4).fill(false))}>
                        <h2>Change Type?</h2>
                        <p>
                            Change <b>{component?.type}</b> to <b>{tempType}</b>?
                        </p>
                        <div className="modal-actions change-name">
                            <button className="btn secondary" onClick={() => {
                                setTempName("");
                                setShowPopup(Array(4).fill(false));
                            }}
                            > Cancel </button>
                            <button className="btn primary" onClick={() => {
                                changeType(tempType)
                                setTempType("")
                                setShowPopup(Array(4).fill(false));
                                }}
                            > Change Name </button>
                        </div>
                    </NoticePopup>
                </div>

                <div className="info">
                    <div>
                        <h4 className={`${scaleSelected === 0 ? "on" : ""}`} onClick={() => setScaleSelected(0)}>Today</h4>
                        <h4 className={`${scaleSelected === 1 ? "on" : ""}`} onClick={() => setScaleSelected(1)}>This Week</h4>
                        <h4 className={`${scaleSelected === 2 ? "on" : ""}`} onClick={() => setScaleSelected(2)}>This Month</h4>
                        <h4 className={`${scaleSelected === 3 ? "on" : ""}`} onClick={() => setScaleSelected(3)}>This Year</h4>
                        <h4 className={`${scaleSelected === 4 ? "on" : ""}`} onClick={() => setScaleSelected(4)}>All Time</h4>
                    </div>

                    <div>
                        <div>
                            <h3>Socket</h3>
                            <h3>{loading ? "Loading...": `# ${component?.info.socket}`}</h3>
                        </div>
                        <div>
                            <h3>Duration</h3>
                            <h3>{loading ? "Loading..." : `${Number(durationH).toFixed(1)} h`}</h3>
                        </div>
                        <div>
                            <h3>Used Energy</h3>
                            <h3>{loading ? "Loading..." : `${Number(usedKWh).toFixed(3)} Wh`}</h3>
                            <h3>{loading ? "Loading..." : Num2Currency(Number(usedKWh) * RpPerkWh)}</h3>
                        </div>
                        <div>
                            <h3>Average Usage</h3>
                            <h3>{loading ? "Loading..." : `${Number(avgKWh).toFixed(3)} Wh/h`}</h3>
                            <h3>{loading ? "Loading..." : Num2Currency(Number(avgKWh) * RpPerkWh)}</h3>
                        </div>
                        <div>
                            <h3>Peak Power</h3>
                            <h3>{loading ? "Loading..." : `${Number(peakKW).toFixed(3)} W`}</h3>
                        </div>
                        <div>
                            <h3>Limited</h3>
                            <h3>{loading ? "Loading..." : (component?.info.isLimited ? "Limited" : "Not Limited")}</h3>
                        </div>
                        <div>
                            <h3>Usage Limit</h3>
                            <h3>
                                {loading
                                    ? "Loading..."
                                    : (Number.isFinite(component?.info.powerLimit)
                                        ? component!.info.powerLimit + " Wh"
                                        : "-")}
                            </h3>
                                {loading ? "" : (Number.isFinite(component?.info?.powerLimit) && (
                                    <h3>{Num2Currency(Math.round(component?.info?.powerLimit as number * RpPerkWh))}</h3>
                                ))}
                        </div>
                        <div>
                            <h3>Has Tripped</h3>
                            <h3>{loading ? "Loading..." : (hasTripped ? "True" : "False")}</h3>
                        </div>
                        <div>
                            <h3>Trip Count</h3>
                            <h3>{loading ? "Loading..." : Number(tripCount)}</h3>
                        </div>
                        <div>
                            <h3>Status</h3>
                            <h3>{loading ? "Loading..." : (component?.info.isOn ? "On" : "Off")}</h3>
                        </div>
                    </div>
                </div>

                <div className="graph">
                    {loading ? (
                        <div className="skeleton">Loading chart...</div>
                    ) : layers[activeLayer].length > 0 ? (
                        <ComponentChart data={layers[activeLayer]} toggleVar={toggleVar} toggleAxis={lastToggledAxis} />
                    ) : !error  ? (
                        <div className="empty">Error in retrieving data from database.</div>
                    ): (
                        <div className="empty">No data available.</div>
                    ) 
                    }
                </div>

                <div className="show-graph">
                    <div>
                        <h3>Axis <a>(max. 2)</a></h3>
                        <div>
                            <h4 className={`${lastToggledAxis.indexOf(0) !== -1 ? "on" : ""}`} onClick={() => changeToggleAxis(0)}>Arus</h4>
                            <h4 className={`${lastToggledAxis.indexOf(1) !== -1 ? "on" : ""}`} onClick={() => changeToggleAxis(1)}>Tegangan</h4>
                            <h4 className={`${lastToggledAxis.indexOf(2) !== -1 ? "on" : ""}`} onClick={() => changeToggleAxis(2)}>Daya</h4>
                            <h4 className={`${lastToggledAxis.indexOf(3) !== -1 ? "on" : ""}`} onClick={() => changeToggleAxis(3)}>PF</h4>
                        </div>
                    </div>
                    <div>
                        <h3>Variable</h3>
                        <div>
                            <h4 className={`${toggleVar[0] ? "on" : ""}`} onClick={() => changeToggleVar(0)}>Arus</h4>
                            <h4 className={`${toggleVar[1] ? "on" : ""}`} onClick={() => changeToggleVar(1)}>Tegangan</h4>
                            <h4 className={`${toggleVar[2] ? "on" : ""}`} onClick={() => changeToggleVar(2)}>Daya Aktif</h4>
                            <h4 className={`${toggleVar[3] ? "on" : ""}`} onClick={() => changeToggleVar(3)}>Daya Reaktif</h4>
                            <h4 className={`${toggleVar[4] ? "on" : ""}`} onClick={() => changeToggleVar(4)}>Daya Kompleks</h4>
                            <h4 className={`${toggleVar[5] ? "on" : ""}`} onClick={() => changeToggleVar(5)}>Faktor Daya</h4>
                        </div>
                    </div>
                </div>
            </div>

            <div className="left">
                <div onClick={() => setSelected((prev) => (prev - 1 + maxSocket) % maxSocket)}>{"<"}</div>
            </div>

            <div className="right">
                <div onClick={() => setSelected((prev) => (prev + 1) % maxSocket)}>{">"}</div>
            </div>

            <div className="dots">
                {[...Array(maxSocket)].map((_, index) => (
                    <div
                        key={index}
                        className={`dot ${index === selected ? "selected" : ""}`}
                        onClick={() => setSelected(index)}
                    />
                ))}
            </div>
        </div>
    );
}
