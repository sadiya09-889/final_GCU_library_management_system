# Welcome to your Lovable project

## Supabase Login Setup (Admin and Librarian)

To log in using these accounts:

- Admin: `admin@gcu.edu.in` / `admin123`
- Librarian: `librarian@gcu.edu.in` / `lib123`

you must connect this app to your Supabase project and create those users in Supabase Auth.

1. Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

2. Run the SQL schema in [supabase_setup.sql](supabase_setup.sql) in Supabase SQL Editor.

Important:
- Do not run `SELECT auth.create_user(...)` in SQL Editor. Hosted Supabase projects do not expose that function, and it fails with `ERROR: 42883`.
- Create auth users using either the seed script below or Supabase Dashboard -> Authentication -> Users -> Add user.

3. Create auth users (admin/librarian) with the seed script:

```sh
npm run seed:users -- <SUPABASE_URL> <SERVICE_ROLE_KEY>
```

Example:

```sh
npm run seed:users -- https://abcxyz.supabase.co eyJ...service_role_key...
```

Get `SERVICE_ROLE_KEY` from Supabase Dashboard -> Project Settings -> API -> `service_role`.

After this, you can log in from the app at `/login` using the admin and librarian credentials above.

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
