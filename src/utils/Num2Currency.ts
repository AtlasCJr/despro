export function Num2Currency(val: number, cur: string = "Rp. "): string {
    if (isNaN(val)) return cur + "0";
    
    // Round to 2 decimals and format using Indonesian locale
    const formatted = val.toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });

    return cur + formatted;
}