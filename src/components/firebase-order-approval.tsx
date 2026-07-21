"use client";

import { useEffect, useRef, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { getFirebaseAuth } from "@/lib/db/client";

export function FirebaseOrderApproval({ orderId, phone, onVerified }: { orderId: string; phone: string | null; onVerified: () => void }) {
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => () => recaptchaRef.current?.clear(), []);

  async function sendOtp() {
    if (!phone) {
      setError("The distributor phone number is not configured.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const auth = getFirebaseAuth();
      auth.useDeviceLanguage();
      recaptchaRef.current?.clear();
      recaptchaRef.current = new RecaptchaVerifier(auth, "send-order-otp-button", { size: "invisible" });
      confirmationRef.current = await signInWithPhoneNumber(auth, normalizePhoneNumber(phone), recaptchaRef.current);
      setOtpSent(true);
      setOtpCode("");
    } catch (sendError) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      const code = typeof sendError === "object" && sendError && "code" in sendError ? String(sendError.code) : "";
      setError(code === "auth/too-many-requests" || code === "auth/quota-exceeded"
        ? "Too many Firebase OTP requests. Please wait before trying again."
        : "Unable to send the Firebase OTP. Check the phone number and Firebase Phone Auth configuration.");
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp() {
    if (!confirmationRef.current || otpCode.length !== 6) {
      setError("Enter the 6-digit Firebase OTP.");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const credential = await confirmationRef.current.confirm(otpCode);
      const firebaseIdToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/orders/otp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, firebaseIdToken }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Firebase OTP verification failed");
      setSuccess(true);
      confirmationRef.current = null;
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      onVerified();
    } catch (verifyError) {
      const code = typeof verifyError === "object" && verifyError && "code" in verifyError ? String(verifyError.code) : "";
      setError(code === "auth/invalid-verification-code" ? "That Firebase OTP is incorrect."
        : code === "auth/code-expired" || code === "auth/session-expired" ? "The Firebase OTP expired. Request a new one."
        : verifyError instanceof Error ? verifyError.message : "Firebase OTP verification failed");
    } finally {
      setVerifying(false);
    }
  }

  if (success) return <div className="rounded-lg border border-green-300 bg-green-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-green-800"><CheckCircle2 className="h-4 w-4" />Order approved with Firebase OTP</p><p className="mt-1 text-xs text-green-700">The order is moving to the next approval stage.</p></div>;

  return <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
    <p className="flex items-center gap-2 text-sm font-semibold text-yellow-800"><KeyRound className="h-4 w-4" />Distributor approval OTP</p>
    <p className="mt-1 text-xs text-yellow-700">Review the products, quantities, and total above. Firebase will send the approval code to the registered phone{phone ? ` ending in ${phone.replace(/\D/g, "").slice(-4)}` : ""}.</p>
    {!otpSent ? <Button id="send-order-otp-button" className="mt-3" onClick={sendOtp} disabled={sending}>{sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{sending ? "Sending Firebase OTP…" : "Send approval OTP"}</Button>
      : <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input aria-label="Order approval OTP" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter 6-digit OTP" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} className="font-mono text-lg tracking-widest" disabled={verifying} /><Button onClick={verifyOtp} disabled={verifying || otpCode.length !== 6}>{verifying ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />}Verify order</Button><Button id="send-order-otp-button" variant="outline" onClick={sendOtp} disabled={sending}>{sending ? "Sending…" : "Resend"}</Button></div>}
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </div>;
}
