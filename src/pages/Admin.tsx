import { useState, useEffect } from "react";
import { ADMIN_PASSWORD } from "@/lib/constants";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock } from "lucide-react";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPTS_KEY = "adminLoginAttempts";
const LOCKOUT_KEY = "adminLockoutUntil";

/** Constant-time string comparison to mitigate timing side-channels */
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to avoid length-leak timing
    let dummy = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      dummy |= (a.charCodeAt(i % a.length) ?? 0) ^ (b.charCodeAt(i % b.length) ?? 0);
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function getRemainingLockout(): number {
  const until = Number(sessionStorage.getItem(LOCKOUT_KEY) ?? 0);
  return Math.max(0, until - Date.now());
}

function getAttempts(): number {
  return Number(sessionStorage.getItem(ATTEMPTS_KEY) ?? 0);
}

const Admin = () => {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(getRemainingLockout);

  // Tick down the lockout timer every second
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const id = setInterval(() => {
      const remaining = getRemainingLockout();
      setLockoutRemaining(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [lockoutRemaining]);

  const handleLogin = () => {
    if (getRemainingLockout() > 0) return; // still locked out

    if (safeEquals(password, ADMIN_PASSWORD)) {
      sessionStorage.removeItem(ATTEMPTS_KEY);
      sessionStorage.removeItem(LOCKOUT_KEY);
      setAuthed(true);
      setError(false);
    } else {
      const attempts = getAttempts() + 1;
      sessionStorage.setItem(ATTEMPTS_KEY, String(attempts));
      if (attempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        sessionStorage.setItem(LOCKOUT_KEY, String(until));
        setLockoutRemaining(LOCKOUT_MS);
      }
      setError(true);
    }
  };

  if (authed) return <AdminDashboard />;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm border-0 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Admin Access</CardTitle>
          <CardDescription>Enter the admin password to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lockoutRemaining > 0 ? (
            <p className="text-sm text-destructive text-center">
              Too many failed attempts. Try again in{" "}
              {Math.ceil(lockoutRemaining / 60000)} min.
            </p>
          ) : (
            <>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="h-12"
              />
              {error && (
                <p className="text-sm text-destructive">
                  Incorrect password.{" "}
                  {MAX_ATTEMPTS - getAttempts()} attempt{MAX_ATTEMPTS - getAttempts() !== 1 ? "s" : ""} remaining.
                </p>
              )}
              <Button className="w-full h-12 font-semibold" onClick={handleLogin}>
                Enter
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;
