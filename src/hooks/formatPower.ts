export function formatPower(x: number, unit: string) {
    // Determine prefix list based on unit type
    const prefixes = [
        { value: 1e6, suffix: "M" },
        { value: 1e3, suffix: "k" },
    ];

    for (const p of prefixes) {
        if (x >= p.value) {
            return `${(x / p.value).toFixed(1)} ${p.suffix}${unit}`;
        }
    }

    // no prefix needed (less than 1000)
    return `${Number(x).toFixed(2)} ${unit}`;
}
