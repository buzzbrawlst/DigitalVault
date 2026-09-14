# DigitalVault

A clean shared file-vault frontend designed for GitHub Pages + cloud storage.

## Current build

- Responsive dark/glass UI
- Drag & drop uploads
- Multi-file selection
- Search
- Sorting by newest, oldest, name and size
- File type/size metadata
- Local browser-session downloads for selected files

## Shared storage

GitHub Pages is static hosting, so actual uploaded files and shared metadata should live in a storage/database service rather than inside the Git repository.

Planned production setup:

- **GitHub** — source code and deployment
- **Supabase Storage** — uploaded file bytes
- **Supabase Postgres** — file metadata
- **Supabase RLS** — access rules

Never put a Supabase service-role key in browser code. The public/anonymous client key is suitable for frontend use when the database and storage policies are configured correctly.

## Deploying

Enable GitHub Pages for the repository's `main` branch and root folder. The site will then be served from `index.html`.

## Next step

Create a Supabase project, configure a storage bucket and `files` table, then connect those values in `app.js` so uploads and metadata become shared between visitors.
