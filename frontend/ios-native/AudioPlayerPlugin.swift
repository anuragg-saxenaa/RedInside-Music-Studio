import Foundation
import Capacitor
import AVFoundation
import MediaPlayer
import UIKit

// Native audio engine. On iOS the webview's <audio> can't reliably own the system
// audio session, so lock-screen / AirPods / car (Bluetooth) controls route to
// other apps and background auto-advance is throttled. This plugin plays via
// AVPlayer — so the OS routes Now Playing + remote commands (play/pause/next/prev/
// seek) to us, and "ended" fires reliably in the background for auto-advance.
@objc(AudioPlayerPlugin)
public class AudioPlayerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioPlayerPlugin"
    public let jsName = "AudioPlayer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "loadTrack", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preload", returnType: CAPPluginReturnPromise),
    ]

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var commandsReady = false
    private var artworkCache: [String: MPMediaItemArtwork] = [:]
    private var meta: [String: String] = [:]
    // Prebuffered next track. A dedicated muted AVPlayer holds the next AVPlayerItem
    // and forces byte-level buffering so the skip is instant. loadTrack creates a
    // NEW AVPlayerItem from the same cached AVURLAsset — different item, no cross-
    // player ownership conflict (the old crash cause).
    private var preloadUrl: String?
    private var preloadAsset: AVURLAsset?
    private var preloadPlayer: AVPlayer?   // muted, drives buffering
    // Whether playback was active when an interruption (call/Siri) began.
    private var wasPlayingBeforeInterruption = false

    public override func load() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch { print("AudioSession error: \(error)") }
        // Resume after interruptions (phone calls, Siri) like Apple Music/Spotify.
        NotificationCenter.default.addObserver(self, selector: #selector(handleInterruption), name: AVAudioSession.interruptionNotification, object: nil)
    }

    @objc private func handleInterruption(_ n: Notification) {
        guard let info = n.userInfo,
              let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        if type == .began {
            // System paused us (e.g. incoming call). Remember we were playing so we
            // can resume even when the OS omits the .shouldResume hint (common after
            // phone calls). Reflect in UI/Now Playing.
            wasPlayingBeforeInterruption = (player?.rate ?? 0) > 0
            updateNowPlaying(isPlaying: false)
            notifyListeners("statechange", data: ["isPlaying": false])
        } else if type == .ended {
            let opts = AVAudioSession.InterruptionOptions(rawValue: info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0)
            // Resume if the system asks OR if we were playing before — Apple Music /
            // Spotify behaviour. Reactivate the session first; it isn't always ready
            // the instant the call ends, so retry briefly.
            let shouldResume = opts.contains(.shouldResume) || wasPlayingBeforeInterruption
            wasPlayingBeforeInterruption = false
            if shouldResume {
                try? AVAudioSession.sharedInstance().setActive(true)
                let resume = { [weak self] in
                    guard let self = self else { return }
                    try? AVAudioSession.sharedInstance().setActive(true)
                    self.player?.play()
                    self.updateNowPlaying(isPlaying: true)
                    self.notifyListeners("statechange", data: ["isPlaying": true])
                }
                resume()
                // Retry once shortly after — the audio route/session can settle late.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                    if (self.player?.rate ?? 0) == 0 { resume() }
                }
            }
        }
    }

    @objc func loadTrack(_ call: CAPPluginCall) {
        guard let urlStr = call.getString("url"), let url = URL(string: urlStr) else {
            call.reject("missing url"); return
        }
        meta["title"] = call.getString("title") ?? ""
        meta["artist"] = call.getString("artist") ?? "RedInside Studio"
        meta["album"] = call.getString("album") ?? "RedInside Music Studio"
        meta["artworkUrl"] = call.getString("artworkUrl") ?? ""
        let startAt = call.getDouble("position") ?? 0

        DispatchQueue.main.async {
            self.teardownObservers()
            // Build a fresh item, reusing the warmed asset if it's this track (instant
            // skip). A fresh item is never owned by another player → no crash.
            let item: AVPlayerItem
            if self.preloadUrl == urlStr, let asset = self.preloadAsset {
                item = AVPlayerItem(asset: asset)
            } else {
                item = AVPlayerItem(url: url)
            }
            item.preferredForwardBufferDuration = 4
            self.preloadUrl = nil; self.preloadAsset = nil
            if self.player == nil { self.player = AVPlayer(playerItem: item) }
            else { self.player?.replaceCurrentItem(with: item) }
            self.player?.automaticallyWaitsToMinimizeStalling = false // start ASAP
            self.player?.volume = Float(call.getDouble("volume") ?? 1.0)
            if startAt > 0 { self.player?.seek(to: CMTime(seconds: startAt, preferredTimescale: 1000)) }
            if #available(iOS 10.0, *) { self.player?.playImmediately(atRate: 1.0) } else { self.player?.play() }
            self.addObservers(for: item)
            self.setupCommands()
            self.updateNowPlaying(isPlaying: true)
            // Notify JS so playerIsPlaying React state is always authoritative from
            // native — prevents the double-press / inverted icon bug.
            self.notifyListeners("statechange", data: ["isPlaying": true])
            // Release the preload player — its job is done.
            self.preloadPlayer?.replaceCurrentItem(with: nil)
            call.resolve()
        }
    }

    // Prebuffer the next track's item so the next loadTrack starts instantly.
    @objc func preload(_ call: CAPPluginCall) {
        guard let urlStr = call.getString("url"), let url = URL(string: urlStr) else { call.resolve(); return }
        DispatchQueue.main.async {
            if self.preloadUrl == urlStr { call.resolve(); return }
            // Warm a FRESH item in a dedicated muted player — this forces iOS to fetch
            // actual audio bytes (not just metadata) so the next skip is instant.
            // loadTrack creates another NEW item from the same asset, so the preload
            // player and main player each own their own item — no crash.
            let asset = AVURLAsset(url: url)
            let item = AVPlayerItem(asset: asset)
            item.preferredForwardBufferDuration = 8
            if self.preloadPlayer == nil { self.preloadPlayer = AVPlayer() }
            self.preloadPlayer?.replaceCurrentItem(with: item)
            self.preloadPlayer?.volume = 0
            self.preloadPlayer?.play()  // muted play forces byte buffering
            self.preloadUrl = urlStr
            self.preloadAsset = asset
            call.resolve()
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.player?.play(); self.updateNowPlaying(isPlaying: true); self.notifyListeners("statechange", data: ["isPlaying": true]); call.resolve() }
    }
    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.player?.pause(); self.updateNowPlaying(isPlaying: false); self.notifyListeners("statechange", data: ["isPlaying": false]); call.resolve() }
    }
    @objc func seek(_ call: CAPPluginCall) {
        let pos = call.getDouble("position") ?? 0
        DispatchQueue.main.async { self.player?.seek(to: CMTime(seconds: pos, preferredTimescale: 1000)); self.updateNowPlaying(isPlaying: self.player?.rate ?? 0 > 0); call.resolve() }
    }
    @objc func setVolume(_ call: CAPPluginCall) {
        let v = call.getDouble("volume") ?? 1.0
        DispatchQueue.main.async { self.player?.volume = Float(v); call.resolve() }
    }

    private func addObservers(for item: AVPlayerItem) {
        let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
        timeObserver = player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self = self, let item = self.player?.currentItem else { return }
            let cur = time.seconds
            let dur = item.duration.seconds
            self.notifyListeners("timeupdate", data: ["currentTime": cur.isFinite ? cur : 0, "duration": dur.isFinite ? dur : 0])
            self.updateElapsed(cur, duration: dur.isFinite ? dur : 0)
        }
        NotificationCenter.default.addObserver(self, selector: #selector(didEnd), name: .AVPlayerItemDidPlayToEndTime, object: item)
        // Advance even if a track fails/stalls so playback never gets "stuck".
        NotificationCenter.default.addObserver(self, selector: #selector(didEnd), name: .AVPlayerItemFailedToPlayToEndTime, object: item)
    }
    private func teardownObservers() {
        if let t = timeObserver { player?.removeTimeObserver(t); timeObserver = nil }
        NotificationCenter.default.removeObserver(self, name: .AVPlayerItemDidPlayToEndTime, object: nil)
        NotificationCenter.default.removeObserver(self, name: .AVPlayerItemFailedToPlayToEndTime, object: nil)
    }
    @objc private func didEnd() { notifyListeners("ended", data: [:]) }

    private func setupCommands() {
        if commandsReady { return }
        commandsReady = true
        let c = MPRemoteCommandCenter.shared()
        c.playCommand.isEnabled = true; c.pauseCommand.isEnabled = true
        c.nextTrackCommand.isEnabled = true; c.previousTrackCommand.isEnabled = true
        c.changePlaybackPositionCommand.isEnabled = true
        c.playCommand.addTarget { [weak self] _ in self?.player?.play(); self?.updateNowPlaying(isPlaying: true); self?.notifyListeners("statechange", data: ["isPlaying": true]); return .success }
        c.pauseCommand.addTarget { [weak self] _ in self?.player?.pause(); self?.updateNowPlaying(isPlaying: false); self?.notifyListeners("statechange", data: ["isPlaying": false]); return .success }
        c.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self = self, let p = self.player else { return .commandFailed }
            let playing = p.rate > 0
            if playing { p.pause(); self.updateNowPlaying(isPlaying: false); self.notifyListeners("statechange", data: ["isPlaying": false]) }
            else       { p.play();  self.updateNowPlaying(isPlaying: true);  self.notifyListeners("statechange", data: ["isPlaying": true]) }
            return .success
        }
        c.nextTrackCommand.addTarget { [weak self] _ in self?.notifyListeners("remoteNext", data: [:]); return .success }
        c.previousTrackCommand.addTarget { [weak self] _ in self?.notifyListeners("remotePrev", data: [:]); return .success }
        c.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            self?.player?.seek(to: CMTime(seconds: e.positionTime, preferredTimescale: 1000))
            self?.notifyListeners("timeupdate", data: ["currentTime": e.positionTime, "duration": self?.player?.currentItem?.duration.seconds ?? 0])
            return .success
        }
    }

    private func updateNowPlaying(isPlaying: Bool) {
        var info: [String: Any] = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPMediaItemPropertyTitle] = meta["title"] ?? ""
        info[MPMediaItemPropertyArtist] = meta["artist"] ?? ""
        info[MPMediaItemPropertyAlbumTitle] = meta["album"] ?? ""
        if let dur = player?.currentItem?.duration.seconds, dur.isFinite { info[MPMediaItemPropertyPlaybackDuration] = dur }
        if let cur = player?.currentTime().seconds, cur.isFinite { info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = cur }
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        let urlStr = meta["artworkUrl"] ?? ""
        if !urlStr.isEmpty, let cached = artworkCache[urlStr] { info[MPMediaItemPropertyArtwork] = cached }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        if !urlStr.isEmpty, artworkCache[urlStr] == nil, let url = URL(string: urlStr) {
            URLSession.shared.dataTask(with: url) { data, _, _ in
                guard let data = data, let img = UIImage(data: data) else { return }
                let art = MPMediaItemArtwork(boundsSize: img.size) { _ in img }
                self.artworkCache[urlStr] = art
                DispatchQueue.main.async {
                    var i = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                    i[MPMediaItemPropertyArtwork] = art
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = i
                }
            }.resume()
        }
    }
    private func updateElapsed(_ cur: Double, duration: Double) {
        var i = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        i[MPNowPlayingInfoPropertyElapsedPlaybackTime] = cur
        if duration > 0 { i[MPMediaItemPropertyPlaybackDuration] = duration }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = i
    }
}
