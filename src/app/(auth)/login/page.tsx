"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <main className="relative isolate min-h-dvh overflow-hidden bg-[#071a45] text-white">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_5%,rgba(59,130,246,0.38),transparent_36%),linear-gradient(160deg,#071a45_10%,#0b2f74_58%,#1456c7_100%)]" />
      <div aria-hidden="true" className="absolute -right-24 top-24 h-64 w-64 rounded-full border border-white/10" />
      <div aria-hidden="true" className="absolute -left-32 top-8 h-72 w-72 rounded-full border border-white/10" />

      <header className="relative flex min-h-[42dvh] flex-col items-center px-6 pb-28 pt-[max(3rem,env(safe-area-inset-top))] text-center sm:justify-center sm:pb-44">
        <div className="mb-5 rounded-[2rem] border border-white/30 bg-white/95 p-1.5 shadow-2xl shadow-blue-950/40">
          <Image src="/MW_POS.png" alt="MW-POS" width={104} height={104} className="h-24 w-24 rounded-[1.65rem] object-contain" priority />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-100">MW FutureTech</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">MW-POS</h1>
        <p className="mt-2 max-w-xs text-sm leading-6 text-blue-100/90">Simple, secure distribution management for every role.</p>
      </header>

      <section className="animate-sheet-up absolute inset-x-0 bottom-0 z-10 mx-auto max-h-[76dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-slate-950 shadow-[0_-24px_70px_rgba(2,8,23,0.28)] sm:bottom-6 sm:max-w-lg sm:rounded-[2rem] sm:px-8 sm:pb-7">
        <div aria-hidden="true" className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {step === "phone" ? "Secure sign in" : "OTP verification"}
            </span>
            <ShieldCheck className="h-5 w-5 text-emerald-600" aria-label="Secure authentication" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{step === "phone" ? "Welcome back" : "Check your messages"}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {step === "phone" ? "Enter your registered phone number to continue." : `Enter the 6-digit code sent to ${normalizedPhone}.`}
          </p>
        </div>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (step === "code") verifyCode();
            else if (isSuperadminPhone) signInSuperadmin();
            else sendCode();
          }}
        >
          {step === "phone" ? (
            <div className="space-y-3">
              <label htmlFor="phone" className="text-sm font-semibold text-slate-700">Phone number</label>
              <PhoneInput
                id="phone"
                value={phoneDigits}
                countryCode={countryCode}
                onChange={handlePhoneChange}
                className="[&_input]:h-12 [&_input]:rounded-xl [&_select]:h-12 [&_select]:rounded-xl"
                autoFocus
              />
              {isSuperadminPhone ? (
                <div className="animate-in space-y-2 pt-1">
                  <label htmlFor="password" className="text-sm font-semibold text-slate-700">Administrator password</label>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-12 rounded-xl pl-10"
                      autoFocus
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">A secure verification code will be sent by SMS.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <label htmlFor="otp" className="text-sm font-semibold text-slate-700">Verification code</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-14 rounded-xl pl-10 text-center text-xl font-semibold tracking-[0.4em]"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <button type="button" onClick={editPhone} className="inline-flex items-center font-semibold text-blue-700 hover:text-blue-800">
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Change number
                </button>
                <button type="button" onClick={sendCode} disabled={loading} className="font-semibold text-blue-700 hover:text-blue-800 disabled:opacity-50">Resend code</button>
              </div>
            </div>
          )}

          {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}

          <Button
            id={step === "phone" ? "send-otp-button" : undefined}
            type="submit"
            className="h-12 w-full rounded-xl text-base font-semibold shadow-lg shadow-blue-600/20"
            disabled={loading || (step === "phone" ? !phoneDigits || (isSuperadminPhone && !password) : code.length !== 6)}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{step === "code" ? "Verifying..." : isSuperadminPhone ? "Signing in..." : "Sending code..."}</>
            ) : (
              <>{step === "code" ? "Verify & Sign In" : isSuperadminPhone ? "Sign In as Superadmin" : "Continue with phone"}<ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </form>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Protected by Firebase phone authentication
        </p>
      </section>
      <button id="recaptcha-container" type="button" tabIndex={-1} className="sr-only" aria-hidden="true" />
    </main>
  );
}
