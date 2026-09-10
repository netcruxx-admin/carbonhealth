'use client';

import { useState } from 'react';
import { Mic } from 'lucide-react';
import { toast } from 'sonner';
import { useSpeechToText } from '@/hooks/useSpeechToText';

interface Props {
  /** Called with each finalised chunk of speech. The parent decides how to
   *  merge it (usually append to the field's current value). */
  onTranscript: (text: string) => void;
  /** Accessible label / tooltip; defaults to "Dictate". */
  label?: string;
  lang?: string;
  className?: string;
}

/**
 * A mic toggle that streams dictated speech into a text field. Renders nothing
 * when the browser has no SpeechRecognition (Firefox), so callers can drop it
 * next to any input without a capability check of their own.
 */
export function DictationButton({ onTranscript, label = 'Dictate', lang, className = '' }: Props) {
  const [errored, setErrored] = useState(false);

  const { supported, listening, interim, toggle } = useSpeechToText({
    lang,
    onResult: (text) => {
      setErrored(false);
      onTranscript(text);
    },
    onError: (error) => {
      setErrored(true);
      toast.error(
        error === 'not-allowed' || error === 'service-not-allowed'
          ? 'Microphone access is blocked. Allow it in your browser settings to dictate.'
          : 'Dictation stopped — could not reach the microphone.',
      );
    },
  });

  if (!supported) return null;

  return (
    <span className={`inline-flex ${className}`.trim()}>
      <span className="relative inline-flex">
        {listening && interim && (
          <span
            className="pointer-events-none absolute bottom-full right-0 mb-1 max-w-xs truncate rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-lg"
            aria-hidden
          >
            {interim}
          </span>
        )}
        {listening && (
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" aria-hidden />
        )}
        <button
          type="button"
          onClick={toggle}
          aria-pressed={listening}
          aria-label={listening ? 'Stop dictation' : label}
          title={listening ? 'Stop dictation' : label}
          className={`relative inline-flex h-7 w-7 items-center justify-center border transition-all ${
            listening
              ? 'rounded-full border-red-500 bg-red-500 text-white shadow-sm scale-105'
              : errored
                ? 'rounded-md border-red-200 text-red-400 hover:bg-red-50'
                : 'rounded-md border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          <Mic className="h-4 w-4" />
        </button>
      </span>
    </span>
  );
}
