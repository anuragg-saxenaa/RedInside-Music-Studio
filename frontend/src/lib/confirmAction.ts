// Cross-platform confirmation dialog. window.confirm() does NOT work in the Tauri
// (macOS desktop) webview — it silently returns false, so deletes never fired on
// desktop. This injects a real in-app modal that works identically on iOS, desktop
// and web. Returns a Promise<boolean>.
export function confirmAction(message: string, confirmLabel = 'Delete'): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
      'animation:ris-cf-in 160ms ease;';

    const box = document.createElement('div');
    box.style.cssText =
      'background:linear-gradient(165deg,#241019,#140309);border:1px solid rgba(230,57,70,0.3);' +
      'border-radius:18px;padding:22px 22px 18px;max-width:330px;width:86%;' +
      "font-family:'Outfit',-apple-system,sans-serif;box-shadow:0 24px 70px rgba(0,0,0,0.65);" +
      'animation:ris-cf-pop 200ms cubic-bezier(0.34,1.56,0.64,1);';

    const msg = document.createElement('div');
    msg.textContent = message;
    msg.style.cssText = 'color:#fff;font-size:15px;font-weight:500;line-height:1.5;margin-bottom:20px;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.cssText =
      'padding:11px 18px;border-radius:11px;border:1px solid rgba(255,255,255,0.15);' +
      'background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);font-weight:600;cursor:pointer;font-size:14px;';

    const ok = document.createElement('button');
    ok.textContent = confirmLabel;
    ok.style.cssText =
      'padding:11px 18px;border-radius:11px;border:none;background:#e63946;color:#fff;' +
      'font-weight:700;cursor:pointer;font-size:14px;box-shadow:0 4px 16px rgba(230,57,70,0.35);';

    const style = document.createElement('style');
    style.textContent =
      '@keyframes ris-cf-in{from{opacity:0}to{opacity:1}}' +
      '@keyframes ris-cf-pop{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}';

    const cleanup = (v: boolean) => {
      try { document.body.removeChild(overlay); } catch { /* already gone */ }
      resolve(v);
    };
    cancel.onclick = () => cleanup(false);
    ok.onclick = () => cleanup(true);
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };

    row.append(cancel, ok);
    box.append(msg, row);
    overlay.append(style, box);
    document.body.append(overlay);
  });
}
