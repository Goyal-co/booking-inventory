/** Mirror of @booking/validators amountToIndianWords — keep pdf package lean. */
export function amountToIndianWords(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(String(amount).replace(/[, ]/g, "")) : Number(amount);
  if (!Number.isFinite(n) || n < 0) return "";
  const rupees = Math.floor(n);
  if (rupees === 0) return "Zero Rupees Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const twoDigits = (num: number) => {
    if (num < 20) return ones[num] ?? "";
    const t = Math.floor(num / 10);
    const o = num % 10;
    return `${tens[t]}${o ? ` ${ones[o]}` : ""}`.trim();
  };

  const threeDigits = (num: number) => {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    if (h && rest) return `${ones[h]} Hundred ${twoDigits(rest)}`;
    if (h) return `${ones[h]} Hundred`;
    return twoDigits(rest);
  };

  const crore = Math.floor(rupees / 1_00_00_000);
  const lakh = Math.floor((rupees % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((rupees % 1_00_000) / 1_000);
  const hundred = rupees % 1_000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  return `${parts.join(" ").replace(/\s+/g, " ").trim()} Rupees Only`;
}
