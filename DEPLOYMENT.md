# Deployment Guide

## GitHub Pages Deployment

This project is configured for automated deployment to GitHub Pages using GitHub Actions.

### Prerequisites

1. **GitHub Repository Setup**
   - Create a new repository on GitHub
   - Push your code to the main branch

2. **GitHub Pages Configuration**
   - Go to Settings → Pages in your repository
   - Select "GitHub Actions" as the source

3. **Environment Variables**
   - Go to Settings → Secrets and variables → Actions
   - Add the following repository secrets:
     - `VITE_SUPABASE_URL`: Your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Configuration Files

The following files have been configured for GitHub deployment:

- **`.github/workflows/deploy.yml`**: GitHub Actions workflow
- **`vite.config.ts`**: Updated with proper base path
- **`package.json`**: Updated with homepage field

### Deployment Process

1. **Automatic Deployment**
   - Push changes to the main branch
   - GitHub Actions will automatically build and deploy
   - Site will be available at: `https://[username].github.io/dungeon-whisperer/`

2. **Manual Deployment**
   - Go to Actions tab in your repository
   - Select the "Deploy to GitHub Pages" workflow
   - Click "Run workflow"

### Troubleshooting

#### Common Issues

1. **404 Errors**
   - Ensure the base path in `vite.config.ts` matches your repository name
   - Verify GitHub Pages is enabled and configured correctly

2. **Environment Variable Errors**
   - Check that all required secrets are set in repository settings
   - Verify secret names match exactly (case-sensitive)

3. **Build Failures**
   - Review the Actions logs for specific error messages
   - Ensure all dependencies are properly listed in package.json
   - Check that tests pass locally before pushing

#### Deployment Checklist

- [ ] Repository created and code pushed
- [ ] GitHub Pages enabled with "GitHub Actions" source
- [ ] Required secrets added to repository settings
- [ ] Homepage URL updated in package.json (replace "username" with your GitHub username)
- [ ] Base path in vite.config.ts matches repository name

### Local Testing

To test the production build locally:

```bash
# Build the project
npm run build

# Preview the production build
npm run preview
```

### Environment Variables

Required environment variables for deployment:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous public key
- `VITE_APP_ENV`: Set to "production" for production builds
- `VITE_DEBUG_MODE`: Set to "false" for production
- `VITE_DEMO_MODE`: Set to "false" for production

### Security Notes

- Only `VITE_` prefixed environment variables are exposed to the client
- Server-side API keys should be stored in Supabase Edge Function secrets
- Never commit actual API keys to the repository
- Use proper CORS configuration for production domains

### Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file to the `public/` directory with your domain
2. Configure DNS settings with your domain provider
3. Update the homepage field in package.json
4. Update CORS settings in Supabase for your custom domain