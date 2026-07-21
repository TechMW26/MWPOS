# Deployment Guide

## Vercel Deployment

MW-POS is fully Vercel-compatible.

### Steps

1. **Push to GitHub** — Create a repository and push the code.

2. **Import to Vercel** — From the Vercel dashboard, import the repository.

3. **Configure Build Settings:**
   - Framework: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

4. **Set Environment Variables** in Vercel project settings (all from `.env.example`):

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=<your-key>
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://<project>.firebaseio.com
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<project>.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
   NEXT_PUBLIC_FIREBASE_APP_ID=<app-id>
   
   FIREBASE_ADMIN_PROJECT_ID=<project-id>
   FIREBASE_ADMIN_CLIENT_EMAIL=<service-account-email>
   FIREBASE_ADMIN_PRIVATE_KEY=<private-key>
   
   SESSION_SECRET=<random-64-char-string>
   SEED_SUPERADMIN_PHONE=<E.164-phone-number>
   NEXT_PUBLIC_SUPERADMIN_PHONE=<same-E.164-phone-number>
   SUPERADMIN_PASSWORD=<strong-unique-password>
   
   SMTP_HOST=<smtp-host>
   SMTP_PORT=587
   SMTP_USER=<smtp-user>
   SMTP_PASS=<smtp-pass>
   SMTP_FROM=noreply@mxpos.app
   
   NEXT_PUBLIC_APP_NAME=MW-POS
   NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
   ```

5. **Deploy** — Trigger the first deploy. Vercel will build and deploy automatically.

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication → Sign-in method → Phone**
3. Enable **Realtime Database** (NOT Firestore)
4. Generate a service account key from Project Settings → Service Accounts
5. Copy the private key into `FIREBASE_ADMIN_PRIVATE_KEY` (with `\n` newlines)
6. Deploy RTDB rules: `npx firebase deploy --only database`

### Domain & SSL

- Vercel provides automatic SSL via Let's Encrypt
- Set `NEXT_PUBLIC_APP_URL` to your production domain
- Add the domain to Firebase Authentication → Authorized Domains

### Post-Deployment

1. Run the seed script against production database (carefully):
   ```bash
   npm run seed
   ```
2. Sign in using the configured superadmin phone and server-side password

### Emulator Development

```bash
# Start all emulators
npx firebase emulators:start --project demo-mxpos

# In another terminal
npm run dev

# Seed data into emulators
npm run seed

# Run emulator tests
npm run test:emulators
```

### Environment Check

The following must be configured for production:

- [ ] Firebase project with RTDB enabled
- [ ] Service account with RTDB read/write access
- [ ] Firebase Phone Authentication enabled
- [ ] Production and local domains authorized in Firebase Authentication
- [ ] Firebase test phone numbers configured for non-production testing
- [ ] `SESSION_SECRET` set (64+ random characters)
- [ ] All `NEXT_PUBLIC_*` variables for client-side Firebase init
- [ ] Domain authorized in Firebase Auth
