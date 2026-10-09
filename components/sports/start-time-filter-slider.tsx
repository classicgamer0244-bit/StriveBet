"use client";

import { Slider } from "@/components/ui/slider";

const STEPS = ["1h", "3h", "6h", "24h", "All"] as const;
export type StartTimeStep = (typeof STEPS)[number];

export function StartTimeFilterSlider({
  value,
  onChange,
}: {
  value: StartTimeStep;
  onChange: (step: StartTimeStep) => void;
}) {
  const index = STEPS.indexOf(value);

  return (
    <div>
      <p className="mb-3 text-xs font-bold text-muted-foreground uppercase">Filter by start time</p>
      <Slider
        value={[index === -1 ? STEPS.length - 1 : index]}
        min={0}
        max={STEPS.length - 1}
        step={1}
        onValueChange={([i]) => onChange(STEPS[i])}
      />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        {STEPS.map((step) => (
          <span key={step} className={step === value ? "font-bold text-primary-600" : ""}>
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}
