# Deployment Documentation

## Overview

CabinetPro Web is a client-side application that can be deployed to any static hosting service.

## Build Process

### Development Build
```bash
npm run dev
```
Runs at http://localhost:5173 with hot reload

### Production Build
```bash
npm run build
```
Creates optimized build in `dist/` directory

### Preview Production Build
```bash
npm run preview
```
Runs the production build locally for testing

## Deployment Options

### 1. GitHub Pages

#### Setup
1. Build the application:
```bash
npm run build
```

2. Deploy to GitHub Pages:
```bash
# Install gh-pages if not already installed
npm install -D gh-pages

# Deploy
npx gh-pages -d dist
```

3. Configure repository settings:
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: gh-pages

#### Base URL Configuration
Update `vite.config.ts`:
```typescript
export default defineConfig({
  base: '/webxplusx/', // Repository name
  // ...
});
```

### 2. Netlify

#### Automatic Deployment
1. Connect repository to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`

#### netlify.toml
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 3. Vercel

#### Automatic Deployment
1. Connect repository to Vercel
2. Framework preset: Vite
3. Build command: `npm run build`
4. Output directory: `dist`

#### vercel.json
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 4. Docker

#### Dockerfile
```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### nginx.conf
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Build and Run
```bash
docker build -t cabinetpro-web .
docker run -p 8080:80 cabinetpro-web
```

### 5. Static File Hosting

Any static file hosting service:
- AWS S3 + CloudFront
- Google Cloud Storage
- Azure Blob Storage
- Firebase Hosting

Simply upload the `dist/` directory contents.

## Environment Variables

The application doesn't require environment variables for basic operation.

### Optional Variables
```bash
# .env.example
VITE_API_URL=https://api.example.com  # For future cloud features
VITE_ANALYTICS_ID=UA-XXXXXXXX         # For analytics
```

## Browser Compatibility

### Supported Browsers
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Required Features
- IndexedDB support
- ES2020 JavaScript features
- CSS Grid and Flexbox
- Web Fonts (Vazirmatn)

## Performance Optimization

### Build Optimizations
- Tree shaking (unused code removal)
- Code splitting (lazy loading)
- Asset optimization (minification, compression)
- Source maps (for debugging)

### Runtime Optimizations
- IndexedDB for fast local storage
- Efficient React rendering
- Optimized re-renders with memoization
- Debounced calculations

### Performance Metrics
- Initial load: < 200 KB (gzipped)
- Time to interactive: < 2 seconds
- Lighthouse score: 90+ (target)

## Security Considerations

### Client-Side Only
- No server-side code
- All data stored locally in IndexedDB
- No authentication required
- No API keys exposed

### Content Security Policy
Add CSP headers in hosting configuration:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;
```

### HTTPS
Always deploy with HTTPS enabled to protect user data.

## Monitoring

### Error Tracking
Consider adding:
- Sentry for error tracking
- LogRocket for session replay
- Google Analytics for usage metrics

### Performance Monitoring
- Lighthouse CI for performance regression testing
- Web Vitals tracking (LCP, FID, CLS)

## Backup and Recovery

### User Data
User projects are stored in IndexedDB:
- Users can export projects as JSON
- Import feature available for backup restoration
- No server-side backup (client-side only)

### Recommended User Workflow
1. Regularly export projects
2. Store exports in cloud storage (Google Drive, Dropbox)
3. Import when switching browsers or devices

## Updates and Maintenance

### Version Updates
1. Update version in `package.json`
2. Run tests: `npm test`
3. Build: `npm run build`
4. Deploy to hosting service
5. Update documentation

### Dependency Updates
```bash
# Check for outdated packages
npm outdated

# Update packages
npm update

# For major updates
npm install package@latest
```

## Troubleshooting

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Runtime Errors
- Check browser console for errors
- Verify IndexedDB is supported
- Check network connectivity for fonts
- Verify browser compatibility

### Deployment Issues
- Verify build output exists in `dist/`
- Check hosting service configuration
- Verify file permissions
- Check for CORS issues

## CI/CD Pipeline

### GitHub Actions Example
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

## Support

For deployment issues:
- Email: webxplusx@gmail.com
- GitHub: https://github.com/gase99/webxplusx
