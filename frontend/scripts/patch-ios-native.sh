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

# 3. Native plugins + bridge VC that registers them (app-local plugins are NOT
#    auto-discovered). AudioPlayer = AVPlayer playback + Now Playing + remote
#    commands (lock-screen/AirPods/car next-prev + background auto-advance).
for f in AudioPlayerPlugin NowPlayingPlugin MainViewController; do
  if [ -f "ios-native/$f.swift" ]; then
    cp "ios-native/$f.swift" "ios/App/App/$f.swift"
    echo "✔ Copied $f.swift into ios/App/App"
  fi
done
# Point the storyboard at MainViewController so capacitorDidLoad registers plugins
STORY="ios/App/App/Base.lproj/Main.storyboard"
if [ -f "$STORY" ] && grep -q 'customClass="CAPBridgeViewController"' "$STORY"; then
  /usr/bin/sed -i '' 's|customClass="CAPBridgeViewController" customModule="Capacitor"|customClass="MainViewController" customModule="App" customModuleProvider="target"|' "$STORY"
  echo "✔ Storyboard → MainViewController"
fi

# 4. Add the Swift files to the Xcode project (cap-generated pbxproj only compiles
#    AppDelegate.swift; app-local files must be registered as build sources or
#    they're silently skipped — caused "no playback" + black screen).
PBX="ios/App/App.xcodeproj/project.pbxproj"
if [ -f "$PBX" ] && ! grep -q "AudioPlayerPlugin.swift" "$PBX"; then
  /usr/bin/perl -0pi -e 's|(\t\t504EC3081FED79650016851F /\* AppDelegate.swift in Sources \*/ = \{isa = PBXBuildFile; fileRef = 504EC3071FED79650016851F /\* AppDelegate.swift \*/; \};\n)|$1\t\tAA0002AA0002AA0002AA0002 /* AudioPlayerPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0001AA0001AA0001AA0001 /* AudioPlayerPlugin.swift */; };\n\t\tAA0004AA0004AA0004AA0004 /* NowPlayingPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0003AA0003AA0003AA0003 /* NowPlayingPlugin.swift */; };\n\t\tAA0006AA0006AA0006AA0006 /* MainViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA0005AA0005AA0005AA0005 /* MainViewController.swift */; };\n|' "$PBX"
  /usr/bin/perl -0pi -e 's|(\t\t504EC3071FED79650016851F /\* AppDelegate.swift \*/ = \{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; \};\n)|$1\t\tAA0001AA0001AA0001AA0001 /* AudioPlayerPlugin.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AudioPlayerPlugin.swift; sourceTree = "<group>"; };\n\t\tAA0003AA0003AA0003AA0003 /* NowPlayingPlugin.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NowPlayingPlugin.swift; sourceTree = "<group>"; };\n\t\tAA0005AA0005AA0005AA0005 /* MainViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MainViewController.swift; sourceTree = "<group>"; };\n|' "$PBX"
  /usr/bin/perl -0pi -e 's|(\t\t\t\t504EC3071FED79650016851F /\* AppDelegate.swift \*/,\n)|$1\t\t\t\tAA0001AA0001AA0001AA0001 /* AudioPlayerPlugin.swift */,\n\t\t\t\tAA0003AA0003AA0003AA0003 /* NowPlayingPlugin.swift */,\n\t\t\t\tAA0005AA0005AA0005AA0005 /* MainViewController.swift */,\n|' "$PBX"
  /usr/bin/perl -0pi -e 's|(\t\t\t\t504EC3081FED79650016851F /\* AppDelegate.swift in Sources \*/,\n)|$1\t\t\t\tAA0002AA0002AA0002AA0002 /* AudioPlayerPlugin.swift in Sources */,\n\t\t\t\tAA0004AA0004AA0004AA0004 /* NowPlayingPlugin.swift in Sources */,\n\t\t\t\tAA0006AA0006AA0006AA0006 /* MainViewController.swift in Sources */,\n|' "$PBX"
  echo "✔ Added Swift files to Xcode project"
fi

echo "Done. Rebuild: npx cap run ios"
