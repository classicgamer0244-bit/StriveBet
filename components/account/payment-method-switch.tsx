"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PROVIDERS = ["MTN Mobile Money", "Vodafone Cash", "AirtelTigo Money"];

export function PaymentMethodSwitch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
        Switch
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PROVIDERS.map((p) => (
          <DropdownMenuItem key={p} onClick={() => onChange(p)} disabled={p === value}>
            {p}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
