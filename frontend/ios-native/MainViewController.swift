import UIKit
import Capacitor

// App-local Capacitor plugins are not auto-discovered (only plugins shipped as
// packages are). Register them explicitly here so AudioPlayer / NowPlaying are
// callable from JS.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AudioPlayerPlugin())
        bridge?.registerPluginInstance(NowPlayingPlugin())
    }
}
