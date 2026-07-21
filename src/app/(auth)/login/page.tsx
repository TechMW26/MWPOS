"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneInput } from "@/components/ui/phone-input";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { getFirebaseAuth } from "@/lib/db/client";

type LoginStep = "phone" | "code";

function firebaseErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  switch (code) {
    case "auth/invalid-phone-number":
    case "auth/missing-phone-number":
      return "Enter a valid phone number with its country code.";
    case "auth/invalid-verification-code":
      return "That verification code is incorrect.";
    case "auth/code-expired":
    case "auth/session-expired":
      return "The code has expired. Please request a new one.";
    case "auth/too-many-requests":
    case "auth/quota-exceeded":
      return "Too many attempts. Please wait before trying again.";
    case "auth/captcha-check-failed":
    case "auth/missing-app-credential":
    case "auth/invalid-app-credential":
      return "reCAPTCHA verification failed. Please try again.";
    case "auth/app-not-authorized":
    case "auth/operation-not-allowed":
      return "Phone sign-in is not enabled for this Firebase project.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase Authentication.";
    case "auth/billing-not-enabled":
      return "Firebase SMS requires billing to be enabled for this project.";
    case "auth/network-request-failed":
      return "Firebase could not be reached. Check your connection and try again.";
    default:
      return "Unable to verify this phone number. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const phone = useMemo(() => `${countryCode} ${phoneDigits}`, [countryCode, phoneDigits]);

  const isSuperadminPhone = useMemo(() => {
    const configuredPhone = process.env.NEXT_PUBLIC_SUPERADMIN_PHONE;
    if (!configuredPhone) return false;
    try {
      return normalizePhoneNumber(phone) === normalizePhoneNumber(configuredPhone);
    } catch {
      return false;
    }
  }, [phone]);

  useEffect(() => () => recaptchaRef.current?.clear(), []);
  useEffect(() => {
    if (!isSuperadminPhone) setPassword("");
  }, [isSuperadminPhone]);

  function handlePhoneChange(digits: string, code: string) {
    setPhoneDigits(digits);
    setCountryCode(code);
  }

  async function signInSuperadmin() {
    if (!password) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/superadmin-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to sign in");
      router.replace(data.redirectTo || "/superadmin/dashboard");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  async function sendCode() {
    setError("");

    let phoneNumber: string;
    try {
      phoneNumber = normalizePhoneNumber(phone);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Enter a valid phone number");
      return;
    }

    setNormalizedPhone(phoneNumber);
    setStep("code");
    setCode("");
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      auth.useDeviceLanguage();
      recaptchaRef.current?.clear();
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });

      confirmationRef.current = await signInWithPhoneNumber(auth, phoneNumber, recaptchaRef.current);
    } catch (sendError) {
      const firebaseCode = typeof sendError === "object" && sendError && "code" in sendError ? String(sendError.code) : "unknown";
      console.error("[Firebase Phone Auth] SMS request failed:", firebaseCode);
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setError(`${firebaseErrorMessage(sendError)} You can still enter the verification code or change the phone number.`);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (code.length !== 6 || !normalizedPhone) return;
    setError("");
    setLoading(true);

    try {
      const masterResponse = await fetch("/api/auth/firebase-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, otp: code }),
      });
      const masterData = await masterResponse.json();
      if (masterResponse.ok) {
        router.replace(masterData.redirectTo ?? "/storefront/dashboard");
        router.refresh();
        return;
      }
      if (!masterData.useFirebase) throw new Error(masterData.message ?? "Unable to start your session");
      if (!confirmationRef.current) throw new Error("SMS delivery could not be confirmed. Use the master code or request a new OTP.");

      const credential = await confirmationRef.current.confirm(code);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/firebase-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to start your session");

      router.replace(data.redirectTo ?? "/storefront/dashboard");
      router.refresh();
    } catch (verifyError) {
      const message = verifyError instanceof Error && !verifyError.message.startsWith("Firebase:")
        ? verifyError.message
        : firebaseErrorMessage(verifyError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function editPhone() {
    confirmationRef.current = null;
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
    setStep("phone");
    setCode("");
    setError("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">MW-POS</CardTitle>
          <CardDescription>
            {step === "phone" ? "Sign in with your phone number" : `Enter the code sent to ${normalizedPhone}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === "phone" ? (
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">Phone number</label>
              <PhoneInput
                id="phone"
                value={phoneDigits}
                countryCode={countryCode}
                onChange={handlePhoneChange}
                onEnter={() => !loading && phoneDigits && (isSuperadminPhone ? signInSuperadmin() : sendCode())}
                autoFocus
              />
              {isSuperadminPhone ? (
                <div className="space-y-2 pt-2">
                  <label htmlFor="password" className="text-sm font-medium">Superadmin password</label>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && password && !loading && signInSuperadmin()}
                      className="pl-10"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Superadmin authentication uses your configured password.</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">We’ll send a 6-digit verification code by SMS.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="otp" className="text-sm font-medium">Verification code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(event) => event.key === "Enter" && code.length === 6 && !loading && verifyCode()}
                  className="pl-10 text-center text-xl tracking-[0.35em]"
                  autoFocus
                />
              </div>
              <button type="button" onClick={editPhone} className="inline-flex items-center text-sm font-medium text-primary hover:underline">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Change phone number
              </button>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </CardContent>

        <CardFooter>
          {step === "phone" ? (
            <Button id="send-otp-button" className="w-full" onClick={isSuperadminPhone ? signInSuperadmin : sendCode} disabled={loading || !phoneDigits || (isSuperadminPhone && !password)}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isSuperadminPhone ? "Signing in..." : "Sending code..."}</> : <>{isSuperadminPhone ? "Sign In as Superadmin" : "Send Verification Code"}<ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          ) : (
            <Button className="w-full" onClick={verifyCode} disabled={loading || code.length !== 6}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : <>Verify &amp; Sign In<ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          )}
        </CardFooter>
      </Card>
      <button id="recaptcha-container" type="button" tabIndex={-1} className="sr-only" aria-hidden="true" />
    </div>
  );
}
