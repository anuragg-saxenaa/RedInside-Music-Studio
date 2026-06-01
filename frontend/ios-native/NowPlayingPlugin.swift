import Foundation
import Capacitor
import MediaPlayer
import UIKit

// Native Now Playing bridge. The webview's <audio> drives playback, but iOS will
// not reliably surface Media Session metadata/artwork to the lock screen from a
// WKWebView. This plugin pushes title/artist/artwork to MPNowPlayingInfoCenter
// (big lock-screen artwork, like Spotify) and forwards lock-screen / Bluetooth /
// CarPlay-Bluetooth control taps back to JS.
@objc(NowPlayingPlugin)
public class NowPlayingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NowPlayingPlugin"
    public let jsName = "NowPlaying"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    private var artworkCache: [String: MPMediaItemArtwork] = [:]
    private var commandsReady = false

    @objc func update(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? ""
        let artist = call.getString("artist") ?? "RedInside Studio"
        let album = call.getString("album") ?? "RedInside Music Studio"
        let duration = call.getDouble("duration") ?? 0
        let position = call.getDouble("position") ?? 0
        let isPlaying = call.getBool("isPlaying") ?? true
        let artworkUrl = call.getString("artworkUrl")

        DispatchQueue.main.async {
            var info: [String: Any] = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            info[MPMediaItemPropertyTitle] = title
            info[MPMediaItemPropertyArtist] = artist
            info[MPMediaItemPropertyAlbumTitle] = album
            info[MPMediaItemPropertyPlaybackDuration] = duration
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = position
            info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0

            if let urlStr = artworkUrl, let cached = self.artworkCache[urlStr] {
                info[MPMediaItemPropertyArtwork] = cached
            }
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            self.setupCommands()

            // Fetch artwork async, then patch it in.
            if let urlStr = artworkUrl, self.artworkCache[urlStr] == nil, let url = URL(string: urlStr) {
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
            call.resolve()
        }
    }

    @objc func setState(_ call: CAPPluginCall) {
        let isPlaying = call.getBool("isPlaying") ?? true
        let position = call.getDouble("position")
        DispatchQueue.main.async {
            var i = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            i[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
            if let p = position { i[MPNowPlayingInfoPropertyElapsedPlaybackTime] = p }
            MPNowPlayingInfoCenter.default().nowPlayingInfo = i
            call.resolve()
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            call.resolve()
        }
    }

    private func setupCommands() {
        if commandsReady { return }
        commandsReady = true
        let c = MPRemoteCommandCenter.shared()
        c.playCommand.isEnabled = true
        c.pauseCommand.isEnabled = true
        c.nextTrackCommand.isEnabled = true
        c.previousTrackCommand.isEnabled = true
        c.changePlaybackPositionCommand.isEnabled = true
        c.playCommand.addTarget { [weak self] _ in self?.notifyListeners("remotePlay", data: [:]); return .success }
        c.pauseCommand.addTarget { [weak self] _ in self?.notifyListeners("remotePause", data: [:]); return .success }
        c.togglePlayPauseCommand.addTarget { [weak self] _ in self?.notifyListeners("remoteToggle", data: [:]); return .success }
        c.nextTrackCommand.addTarget { [weak self] _ in self?.notifyListeners("remoteNext", data: [:]); return .success }
        c.previousTrackCommand.addTarget { [weak self] _ in self?.notifyListeners("remotePrev", data: [:]); return .success }
        c.changePlaybackPositionCommand.addTarget { [weak self] event in
            if let e = event as? MPChangePlaybackPositionCommandEvent {
                self?.notifyListeners("remoteSeek", data: ["position": e.positionTime])
            }
            return .success
        }
    }
}
