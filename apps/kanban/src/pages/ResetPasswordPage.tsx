import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { verifyResetToken, useResetPassword } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LayoutDashboard, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token") ?? "";

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const resetPasswordMutation = useResetPassword();

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setError("No reset token provided. Please request a new password reset link.");
      return;
    }

    verifyResetToken(token)
      .then((res) => {
        setTokenValid(true);
        setTargetEmail(res.email);
      })
      .catch((err) => {
        setTokenValid(false);
        setError(err instanceof Error ? err.message : "Invalid or expired reset link");
      })
      .finally(() => {
        setChecking(false);
      });
  }, [token]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    resetPasswordMutation.mutate(
      { token, newPassword: password },
      {
        onSuccess: () => {
          setResetDone(true);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to reset password");
        },
      },
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-foreground">Kanban</span>
        </div>

        <div className="bg-card border border-card-border rounded-2xl shadow-lg p-8">
          {checking ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying reset link...</p>
            </div>
          ) : resetDone ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Password reset!</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Your password has been successfully updated. You can now sign in with your new password.
                </p>
              </div>
              <Button
                className="w-full mt-2"
                onClick={() =>
                  setLocation(`/?reset=success${targetEmail ? `&email=${encodeURIComponent(targetEmail)}` : ""}`)
                }
              >
                Continue to sign in
              </Button>
            </div>
          ) : !tokenValid ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Invalid or expired link</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {error || "This password reset link is invalid or has expired. Links are valid for 1 hour."}
                </p>
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setLocation("/?mode=forgot")}
              >
                Request a new link
              </Button>
              <button
                type="button"
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
                onClick={() => setLocation("/")}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-foreground mb-1">Create new password</h1>
              <p className="text-sm text-muted-foreground mb-6">
                {targetEmail
                  ? `Choose a new password for ${targetEmail}`
                  : "Enter your new password below"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-new-password">Confirm new password</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Resetting password...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </Button>
              </form>

              <p className="text-sm text-muted-foreground text-center mt-6">
                <button
                  type="button"
                  className="inline-flex items-center text-xs text-primary font-medium hover:underline"
                  onClick={() => setLocation("/")}
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Cancel and return to sign in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
