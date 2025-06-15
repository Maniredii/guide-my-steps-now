
import { useState, useRef } from "react";
import { pipeline, PipelineType } from "@huggingface/transformers";

type UseWhisperTranscriberReturn = {
  isLoading: boolean;
  transcript: string;
  error: string | null;
  recordAndTranscribe: () => Promise<void>;
};

export function useWhisperTranscriber(): UseWhisperTranscriberReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const transcriberRef = useRef<PipelineType | null>(null);

  // This will prompt for microphone, record a short sample, and transcribe
  const recordAndTranscribe = async () => {
    setTranscript("");
    setError(null);

    try {
      setIsLoading(true);

      // Initialize Whisper pipeline if not yet loaded
      if (!transcriberRef.current) {
        transcriberRef.current = await pipeline(
          "automatic-speech-recognition",
          "onnx-community/whisper-tiny.en",
          { device: "auto" }
        );
      }

      // Record audio (5 seconds)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream);
      let audioChunks: BlobPart[] = [];

      return new Promise<void>((resolve, reject) => {
        mediaRecorder.ondataavailable = event => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
          const audioURL = URL.createObjectURL(audioBlob);

          // Run Whisper transcription
          try {
            const output = await transcriberRef.current!(audioURL);
            setTranscript(output.text.trim());
            setIsLoading(false);
            resolve();
          } catch (err) {
            setError("Transcription failed, please try again.");
            setIsLoading(false);
            reject(err);
          }
        };

        mediaRecorder.onerror = (ev) => {
          setError("Recording error.");
          setIsLoading(false);
          reject(ev.error);
        };

        mediaRecorder.start();
        setTimeout(() => {
          mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
        }, 4500); // Record for 4.5 seconds to avoid lag
      });
    } catch (err) {
      setError("Unable to access microphone.");
      setIsLoading(false);
    }
  };

  return { isLoading, transcript, error, recordAndTranscribe };
}
