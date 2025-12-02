export type RawLevel  = "RL1" | "RL2" | "RL3" | "RL4";
export type ProcLevel = "PL1" | "PL2" | "PL3" | "PL4" | "PL5";
export type Resolution = "minute" | "hour" | "3hour" | "day";

export interface ComponentInfo {
    socket: number;
    isLimited: boolean;
    powerLimit: number;
    isOn: boolean;
}

export interface ComponentStruct {
    id?: string;
    name: string;
    type: string;
    info: ComponentInfo;
    summary?: {
        duration: number[];       // hours
        usedPower: number[];      // kWh
        hasTripped: boolean[];
        numTripped: number[];
        averageUsage: number[];   // W
        peakUsage: number[];      // W
    };
    meta?: {
        createdAt: number;        // epoch ms
        updatedAt: number;        // epoch ms
    };
}

export interface RawBase {
    ts: number;
    arus: number;
    "daya-aktif": number;
    "daya-kompleks": number
    "daya-reaktif": number;
    "faktor-daya": number;
    "harmonik-arus": number;
    "harmonik-tegangan": number;
    tegangan: number;
    isOn: boolean;
    tripped: boolean;
    "energi-aktif-Wh": number;
}

export interface RawMinuteDoc extends RawBase {
    layer: "RL1";
    resolution: "minute";
    periodMinutes: 1;
}
export interface RawHourDoc extends RawBase {
    layer: "RL2";
    resolution: "hour";
    periodMinutes: 60;
}
export interface Raw3HourDoc extends RawBase {
    layer: "RL3";
    resolution: "3hour";
    periodMinutes: 180;
}
export interface RawDayDoc extends RawBase {
    layer: "RL4";
    resolution: "day";
    periodMinutes: 1440;
}

export interface ProcessedBase {
    ts: number;         // epoch ms; start of the period
    duration: number;   // hours ON in this period (e.g., 1 for full hour)
    usedPower: number;  // kWh in this period
    hasTripped: boolean;
    numTripped: number;
    averageUsage: number; // W
    peakUsage: number;    // W
}