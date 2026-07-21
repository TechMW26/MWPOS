"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, LockKeyhole, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { getFirebaseAuth } from "@/lib/db/client";

const COUNTRY_CODES: { code: string; name: string; flag: string }[] = [
  { code: "+91", name: "India", flag: "🇮🇳" },
  { code: "+1", name: "United States", flag: "🇺🇸" },
  { code: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+86", name: "China", flag: "🇨🇳" },
  { code: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "+33", name: "France", flag: "🇫🇷" },
  { code: "+81", name: "Japan", flag: "🇯🇵" },
  { code: "+7", name: "Russia", flag: "🇷🇺" },
  { code: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "+971", name: "UAE", flag: "🇦🇪" },
  { code: "+966", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+65", name: "Singapore", flag: "🇸🇬" },
  { code: "+60", name: "Malaysia", flag: "🇲🇾" },
  { code: "+63", name: "Philippines", flag: "🇵🇭" },
  { code: "+92", name: "Pakistan", flag: "🇵🇰" },
  { code: "+880", name: "Bangladesh", flag: "🇧🇩" },
  { code: "+94", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "+977", name: "Nepal", flag: "🇳🇵" },
];

function validatePhoneDigits(digits: string, countryCode: string): string | null {
  if (!digits) return "Phone number is required";
  if (!/^\d+$/.test(digits)) return "Phone number can only contain digits";

  switch (countryCode) {
    case "+91":
      if (digits.length !== 10) return "Indian numbers must be 10 digits";
      if (!/^[6-9]/.test(digits)) return "Indian numbers must start with 6, 7, 8, or 9";
      break;
    case "+1":
      if (digits.length !== 10) return "US numbers must be 10 digits";
      break;
    default:
      if (digits.length < 7 || digits.length > 14) return "Phone number must be 7–14 digits";
  }
  return null;
}

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
      return "reCAPTCHA verification failed. Please try again.";
    case "auth/operation-not-allowed":
      return "Phone sign-in is not enabled for this Firebase project.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase Authentication.";
    default:
      return "Unable to verify this phone number. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
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

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, "");
    setPhoneDigits(digits);
    setPhoneError(validatePhoneDigits(digits, countryCode));
  }

  function handleCountryChange(code: string) {
    setCountryCode(code);
    setPhoneError(validatePhoneDigits(phoneDigits, code));
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

    const digitsError = validatePhoneDigits(phoneDigits, countryCode);
    if (digitsError) {
      setPhoneError(digitsError);
      return;
    }

    let phoneNumber: string;
    try {
      phoneNumber = normalizePhoneNumber(phone);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      auth.useDeviceLanguage();
      recaptchaRef.current?.clear();
      recaptchaRef.current = new RecaptchaVerifier(auth, "send-otp-button", {
        size: "invisible",
      });

      confirmationRef.current = await signInWithPhoneNumber(auth, phoneNumber, recaptchaRef.current);
      setNormalizedPhone(phoneNumber);
      setStep("code");
      setCode("");
    } catch (sendError) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setError(firebaseErrorMessage(sendError));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (!confirmationRef.current || code.length !== 6) return;
    setError("");
    setLoading(true);

    try {
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
              <div className="flex gap-2">
                <Select
                  value={countryCode}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-[130px] shrink-0"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </Select>
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="98765 43210"
                    value={phoneDigits}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !loading && !phoneError && phoneDigits && (isSuperadminPhone ? signInSuperadmin() : sendCode())}
                    className={`pl-10 ${phoneError ? "border-destructive" : ""}`}
                    autoFocus
                  />
                </div>
              </div>
              {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
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
            <Button id="send-otp-button" className="w-full" onClick={isSuperadminPhone ? signInSuperadmin : sendCode} disabled={loading || !phoneDigits || !!phoneError || (isSuperadminPhone && !password)}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isSuperadminPhone ? "Signing in..." : "Sending code..."}</> : <>{isSuperadminPhone ? "Sign In as Superadmin" : "Send Verification Code"}<ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          ) : (
            <Button className="w-full" onClick={verifyCode} disabled={loading || code.length !== 6}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : <>Verify &amp; Sign In<ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
