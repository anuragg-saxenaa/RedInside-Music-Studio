import { createContext, useContext, useRef, useCallback, useState } from 'react';

interface SharedAudioState {
  activeAudioRef: React.MutableRefObject<HTMLAudioElement | null>;
  play: (audioRef: React.MutableRefObject<HTMLAudioElement | null>, audioUrl: string) => void;
  pause: () => void;
  activeUrl: string | null;
}

const SharedAudioContext = createContext<SharedAudioState | null>(null);

export function SharedAudioProvider({ children }: { children: React.ReactNode }) {
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  const play = useCallback((audioRef: React.MutableRefObject<HTMLAudioElement | null>, audioUrl: string) => {
    // Pause currently playing audio if different
    if (activeAudioRef.current && activeAudioRef.current !== audioRef.current) {
      activeAudioRef.current.pause();
    }
    // Also pause any other HTMLAudioElements on the page
    document.querySelectorAll('audio').forEach(audio => {
      if (audio !== audioRef.current) {
        audio.pause();
      }
    });
    // Set new active
    if (audioRef.current) {
      activeAudioRef.current = audioRef.current;
      setActiveUrl(audioUrl);
    }
  }, []);

  const pause = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
    }
  }, []);

  return (
    <SharedAudioContext.Provider value={{ activeAudioRef, play, pause, activeUrl }}>
      {children}
    </SharedAudioContext.Provider>
  );
}

export function useSharedAudio() {
  const context = useContext(SharedAudioContext);
  if (!context) {
    throw new Error('useSharedAudio must be used within SharedAudioProvider');
  }
  return context;
}
