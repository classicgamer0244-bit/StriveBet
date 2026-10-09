import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 6,
  };
}

export function isPasswordValid(password: string) {
  return password.length >= 6;
}

function ChecklistItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs", met ? "text-success" : "text-muted-foreground")}>
      {met ? <Check className="size-3.5 shrink-0" /> : <Circle className="size-3.5 shrink-0" />}
      {label}
    </div>
  );
}

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <div className="pt-1">
      <ChecklistItem met={password.length >= 6} label="At least 6 characters" />
    </div>
  );
}
