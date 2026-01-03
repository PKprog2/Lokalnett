# LokalNett

LokalNett er et sosialt nettverk for små norske bygdesamfunn. Appen lar brukere registrere seg, bli med i lokale "bygder", og dele innlegg med tekst, bilder eller video. Hver bygd har sin egen private feed med likes og kommentarer. Brukere kan være medlemmer av flere bygder.

## Funksjoner

- ✅ **Brukerregistrering og autentisering** - Sikker pålogging med Supabase Auth
- ✅ **Bygd-administrasjon** - Opprett og bli med i lokale bygdesamfunn
- ✅ **Maks 1000 medlemmer per bygd** - Holder samfunnene små og lokale
- ✅ **Innleggsoppretting** - Del tekst, bilder og videoer
- ✅ **GIF-støtte** - Finn og legg til Giphy-GIFer direkte i innlegg og kommentarer
- ✅ **Direktemeldinger** - Start private 1-til-1-samtaler fra feeden med hoverknapp og egen innboks
- ✅ **Private feeds** - Hver bygd har sin egen feed
- ✅ **OAuth-pålogging** - Registrer deg med Google, Microsoft eller Apple på sekunder
- ✅ **Likes og kommentarer** - Engasjer med innhold fra bygdesamfunnet
- ✅ **Moderatorer og eiere** - Eiere kan utnevne moderatorer, fjerne medlemmer og holde innholdet ryddig
- ✅ **Tilpassede bygdebakgrunner** - Administratorer kan laste opp unike header-bilder per bygd
- ✅ **Mange-til-mange relasjoner** - Brukere kan være i flere bygder
- ✅ **Ingen algoritmer** - Kronologisk feed uten filtere
- ✅ **Reklamefritt** - Fokus på ekte lokal tilkobling

## Teknologi

- **Frontend**: React 19 med Vite
- **Backend**: Supabase (autentisering, database, lagring)
- **Routing**: React Router
- **Styling**: Inline CSS (enkel og lett vedlikeholdbar)

## Kom i gang

### Forutsetninger

- Node.js 18+ og npm
- En Supabase-konto og -prosjekt

### Installasjon

1. Klon repositoryet:
```bash
git clone https://github.com/PKprog2/Lokalnett.git
cd Lokalnett
```

2. Installer avhengigheter:
```bash
npm install
```

3. Opprett en `.env`-fil basert på `.env.example`:
```bash
cp .env.example .env
```

4. Oppdater `.env` med dine Supabase-legitimasjoner (og valgfritt en Giphy-nøkkel for GIF-søk):
```
VITE_SUPABASE_URL=din-supabase-url
VITE_SUPABASE_ANON_KEY=din-supabase-anon-key
VITE_GIPHY_API_KEY=din-giphy-api-nokkel
```

5. Sett opp database:
   - Gå til Supabase-dashboardet ditt
   - Åpne SQL Editor
   - Kjør SQL-skriptene fra `DATABASE_SCHEMA.md` for å opprette tabeller, policies, triggere og storage buckets

6. Start utviklingsserveren:
```bash
npm run dev
```

Appen vil kjøre på `http://localhost:5173`

## Databaseskjema

Se `DATABASE_SCHEMA.md` for fullstendig dokumentasjon av databasestrukturen, inkludert:
- Tabeller (profiles, bygder, bygd_members, posts, likes, comments)
   - Ekstra tabeller som `bygd_roles` for moderering og `direct_conversations`/`direct_messages` for chat
- Row Level Security (RLS) policies
- Triggere for automatisk oppdatering av tellere
- Storage buckets for medier og avatarer

## Prosjektstruktur

```
src/
├── components/         # Gjenbrukbare komponenter
│   ├── Comments.jsx    # Kommentarsystem
│   ├── CreatePost.jsx  # Opprett innlegg
│   └── Post.jsx        # Innleggsvisning
├── contexts/          # React contexts
│   └── AuthContext.jsx # Autentiseringskontekst
├── pages/             # Sidekomponenter
│   ├── BygdFeed.jsx    # Feed for en spesifikk bygd
│   ├── Bygder.jsx      # Oversikt over alle bygder
│   └── Login.jsx       # Pålogging/registrering
├── utils/             # Hjelpefunksjoner
│   └── supabaseClient.js # Supabase-klient
├── App.jsx            # Hovedappkomponent med routing
└── main.jsx           # Programinngang
```

## Skript

- `npm run dev` - Start utviklingsserver
- `npm run build` - Bygg for produksjon
- `npm run preview` - Forhåndsvis produksjonsbygg
- `npm run lint` - Kjør ESLint

## Funksjonalitet

### Brukerflyt

1. **Registrering/Pålogging**
   - Brukere kan registrere seg med e-post og passord
   - Velger et visningsnavn
   - E-postbekreftelse sendes via Supabase
   - Alternativt kan de logge inn med Google, Microsoft (Azure AD) eller Apple

2. **Bygd-administrasjon**
   - Opprett nye bygder med navn og beskrivelse
   - Bli med i eksisterende bygder (maks 1000 medlemmer)
   - Se alle bygder du er medlem av

3. **Innleggsoppretting**
   - Skriv tekstinnlegg
   - Last opp bilder, GIFer eller videoer (maks 50MB)
   - Søk etter GIFer via Giphy direkte i redigeringsvinduet
   - Innlegg vises i bygdens kronologiske feed

4. **Engasjement**
   - Lik innlegg
   - Kommenter på innlegg
   - Se antall likes og kommentarer

5. **Direktemeldinger**
   - Hold musepekeren over et visningsnavn i feeden eller kommentarer og klikk «Meld»
   - Åpner en privat samtale mellom deg og den andre brukeren
   - Bruk innboksknappen i brukermenyen for å se alle samtaler samlet i modalvinduet
   - Meldinger er kun synlige for deltakerne og sorteres kronologisk

6. **Bygd-moderering**
   - Eiere og moderatorer har et dedikert admin-panel i hver bygd
   - Eiere kan utnevne/fjerne moderatorer og kaste ut medlemmer
   - Moderatorer kan fjerne innlegg og kommentarer fra andre brukere ved regelbrudd
   - Admins kan oppdatere bakgrunnsbildet i toppen av bygda

### Sikkerhet

- **Row Level Security (RLS)**: Alle tabeller bruker RLS for å sikre at brukere bare kan se og endre data de har tillatelse til
- **Autentisering**: Supabase Auth håndterer sikker pålogging
- **Storage policies**: Medier lagres sikkert med tilgangskontroll

## Bidrag

Dette er et personlig prosjekt, men forslag og forbedringer er velkomne!

## Lisens

MIT

## Kontakt

For spørsmål eller tilbakemeldinger, vennligst opprett en issue i dette repositoryet.
