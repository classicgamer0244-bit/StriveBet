"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import type { Gender } from "@/types";

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  "prefer-not-to-say": "Prefer not to say",
};

export function AccountInfoCard() {
  const { user, admin, isBusy, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [gender, setGender] = useState<Gender>(user?.gender ?? "prefer-not-to-say");

  if (!user && !admin) return null;

  // Staff accounts have no firstName/lastName/gender to edit here — their
  // profile fields (displayName, email, phone) are managed at creation, not
  // through this player-shaped form. Just show what a bettor would want to
  // see: identity, currency, balance.
  if (admin) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h1 className="mb-3 text-lg font-bold text-foreground">My Account Info</h1>
        <div>
          <ReadOnlyRow label="Name" value={admin.displayName} />
          <ReadOnlyRow label="Email" value={admin.email} />
          <ReadOnlyRow label="Mobile Number" value={admin.phone} />
          <ReadOnlyRow label="Role" value={admin.role === "superadmin" ? "Superadmin" : "Admin"} />
          <ReadOnlyRow label="Currency" value={admin.currency} />
          <ReadOnlyRow label="Balance" value={`${admin.currency} ${admin.balance.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        </div>
      </div>
    );
  }

  if (!user) return null;

  function startEditing() {
    setFirstName(user!.firstName ?? "");
    setLastName(user!.lastName ?? "");
    setEmail(user!.email ?? "");
    setGender(user!.gender ?? "prefer-not-to-say");
    setEditing(true);
  }

  async function handleSave() {
    await updateProfile({ firstName, lastName, email, gender });
    setEditing(false);
    toast.success("Profile updated.");
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">My Account Info</h1>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
            <Pencil className="size-3.5" />
            Edit Profile
          </Button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5">First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
            </div>
            <div>
              <Label className="mb-1.5">Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
            </div>
          </div>
          <div>
            <Label className="mb-1.5">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label className="mb-1.5">Gender</Label>
            <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
                  <SelectItem key={g} value={g}>
                    {GENDER_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ReadOnlyRow label="Mobile Number" value={`${user.countryCode} ${user.phone}`} />
          <ReadOnlyRow label="Country" value="Ghana" />

          <div className="mt-2 flex gap-2">
            <Button onClick={handleSave} disabled={isBusy} className="flex-1">
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={isBusy} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <ReadOnlyRow label="First Name" value={user.firstName || "—"} />
          <ReadOnlyRow label="Last Name" value={user.lastName || "—"} />
          <ReadOnlyRow label="Email" value={user.email || "—"} />
          <ReadOnlyRow label="Gender" value={user.gender ? GENDER_LABELS[user.gender] : "—"} />
          <ReadOnlyRow label="Mobile Number" value={`${user.countryCode} ${user.phone}`} />
          <ReadOnlyRow label="Country" value="Ghana" />
          <ReadOnlyRow label="Currency" value={user.currency} />
          <ReadOnlyRow label="Balance" value={`${user.currency} ${user.balance.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        </div>
      )}
    </div>
  );
}
