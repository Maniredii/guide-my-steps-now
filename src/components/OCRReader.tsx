
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Tesseract from "tesseract.js";

interface OCRReaderProps {
  speak: (text: string) => void;
  lang?: string; // ISO lang
}

export const OCRReader = ({ speak, lang = "eng" }: OCRReaderProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ocrText, setOcrText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = async (file: File) => {
    setOcrText("");
    setIsLoading(true);
    try {
      const { data } = await Tesseract.recognize(file, lang);
      setOcrText(data.text);
      speak(`Text found: ${data.text}`);
      toast.success("OCR success", { description: data.text });
    } catch (e) {
      toast.error("OCR failed", { description: "Could not read text" });
      speak("Sorry, I could not read the text. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col items-center gap-2 mt-4">
      <input
        type="file"
        accept="image/*"
        ref={fileRef}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        onClick={() => fileRef.current?.click()}
        className="bg-blue-500 text-white"
        disabled={isLoading}
      >
        {isLoading ? "Reading..." : "Upload Image for OCR"}
      </Button>
      {ocrText && (
        <div className="border border-blue-800 bg-blue-900 text-white px-4 py-2 w-full max-w-md rounded mt-2">
          <div className="font-bold">Detected:</div>
          <div className="break-all">{ocrText}</div>
        </div>
      )}
    </div>
  );
};
