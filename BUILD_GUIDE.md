# Posify - Build and Testing Guide

This guide explains how to test and build the Posify desktop application, including creating a DMG file for macOS distribution.

## 📋 Prerequisites

Before building, ensure you have:

- **Node.js 18+** (recommended: 20+)
- **PostgreSQL 14+** running and accessible
- **npm** or **yarn** package manager
- **macOS** (for building DMG files)
- All dependencies installed: `npm install`

## 🧪 Testing the Application

### 1. Development Testing

Test the application in development mode:

```bash
# Terminal 1: Start Next.js development server
npm run dev

# Terminal 2: Start Electron app
npm run electron:dev
```

The Electron app will automatically connect to the Next.js dev server running on `http://localhost:3000`.

### 2. Production Testing (Local)

Test the production build locally before creating the DMG:

```bash
# Build Next.js for production
npm run build

# Test the production build
npm run electron:dev
```

Note: In production mode, Electron will run the Next.js standalone server from `.next/standalone/`.

### 3. Testing Checklist

Before building the DMG, test these features:

- [ ] Login with different user roles (admin, manager, user)
- [ ] POS interface - create a sale
- [ ] Product management - add/edit products
- [ ] Customer management - add/edit customers
- [ ] Sales reports
- [ ] Purchase management
- [ ] Inventory tracking
- [ ] Database connectivity
- [ ] Print functionality (if applicable)

## 🏗️ Building the DMG File

### Step 1: Prepare the Build

```bash
# Navigate to project directory
cd /Users/dev/Desktop/pos

# Install dependencies (if not already done)
npm install

# Ensure database is configured
# Update .env.local with your database connection string
```

### Step 2: Build Next.js Application

```bash
# Build Next.js for production
# This creates the .next/standalone directory
npm run build
```

### Step 3: Build Electron App for macOS

```bash
# Build for Intel Macs (x64)
npm run electron:build:mac

# OR build for Apple Silicon (ARM64)
npm run electron:build:mac:arm64

# OR build for both architectures (universal)
npm run build && electron-builder --mac --x64 --arm64
```

### Step 4: Locate the DMG File

After building, the DMG file will be located in:

```
dist/Posify-1.0.0.dmg
```

Or check the `dist/` directory for:
- `Posify-1.0.0.dmg` - DMG installer
- `Posify-1.0.0-mac.zip` - ZIP archive (alternative)

## 📦 Build Output

The build process creates:

- **DMG file**: `dist/Posify-1.0.0.dmg` - macOS disk image installer
- **ZIP file**: `dist/Posify-1.0.0-mac.zip` - Alternative distribution format
- **App bundle**: `dist/mac/Posify.app` - The actual application bundle

## 🔧 Troubleshooting

### Issue: Build fails with "icon not found"

**Solution**: The build will work without icons, but you can add them:
- Create `public/icon.icns` for macOS (512x512px recommended)
- Use a tool like `iconutil` or online converters to create .icns from PNG

### Issue: "Cannot find module" errors

**Solution**: Ensure all dependencies are installed:
```bash
npm install
npm run db:generate  # Generate Prisma client
```

### Issue: Database connection errors

**Solution**: 
- Ensure PostgreSQL is running
- Check `.env.local` has correct `DATABASE_URL`
- Run migrations: `npm run db:push` or `npm run db:migrate`

### Issue: Build is too large

**Solution**: The standalone build includes only necessary dependencies. If still large:
- Check `.next/standalone` size
- Consider excluding unnecessary files in `package.json` build config

### Issue: App won't start after building

**Solution**: 
- Check console logs in Terminal when running the built app
- Ensure `.next/standalone` directory exists after `npm run build`
- Verify database connection settings

## 🚀 Distribution

### For End Users

1. **Distribute the DMG file**:
   - Users can download and open the DMG
   - Drag the app to Applications folder
   - First launch may require security approval (right-click → Open)

2. **Code Signing** (Optional, for distribution outside App Store):
   - Requires Apple Developer account
   - Add signing configuration to `package.json` build.mac section
   - See [electron-builder code signing docs](https://www.electron.build/code-signing)

3. **Notarization** (Required for macOS Gatekeeper):
   - Required for apps distributed outside Mac App Store
   - Requires Apple Developer account
   - Configure in `package.json` build.mac section

## 📝 Build Configuration

The build configuration is in `package.json` under the `"build"` section:

- **appId**: `com.posify.app` - Unique application identifier
- **productName**: `Posify` - Display name
- **output**: `dist/` - Output directory
- **mac.target**: `["dmg", "zip"]` - Build targets for macOS

## 🔍 Verifying the Build

After building, verify the DMG:

```bash
# Check DMG contents
hdiutil attach "dist/Posify-1.0.0.dmg"
# Mounts the DMG, check contents in Finder
hdiutil detach /Volumes/Posify
```

## 📚 Additional Resources

- [Electron Builder Documentation](https://www.electron.build/)
- [Next.js Standalone Output](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [macOS Code Signing Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

## 🆘 Support

If you encounter issues:

1. Check the build logs in Terminal
2. Verify all prerequisites are met
3. Ensure database is properly configured
4. Check Electron and Next.js versions compatibility

---

**Note**: The first build may take several minutes as it packages all dependencies. Subsequent builds are faster.

