import { useEffect, useRef, useState } from "react";
import { useMe, useUpdateProfile } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import NotificationBell from "@/components/NotificationBell";

export default function AccountPage() {
  const { data: user } = useMe();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const initializedUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (user && initializedUserIdRef.current !== user.id) {
      initializedUserIdRef.current = user.id;
      setFirstName(user.firstName);
      setLastName(user.lastName);
    }
  }, [user]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    updateProfile.mutate(
      { firstName: firstName.trim(), lastName: lastName.trim() },
      {
        onSuccess: () => toast({ title: "Profile updated" }),
        onError: (err) =>
          toast({
            title: err instanceof Error ? err.message : "Failed to update profile",
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-md">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">Account</h1>
            <p className="text-sm text-muted-foreground">
              Update your name shown on task assignments and team lists.
            </p>
          </div>
          <NotificationBell />
        </div>

        {user && (
          <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-card-border rounded-xl p-6">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="account-first">First name</Label>
                <Input
                  id="account-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-last">Last name</Label>
                <Input
                  id="account-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={
                updateProfile.isPending ||
                !firstName.trim() ||
                !lastName.trim() ||
                (firstName.trim() === user.firstName && lastName.trim() === user.lastName)
              }
            >
              {updateProfile.isPending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
