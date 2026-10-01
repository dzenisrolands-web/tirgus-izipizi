"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Loader2, Play, Pause } from "lucide-react";
import { supabase } from "@/lib/supabase";

const MAX_DURATION_S = 60; // 60 seconds max per recording

export function AudioRecorder({
  value,
  onChange,
  userId,
}: {
  value: string;
  onChange: (url: string) => void;
  userId: string;
}) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError("");
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Pārlūks neatbalsta audio ierakstīšanu");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        await upload(blob);
      };
      mr.start(100);
      setRecording(true);
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration((d) => {
          if (d + 1 >= MAX_DURATION_S) stop();
          return d + 1;
        });
      }, 1000);
    } catch (err) {
      setError(`Mikrofona piekļuves kļūda: ${err instanceof Error ? err.message : "nezināms"}`);
    }
  }

  function stop() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function upload(blob: Blob) {
    setUploading(true);
    setError("");
    try {
      const filename = `${userId}/audio-${Date.now()}.webm`;
      const { error: upErr } = await supabase.storage
        .from("bulletin-media")
        .upload(filename, blob, { contentType: "audio/webm", upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("bulletin-media").getPublicUrl(filename);
      onChange(data.publicUrl);
    } catch (err) {
      setError(`Augšupielādes kļūda: ${err instanceof Error ? err.message : "nezināms"}`);
    } finally {
      setUploading(false);
    }
  }

  function discard() {
    onChange("");
    setDuration(0);
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
  }

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      {/* Recording state */}
      {recording && (
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <span className="absolute inset-0 animate-ping rounded-full bg-red-300 opacity-50" />
              <Mic size={18} className="relative text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-700">Ierakstu...</p>
              <p className="font-mono text-xs text-red-600">{fmt(duration)} / {fmt(MAX_DURATION_S)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={stop}
            className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            <Square size={13} fill="white" /> Apstādināt
          </button>
        </div>
      )}

      {/* Recorded state */}
      {!recording && value && (
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700"
            >
              {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-green-700 truncate">Ieraksts saglabāts ✓</p>
              <audio
                ref={audioRef}
                src={value}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={discard}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500"
            title="Dzēst un ierakstīt no jauna"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}

      {/* Initial / re-record state */}
      {!recording && !value && !uploading && (
        <button
          type="button"
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-6 text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-100 transition"
        >
          <Mic size={18} className="text-gray-400" />
          <div className="text-left">
            <p className="font-semibold">Ierakstīt balss ziņu</p>
            <p className="text-xs text-gray-400">Maks. 60 sekundes · Pircēji dzirdēs tavu balsi</p>
          </div>
        </button>
      )}

      {/* Uploading state */}
      {uploading && (
        <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <Loader2 size={16} className="animate-spin" />
          Augšupielādē ierakstu...
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
