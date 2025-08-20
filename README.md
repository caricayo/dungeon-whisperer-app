# Dungeon Whisperer

AI-powered D&D companion app with multiplayer sessions and advanced storytelling.

## Release & Deployment Guide

### Prerequisites
- Node.js 20+
- npm 10+

### Local Development Setup

1. **Environment Configuration**:
   ```bash
   cp .env.example .env.local
   # Fill in your Supabase credentials in .env.local
   ```

2. **Install Dependencies**:
   ```bash
   npm ci
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

### Production Build

1. **Quality Checks**:
   ```bash
   npm ci
   npm run lint
   npm run typecheck
   npm run build
   ```

2. **Required Environment Variables**:
   - `VITE_SUPABASE_URL` - Your Supabase project URL (required)
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key (required)

3. **Preview Production Build**:
   ```bash
   npm run preview
   ```

### CI/CD Pipeline

The project uses GitHub Actions for continuous integration:

- **Triggers**: Push/PR to any branch
- **Steps**: install → lint → typecheck → test → build
- **Deploy**: Automatic deployment to GitHub Pages on main branch
- **Status**: CI must pass before merge

### Scripts Reference

- `npm run dev` - Start development server
- `npm run build` - Production build with typecheck
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint (allows warnings)
- `npm run typecheck` - TypeScript type checking
- `npm run test` - Run test suite

## Dependency Management

This project uses **pinned exact versions** for critical toolchain dependencies to ensure deterministic builds in CI/CD:

### Version Compatibility Matrix
- **ESLint 9.x** + **@typescript-eslint 8.x** + **TypeScript 5.x** (current setup)
- ESLint 8.56+ + @typescript-eslint 7.x + TypeScript 5.x
- ESLint 8.x + @typescript-eslint 6.x + TypeScript 4.x/5.x

### Why We Pin Versions
- Prevents `npm ci` failures from peer dependency conflicts
- Ensures consistent linting/building across all environments  
- Avoids version drift in CI that could break builds

### Updating Dependencies
When upgrading these tools:
1. Check the compatibility matrix above
2. Update `devDependencies` and `overrides` together
3. Test `npm ci && npm run lint && npm run build`
4. Regenerate `package-lock.json`

## Features

- AI-powered dungeon master
- Multiplayer sessions
- Real-time chat
- Character management
- Session history

## Tech Stack

- React + TypeScript
- Vite
- Supabase
- Tailwind CSS

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

Simply open [Lovable](https://lovable.dev/projects/9bcad246-cb76-4ca4-8a3d-34f2e06bb1ca) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
