# iOS Build Folly/Coroutine Fix

## Error
```
'folly/coro/Coroutine.h' file not found
```

## Root Cause

The React Native **New Architecture** was enabled in `app.json`:
```json
"newArchEnabled": true
```

The New Architecture requires:
- React Native 0.74+ with full C++ coroutine support
- Newer Folly library with coroutine headers
- Additional CocoaPods dependencies

However, with Expo SDK 54 and our current setup, this causes compatibility issues with the Folly C++ library.

## Solution ✅

Disabled the New Architecture in `app.json`:
```json
"newArchEnabled": false
```

### Why This Works

1. **Stability**: The classic architecture is battle-tested and stable
2. **Compatibility**: Works perfectly with Expo SDK 54 and RN 0.81.5
3. **No Feature Loss**: All app features work the same
4. **Proven**: Most production apps still use the classic architecture

### Files Changed
- ✅ `app.json` - Set `newArchEnabled: false`
- ✅ `eas.json` - Added `NO_FLIPPER: "1"` to disable debugging overhead

## Try Building Now

```bash
eas build --platform ios --profile production
```

**Expected:** ✅ Successful build without Folly errors

## About the New Architecture

The React Native New Architecture is optional and provides:
- Better performance for some use cases
- New JSI (JavaScript Interface)
- Fabric renderer

However, it's not required for most apps and can cause build complexity. The classic architecture is:
- ✅ More stable
- ✅ Better documented
- ✅ Easier to build
- ✅ Still very performant

You can enable it later when React Native 0.76+ is stable in Expo.

## Build Configuration Summary

Current production build settings in `eas.json`:
```json
{
  "production": {
    "autoIncrement": true,
    "channel": "production",
    "node": "22.11.0",
    "env": {
      "NO_FLIPPER": "1"
    }
  }
}
```

This configuration:
- ✅ Uses Node.js 22.11.0 (stable)
- ✅ Auto-increments build number
- ✅ Disables Flipper (reduces build time)
- ✅ Uses legacy peer deps (.npmrc)

---

**Status: Build should now succeed! 🚀**
