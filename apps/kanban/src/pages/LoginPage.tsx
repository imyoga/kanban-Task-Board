import { useEffect, useState } from "react";
import { useLogin, useSignup, useForgotPassword, fetchInvitePreview } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LayoutDashboard, CheckCircle2, Mail, ArrowLeft } from "lucide-react";

type AuthMode = "login" | "signup" | "forgot";

function getInitialStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const invite = params.get("invite");
  const email = params.get("email") ?? "";
  const modeParam = params.get("mode");
  const resetSuccess = params.get("reset") === "success";

  let initialMode: AuthMode = "login";
  if (invite) {
    initialMode = "signup";
  } else if (modeParam === "forgot") {
    initialMode = "forgot";
  }

  return { invite, email, initialMode, resetSuccess };
}

export default function LoginPage() {
  const urlState = getInitialStateFromUrl();
  const [mode, setMode] = useState<AuthMode>(urlState.initialMode);
  const [email, setEmail] = useState(urlState.email);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [inviteToken, setInviteToken] = useState(urlState.invite ?? "");
  const [inviteTeamName, setInviteTeamName] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);
  const [error, setError] = useState("");
  const [resetSuccessAlert, setResetSuccessAlert] = useState(urlState.resetSuccess);
  const [forgotEmailSent, setForgotEmailSent] = useState(false);

  const login = useLogin();
  const signup = useSignup();
  const forgotPassword = useForgotPassword();

  const isPending = login.isPending || signup.isPending || forgotPassword.isPending;
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  useEffect(() => {
    if (!urlState.invite) return;

    fetchInvitePreview(urlState.invite)
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
  }, [urlState.invite]);

  function switchMode(next: AuthMode) {
    if (emailLocked && next !== "signup") return;
    setMode(next);
    setError("");
    setConfirmPassword("");
    setResetSuccessAlert(false);
    setForgotEmailSent(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResetSuccessAlert(false);

    if (isForgot) {
      if (!email.trim()) {
        setError("Please enter your email address");
        return;
      }

      forgotPassword.mutate(email.trim(), {
        onSuccess: () => {
          setForgotEmailSent(true);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to request password reset");
        },
      });
      return;
    }

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
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-foreground">Kanban</span>
        </div>

        <div className="bg-card border border-card-border rounded-2xl shadow-lg p-8">
          {resetSuccessAlert && (
            <div className="mb-6 flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Password reset successfully! Please sign in with your new password.</span>
            </div>
          )}

          {isForgot && forgotEmailSent ? (
            <div className="text-center py-2 space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Check your email</h1>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  If an account exists for <strong className="text-foreground">{email}</strong>, you will receive an email with instructions to reset your password.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  The link will expire in 1 hour. Be sure to check your spam or promotions folder.
                </p>
              </div>
              <Button
                className="w-full mt-2"
                onClick={() => switchMode("login")}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-foreground mb-1">
                {isForgot
                  ? "Reset your password"
                  : isSignup
                    ? "Create account"
                    : "Sign in"}
              </h1>
              <p className="text-sm text-muted-foreground mb-6">
                {isForgot
                  ? "Enter your email and we'll send you a link to reset your password."
                  : inviteTeamName
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
                    autoComplete="email"
                    autoFocus={!isSignup}
                    required
                    readOnly={emailLocked}
                    className={emailLocked ? "bg-muted" : undefined}
                  />
                </div>

                {!isForgot && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {!isSignup && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline font-medium"
                          onClick={() => switchMode("forgot")}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={isSignup ? "new-password" : "current-password"}
                      minLength={isSignup ? 6 : undefined}
                      required
                    />
                  </div>
                )}

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
                      {isForgot
                        ? "Sending link..."
                        : isSignup
                          ? "Creating account..."
                          : "Signing in..."}
                    </>
                  ) : isForgot ? (
                    "Send reset link"
                  ) : isSignup ? (
                    "Create account"
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <div className="text-sm text-muted-foreground text-center mt-6">
                {isForgot ? (
                  <button
                    type="button"
                    className="inline-flex items-center text-xs text-primary font-medium hover:underline"
                    onClick={() => switchMode("login")}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    Back to sign in
                  </button>
                ) : isSignup ? (
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
