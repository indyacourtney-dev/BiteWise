export interface SpeechQueueCallbacks {
  onDone: () => void;
  onStopped: () => void;
  onError: () => void;
}

export type SpeechUtterance = (text: string, callbacks: SpeechQueueCallbacks) => void;

/** Plays one utterance at a time so platforms do not replace overlapping speech. */
export function speakSequentially(
  parts: string[],
  play: SpeechUtterance,
  onFinished: () => void,
): () => void {
  const queue = parts.map(part => part.trim()).filter(Boolean);
  let cancelled = false;
  let index = 0;

  const playNext = () => {
    if (cancelled) return;
    const text = queue[index++];
    if (text === undefined) {
      onFinished();
      return;
    }

    let settled = false;
    const continueQueue = () => {
      if (settled || cancelled) return;
      settled = true;
      playNext();
    };
    const stopQueue = () => {
      if (settled || cancelled) return;
      settled = true;
      cancelled = true;
    };

    try {
      play(text, { onDone: continueQueue, onError: continueQueue, onStopped: stopQueue });
    } catch {
      continueQueue();
    }
  };

  playNext();
  return () => {
    cancelled = true;
  };
}