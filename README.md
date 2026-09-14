# DigitalVault

A polished shared file vault built for GitHub Pages + Supabase.

## What is already built

- Dark/glass DigitalVault UI
- Drag & drop uploads
- Multi-file selection
- Shared cloud uploads through Supabase Storage
- Shared file metadata through Supabase Postgres
- Search
- Sorting by newest, oldest, name and size
- Image previews
- Video previews
- Audio file cards
- File type and size information
- Download links
- Uploader names
- 100 MB frontend upload limit
- No public delete policy

## 1. Create Supabase project

Create a project at Supabase and open its SQL Editor.

Run **`supabase-schema.sql`** from this repository.

Then create a Storage bucket:

1. Storage -> New bucket
2. Name it exactly `files`
3. Make it **Public**
4. Set a sensible file-size limit such as 100 MB

The SQL file creates the database table and storage read/upload policies. It intentionally does not give anonymous users delete permission.

## 2. Add the Supabase public keys

Open `config.js` and replace:

```js
SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co'
SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY'
```

Find these in Supabase under **Project Settings -> API**.

Use the **anon/public** key only. Never put the `service_role` key in this repository.

## 3. Deploy with GitHub Pages

In GitHub:

**Settings -> Pages -> Deploy from a branch -> main -> /(root) -> Save**

After GitHub finishes deploying, open the generated Pages URL.

## How the live vault works

The GitHub repository stores the website code. Supabase stores the actual uploaded files and their metadata. This means a file uploaded by one visitor can appear in the vault for other visitors.

The browser asks for an uploader name the first time someone uploads and remembers that name locally.

## Security note

This is an MVP shared vault. Because anonymous uploads are enabled, add authentication, moderation and server-side abuse/rate limits before using it for sensitive or high-traffic public uploads. The public delete policy is intentionally disabled.
