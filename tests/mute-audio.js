// Keeps every test browser silent (they ran audibly in the developer's headphones).
// Loaded by playwright.config.js, which also passes the per-browser launch flags
// (chromium --mute-audio, firefox volume/speech prefs). WebKit has no mute switch,
// so every new page gets an init script that silences media, Web Audio and speech
// without changing their events or state.
const MUTE_SCRIPT = `(() => {
  try {
    const mp = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { try { this.volume = 0; } catch (e) {} return mp.apply(this, arguments); };
  } catch (e) {}
  try {
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest) {
      if (typeof AudioDestinationNode !== 'undefined' && dest instanceof AudioDestinationNode
          && !(typeof OfflineAudioContext !== 'undefined' && this.context instanceof OfflineAudioContext)) {
        const ctx = this.context;
        if (!ctx.__mutedOut) {
          ctx.__mutedOut = ctx.createGain();
          ctx.__mutedOut.gain.value = 0;
          orig.call(ctx.__mutedOut, ctx.destination);
        }
        orig.call(this, ctx.__mutedOut, ...Array.prototype.slice.call(arguments, 1));
        return dest;
      }
      return orig.apply(this, arguments);
    };
  } catch (e) {}
  try {
    const sp = SpeechSynthesis.prototype.speak;
    SpeechSynthesis.prototype.speak = function (u) { try { u.volume = 0; } catch (e) {} return sp.call(this, u); };
  } catch (e) {}
})();`;

function installTestMute() {
    // playwright-core's exports map hides lib/, so load the client class by path.
    const { BrowserContext } = require(require('path').join(
        require('path').dirname(require.resolve('playwright-core/package.json')), 'lib', 'client', 'browserContext.js'));
    if (BrowserContext.prototype.__conductorMuted) return;
    BrowserContext.prototype.__conductorMuted = true;
    const newPage = BrowserContext.prototype.newPage;
    BrowserContext.prototype.newPage = async function () {
        await this.addInitScript(MUTE_SCRIPT);
        return newPage.apply(this, arguments);
    };
}

module.exports = { installTestMute, MUTE_SCRIPT };
