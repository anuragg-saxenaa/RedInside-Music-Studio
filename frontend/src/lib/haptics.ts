// Thin haptics wrapper. Fires native taps on Capacitor (iOS); no-ops everywhere
// else (web/desktop) so callers never need to guard. All calls are fire-and-forget.
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isNative = (): boolean => !!(window as any).Capacitor?.isNativePlatform?.();

export function tapLight(): void {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export function tapMedium(): void {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}

export function tapHeavy(): void {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
}

export function selectionChanged(): void {
  if (!isNative()) return;
  Haptics.selectionStart().then(() => Haptics.selectionChanged()).catch(() => {});
}

export function notifySuccess(): void {
  if (!isNative()) return;
  Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}
