#!/usr/bin/env bash
# Re-applies native iOS tweaks that live in the gitignored ios/ project.
# Run after `npx cap add ios` (or if ios/ is regenerated). Idempotent.
#
#   bash scripts/patch-ios-native.sh
#
# What it does:
#  1. Info.plist  → UIBackgroundModes = [audio]   (background + lock-screen playback)
#  2. AppDelegate → AVAudioSession .playback active (audio keeps playing when locked,
#     so the OS shows Now Playing: title / artwork / scrubber from Media Session)
set -e
cd "$(dirname "$0")/.."

PLIST="ios/App/App/Info.plist"
DELEGATE="ios/App/App/AppDelegate.swift"

if [ ! -f "$PLIST" ]; then echo "ios/ not found — run 'npx cap add ios' first"; exit 1; fi

# 1. UIBackgroundModes audio
if ! /usr/libexec/PlistBuddy -c "Print :UIBackgroundModes" "$PLIST" >/dev/null 2>&1; then
  /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "$PLIST"
  /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes:0 string audio" "$PLIST"
  echo "✔ Info.plist: added UIBackgroundModes audio"
else
  echo "• Info.plist: UIBackgroundModes already present"
fi

# 2. AVAudioSession playback in AppDelegate
if ! grep -q "AVAudioSession" "$DELEGATE"; then
  /usr/bin/sed -i '' 's/import Capacitor/import Capacitor\nimport AVFoundation/' "$DELEGATE"
  /usr/bin/sed -i '' 's|        // Override point for customization after application launch.\n        return true|        return true|' "$DELEGATE"
  # Insert audio-session setup before the first `return true`
  /usr/bin/perl -0pi -e 's/(didFinishLaunchingWithOptions[^\{]*\{)/$1\n        do {\n            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])\n            try AVAudioSession.sharedInstance().setActive(true)\n        } catch { print("AVAudioSession setup failed: \\(error)") }/' "$DELEGATE"
  echo "✔ AppDelegate: added AVAudioSession .playback"
else
  echo "• AppDelegate: AVAudioSession already configured"
fi

# 3. Native Now Playing plugin (lock-screen artwork + remote commands)
if [ -f "ios-native/NowPlayingPlugin.swift" ]; then
  cp ios-native/NowPlayingPlugin.swift ios/App/App/NowPlayingPlugin.swift
  echo "✔ Copied NowPlayingPlugin.swift into ios/App/App"
fi

echo "Done. Rebuild: npx cap run ios"
