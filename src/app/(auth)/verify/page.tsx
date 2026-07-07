"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();

  const challengeId = params.get("challengeId") ?? "";
  const channel = params.get("channel") ?? "email";
  const destination = params.get("destination") ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Verification failed");
        return;
      }

      router.push(data.redirectTo ?? "/storefront/catalog");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Verify Code</CardTitle>
        <CardDescription>
          Enter the 6-digit code sent to {destination || "you"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          className="text-center text-2xl tracking-widest"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && code.length === 6 && handleVerify()}
          autoFocus
        />
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
        >
          {loading ? "Verifying..." : "Verify & Sign In"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
        <VerifyForm />
      </Suspense>
    </div>
  );
}
