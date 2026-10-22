"use client";
// A USD amount shown in the visitor's display currency. Non-USD amounts are
// marked approximate, with the USD charge in the tooltip.
import useCurrency from "@/hooks/useCurrency";

export default function Money({ usd, prefix = "", cents = false, className }) {
  const { format, isUsd } = useCurrency();
  const exact = `$${Number(usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (isUsd) return <span className={className}>{prefix}{exact}</span>;
  return (
    <span className={className} title={`Charged in USD: ${exact}`}>
      {prefix}≈{format(usd, { cents })}
    </span>
  );
}
