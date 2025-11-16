# LokalNett Setup Guide

This guide will help you set up LokalNett from scratch.

## Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)
- A Supabase account (free tier is sufficient)

## Step-by-Step Setup

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/PKprog2/Lokalnett.git
cd Lokalnett
npm install
```

### 2. Create Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Fill in project details:
   - Name: LokalNett (or your preferred name)
   - Database Password: Generate a strong password
   - Region: Choose closest to your users
5. Wait for project to be created (1-2 minutes)

### 3. Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. In your Supabase project dashboard:
   - Go to Settings → API
   - Copy the "Project URL" (starts with https://)
   - Copy the "anon public" key

3. Update `.env` file:
```
VITE_SUPABASE_URL=your-project-url-here
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set Up Database

1. In your Supabase project, go to the SQL Editor
2. Open `DATABASE_SCHEMA.md` in this repository
3. Copy and execute each section in order:
   - **profiles table** - User profiles
   - **bygder table** - Communities
   - **bygd_members table** - Community memberships
   - **bygd_roles table** - Eiere/moderatorer per bygd
   - **posts table** - User posts
   - **likes table** - Post likes
   - **comments table** - Post comments
   - **direct_conversations table** - Parring av to brukere før en chat
   - **direct_messages table** - Selve meldingene i samtalene
   - **Triggers** - For automatic count updates
   - **Storage buckets** - For media and avatars

4. Verify tables are created:
   - Go to Table Editor
   - You should see: profiles, bygder, bygd_members, posts, likes, comments, direct_conversations, direct_messages

5. Verify storage buckets:
   - Go to Storage
   - You should see: media, avatars

### 5. Configure Email (Optional but Recommended)

By default, Supabase sends confirmation emails. To customize:

1. Go to Authentication → Email Templates
2. Customize the confirmation email template
3. Add your branding and Norwegian text

For production:
1. Go to Settings → Auth
2. Configure SMTP settings with your email provider
3. This ensures emails come from your domain

### 6. Enable Social Login Providers (Optional)

1. Go to Authentication → Providers in the Supabase dashboard
2. Enable **Google**, **Azure (Microsoft)** and **Apple**
3. For each provider, set the Redirect URL to:
   - Development: `http://localhost:5173/bygder`
   - Production: `https://din-domene.no/bygder` (or tilsvarende)
4. Fill inn klient-ID og klienthemmelighet som du får fra Google Cloud Console, Azure App Registrations og Apple Developer Portal
5. Klikk Save – deretter kan brukere trykke på knappene i påloggingsvinduet

### 7. Run Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173

### 8. Test the Application

1. **Register a new user**:
   - Click "Trenger du en konto? Registrer deg"
   - Fill in display name, email, and password
   - Check your email for confirmation link (check spam folder)
   - Click confirmation link

2. **Create a bygd**:
   - After logging in, click "+ Opprett ny bygd"
   - Enter bygd name (e.g., "Bjørkelangen")
   - Add a description
   - Click "Opprett bygd"

3. **Create a post**:
   - Click on your newly created bygd
   - Type a message in the text area
   - Optionally upload an image or video
   - Click "Publiser"

4. **Test engagement**:
   - Like your post by clicking the heart icon
   - Add a comment

5. **Test direktemeldinger**:
   - Hold musepekeren over navnet til en annen bruker i feeden og klikk «Meld»
   - Sjekk at innboksen (øverst til høyre) viser samtalen og at meldinger kan sendes begge veier

### 9. Build for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` folder.

### 10. Deploy to Production

**Option A: Vercel (Recommended)**
```bash
npm install -g vercel
vercel
```

**Option B: Netlify**
1. Build: `npm run build`
2. Deploy the `dist/` folder to Netlify

**Option C: Any static host**
- Build: `npm run build`
- Upload contents of `dist/` folder to your web host

**Important**: Remember to set environment variables in your hosting provider:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Troubleshooting

### "Email not confirmed" error
- Check your email (including spam folder) for confirmation link
- In Supabase dashboard: Authentication → Users → Click on user → Send confirmation email

### Can't see other users' bygder
- This is by design - you can only see bygder you're a member of
- Users need to be invited or join bygder to see them

### Images/videos not uploading
- Check file size (max 50MB)
- Verify storage buckets are created with correct policies
- Check browser console for errors

### "Invalid API key" error
- Verify `.env` file exists and has correct values
- Check that you're using the "anon public" key, not the service role key
- Restart dev server after changing `.env`

### Database errors
- Ensure all SQL scripts from DATABASE_SCHEMA.md were executed
- Check Table Editor to verify all tables exist
- Verify RLS policies are enabled (they should show as enabled with green checkmarks)

## Security Notes

1. **Never commit `.env` file** - It's in `.gitignore` for safety
2. **Use strong passwords** - For both Supabase and user accounts
3. **Enable email confirmation** - Already configured in the app
4. **Row Level Security** - Automatically enforces privacy between bygder
5. **HTTPS in production** - Most hosting providers enable this by default

## Adding New Features

### To add a new field to profiles:
1. Add column in Supabase Table Editor
2. Update `src/contexts/AuthContext.jsx` to include in sign up
3. Update `src/pages/Login.jsx` to add input field

### To add notifications:
1. Create `notifications` table in Supabase
2. Use Supabase Realtime for live updates
3. Add notification UI component

### To add search:
1. Use Supabase full-text search
2. Add search bar component
3. Create search API calls

## Support

For issues or questions:
1. Check `README.md` for general information
2. Check `DATABASE_SCHEMA.md` for database details
3. Review Supabase documentation at https://supabase.com/docs
4. Open an issue in the GitHub repository

## License

MIT - See LICENSE file for details
