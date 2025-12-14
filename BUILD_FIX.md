# EAS Build Dependency Install Fix

## Problem
EAS iOS build was failing during "Install dependencies" phase with:
```
Unknown error. See logs of the Install dependencies build phase for more information.
```

## Root Cause
The local environment was using `--legacy-peer-deps` flag, but EAS Build servers didn't know about it, causing peer dependency resolution to fail.

## Solution Applied ✅

### 1. Created `.npmrc` File
```
legacy-peer-deps=true
engine-strict=false
```

This tells npm (both locally and on EAS) to use legacy peer dependency resolution.

### 2. Specified Node Version in `eas.json`
Added Node.js version to production build profile:
```json
{
  "production": {
    "autoIncrement": true,
    "channel": "production",
    "node": "22.11.0"
  }
}
```

### 3. Regenerated `package-lock.json`
Created a fresh package-lock.json with legacy peer deps settings.

## Files Changed
- ✅ `.npmrc` (NEW) - npm configuration
- ✅ `eas.json` - added node version
- ✅ `package-lock.json` - regenerated
- ✅ `package.json` - already updated with correct versions

## Try Building Now

```bash
eas build --platform ios --profile production
```

The build should now:
1. Install dependencies successfully (using legacy-peer-deps)
2. Build without RCTReleaseLevel errors (reanimated downgraded)
3. Include iOS share sheet support (app.json updated)
4. Include all code audit improvements

## Why This Works

When EAS Build runs:
1. It reads `.npmrc` and uses `legacy-peer-deps=true`
2. It uses Node.js 22.11.0 (specified in eas.json)
3. It installs packages exactly as they work locally
4. The postinstall script creates the wasm stub
5. Builds with react-native-reanimated 3.17.5 (compatible)

## Expected Build Time
- First build: 15-20 minutes (clean build)
- Subsequent builds: 5-10 minutes (cached dependencies)

---

**Status: Ready to build! 🚀**
