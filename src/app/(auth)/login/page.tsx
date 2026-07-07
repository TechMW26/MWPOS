"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Mail, Phone, ArrowRight, Lock, KeyRound } from "lucide-react";

const SUPERADMIN_EMAIL = "aviraj.sharma@mushroomworldgroup.com";

export default function LoginPage() {
  const router = useRouter();
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [destination, setDestination] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPasswordMode, setIsPasswordMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-detect superadmin email — switch to password mode immediately
  useEffect(() => {
    if (destination.toLowerCase().trim() === SUPERADMIN_EMAIL) {
      setIsPasswordMode(true);
    } else if (isPasswordMode && destination.toLowerCase().trim() !== SUPERADMIN_EMAIL) {
      setIsPasswordMode(false);
    }
  }, [destination, isPasswordMode]);

  const handleRequestOtp = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, destination }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Failed to send code");
        return;
      }

      router.push(`/verify?challengeId=${data.challengeId}&channel=${channel}&destination=${encodeURIComponent(destination)}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: destination, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Login failed");
        return;
      }

      router.push(data.redirectTo ?? "/superadmin/dashboard");
    } catch (e: any) {
      if (e.name === "AbortError") {
        setError("Request timed out. Please check your connection and try again.");
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isPasswordMode) {
        handlePasswordLogin();
      } else {
        handleRequestOtp();
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">MW-POS</CardTitle>
          <CardDescription>
            {isPasswordMode ? "Administrator Login" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isPasswordMode && (
            <div className="flex gap-2">
              <Button
                variant={channel === "email" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setChannel("email")}
              >
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
              <Button
                variant={channel === "phone" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setChannel("phone")}
              >
                <Phone className="mr-2 h-4 w-4" />
                Phone
              </Button>
            </div>
          )}

          <div className="relative">
            {isPasswordMode ? (
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            ) : (
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
            <Input
              ref={inputRef}
              type="email"
              placeholder="you@example.com"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10"
              autoFocus
            />
          </div>

          {isPasswordMode && (
            <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={isPasswordMode ? handlePasswordLogin : handleRequestOtp}
            disabled={loading || destination.length < 3 || (isPasswordMode && password.length < 1)}
          >
            {loading
              ? "Please wait..."
              : isPasswordMode
                ? "Sign In"
                : "Send Verification Code"}
            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
