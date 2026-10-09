import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RegisterStepDone({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="size-9" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Account created!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome to StriveBet. Your account is ready — make a deposit to start betting.
        </p>
      </div>
      <Button onClick={onContinue} className="h-11 w-full text-base">
        Continue
      </Button>
    </div>
  );
}
