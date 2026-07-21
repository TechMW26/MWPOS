import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { setSessionCookie } from "@/lib/auth/session";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-auth";
import { buildSessionData, findOrCreateUserByPhone } from "@/lib/services/user-service";
import { redirectPathForRole } from "@/lib/auth/authorization";

const exchangeSchema = z.object({
  idToken: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const parsed = exchangeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "A Firebase ID token is required" }, { status: 400 });
    }

    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(parsed.data.idToken, true);
    if (decodedToken.firebase.sign_in_provider !== "phone" || !decodedToken.phone_number) {
      return NextResponse.json({ message: "Phone verification is required" }, { status: 401 });
    }

    const phone = normalizePhoneNumber(decodedToken.phone_number);
    const user = await findOrCreateUserByPhone({
      phone,
      firebaseUid: decodedToken.uid,
    });

    if (!user.isActive) {
      return NextResponse.json({ message: "Account has been deactivated. Contact support." }, { status: 403 });
    }

    await setSessionCookie(await buildSessionData(user));

    return NextResponse.json({
      user: {
        uid: user.uid,
        phone: user.phone,
        displayName: user.displayName,
        role: user.role,
      },
      redirectTo: redirectPathForRole(user.role),
    });
  } catch (error) {
    console.error("Firebase phone login failed:", error);
    return NextResponse.json(
      { message: "Phone verification failed. Please request a new code." },
      { status: 401 }
    );
  }
}
