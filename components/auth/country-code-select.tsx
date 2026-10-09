import { DEFAULT_COUNTRY_CODE, DEFAULT_COUNTRY_FLAG } from "@/lib/constants";

export function CountryCodeSelect() {
  return (
    <div className="flex h-11 w-[88px] shrink-0 items-center justify-center gap-1.5 rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm font-semibold text-foreground">
      <span>{DEFAULT_COUNTRY_FLAG}</span>
      <span>{DEFAULT_COUNTRY_CODE}</span>
    </div>
  );
}
