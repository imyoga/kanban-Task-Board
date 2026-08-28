import { useEffect, useState } from "react";
import { useLogin, useSignup, fetchInvitePreview } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LayoutDashboard } from "lucide-react";

type AuthMode = "login" | "signup";

function getInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const invite = params.get("invite");
  const email = params.get("email");
  return { invite, email };
}

export default function LoginPage() {
  const urlInvite = getInviteFromUrl();
  const [mode, setMode] = useState<AuthMode>(urlInvite.invite ? "signup" : "login");
  const [email, setEmail] = useState(urlInvite.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [inviteToken, setInviteToken] = useState(urlInvite.invite ?? "");
  const [inviteTeamName, setInviteTeamName] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);
  const [error, setError] = useState("");
  const login = useLogin();
  const signup = useSignup();

  const isPending = login.isPending || signup.isPending;
  const isSignup = mode === "signup";

  useEffect(() => {
    if (!urlInvite.invite) return;

    fetchInvitePreview(urlInvite.invite)
      .then((preview) => {
        setEmail(preview.email);
        setInviteToken(preview.token);
        setInviteTeamName(preview.teamName);
        setEmailLocked(true);
        setMode("signup");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Invalid invitation");
      });
  }, [urlInvite.invite]);

  function switchMode(next: AuthMode) {
    if (emailLocked) return;
    setMode(next);
    setError("");
    setConfirmPassword("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (isSignup && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (isSignup && (!firstName.trim() || !lastName.trim())) {
      setError("First and last name are required");
      return;
    }

    if (isSignup) {
      signup.mutate(
        {
          email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          inviteToken: inviteToken || undefined,
        },
        {
          onError: (err) =>
            setError(err instanceof Error ? err.message : "Sign up failed"),
        },
      );
      return;
    }

    login.mutate(
      { email, password },
      {
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Login failed"),
      },
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-foreground">Kanban</span>
        </div>

        <div className="bg-card border border-card-border rounded-2xl shadow-lg p-8">
          <h1 className="text-lg font-semibold text-foreground mb-1">
            {isSignup ? "Create account" : "Sign in"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {inviteTeamName
              ? `Join team "${inviteTeamName}" on Kanban`
              : isSignup
                ? "Sign up to start organizing your tasks"
                : "Enter your credentials to continue"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus={!isSignup}
                required
                readOnly={emailLocked}
                className={emailLocked ? "bg-muted" : undefined}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={isSignup ? 6 : undefined}
                required
              />
            </div>

            {isSignup && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isSignup ? "Creating account..." : "Signing in..."}
                </>
              ) : isSignup ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline disabled:opacity-50"
                  onClick={() => switchMode("login")}
                  disabled={emailLocked}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => switchMode("signup")}
                >
                  Sign up
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
