import { useState, useRef, useCallback } from 'react';
import { transcribeAudio } from '../api';

/**
 * VoiceInput — record voice and transcribe via Alem STT (Kazakh/Russian).
 */
export function VoiceInput({ onTranscript, disabled = false }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

        setProcessing(true);
        try {
          const buffer = await blob.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
          );
          const { text } = await transcribeAudio(base64, 'recording.webm');
          if (text && onTranscript) onTranscript(text);
        } catch (err) {
          console.error('Transcription failed:', err);
        } finally {
          setProcessing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const isDisabled = disabled || processing;

  if (processing) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-slate-100 border border-slate-200 text-slate-500 text-[13px] font-semibold">
        <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        Распознаю...
      </span>
    );
  }

  if (recording) {
    return (
      <button
        type="button"
        onClick={stopRecording}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border-2 border-red-400 bg-red-50 text-red-600 text-[13px] font-semibold animate-pulse hover:bg-red-100 transition"
      >
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Запись... (стоп)
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={isDisabled}
      title="Голосовой ввод (KZ/RU)"
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border-[1.5px] border-indigo-200 bg-indigo-50 text-indigo-500 text-[13px] font-semibold hover:bg-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      &#127908; Голос (KZ/RU)
    </button>
  );
}
