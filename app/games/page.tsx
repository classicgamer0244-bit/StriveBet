import { Gamepad2 } from "lucide-react";

export default function GamesPage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-background p-4 text-foreground">
      <h1 className="mb-4 text-xl font-extrabold">Games</h1>
      
      <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-border bg-card shadow-sm">
        <Gamepad2 className="mb-4 size-10 text-muted-foreground" />
        <p className="text-[15px] text-muted-foreground">Games are coming soon.</p>
      </div>
    </div>
  );
}
