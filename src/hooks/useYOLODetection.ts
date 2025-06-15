
import { useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";

// COCO dataset classes (80 classes) - what YOLO models typically detect
const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
  "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
  "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
  "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
  "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
  "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
  "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
  "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
  "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
  "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
];

type YOLODetection = {
  label: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
};

export function useYOLODetection(videoRef: React.RefObject<HTMLVideoElement>, isActive: boolean) {
  const [detections, setDetections] = useState<YOLODetection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let interval: any;

    const loadModelAndStart = async () => {
      if (!sessionRef.current) {
        setIsLoading(true);
        try {
          // Using a public YOLOv8n ONNX model (lightweight version)
          const modelUrl = "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.onnx";
          
          // Configure ONNX Runtime for WebAssembly
          ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/";
          ort.env.wasm.numThreads = 1;
          
          console.log("Loading YOLO model...");
          sessionRef.current = await ort.InferenceSession.create(modelUrl);
          console.log("YOLO model loaded successfully");
          setIsLoading(false);
        } catch (error) {
          console.error("Failed to load YOLO model:", error);
          setIsLoading(false);
          return;
        }
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      interval = setInterval(async () => {
        if (
          !isActive ||
          !videoRef.current ||
          videoRef.current.readyState < 2 ||
          !sessionRef.current ||
          isLoading
        ) {
          setDetections([]);
          return;
        }

        try {
          await runDetection();
        } catch (error) {
          console.error("Detection error:", error);
        }
      }, 1000); // Run detection every second for performance
    };

    const runDetection = async () => {
      if (!videoRef.current || !sessionRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;

      // Set canvas size to match YOLO input (640x640)
      const inputSize = 640;
      canvas.width = inputSize;
      canvas.height = inputSize;

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, inputSize, inputSize);

      // Get image data
      const imageData = ctx.getImageData(0, 0, inputSize, inputSize);
      
      // Preprocess image data for YOLO (normalize to 0-1, convert to RGB, reshape)
      const input = new Float32Array(3 * inputSize * inputSize);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const pixelIndex = i / 4;
        const r = imageData.data[i] / 255;
        const g = imageData.data[i + 1] / 255;
        const b = imageData.data[i + 2] / 255;
        
        // YOLO expects CHW format (channels first)
        input[pixelIndex] = r; // R channel
        input[pixelIndex + inputSize * inputSize] = g; // G channel  
        input[pixelIndex + 2 * inputSize * inputSize] = b; // B channel
      }

      // Create tensor
      const tensor = new ort.Tensor('float32', input, [1, 3, inputSize, inputSize]);

      // Run inference
      const results = await sessionRef.current.run({ images: tensor });
      
      // Process YOLO outputs
      const output = results.output0.data as Float32Array;
      const detectedObjects = processYOLOOutput(output, inputSize);
      
      setDetections(detectedObjects);
    };

    const processYOLOOutput = (output: Float32Array, inputSize: number): YOLODetection[] => {
      const detections: YOLODetection[] = [];
      const numDetections = output.length / 85; // YOLO outputs 85 values per detection (4 bbox + 1 confidence + 80 classes)
      
      for (let i = 0; i < numDetections; i++) {
        const offset = i * 85;
        const confidence = output[offset + 4];
        
        if (confidence > 0.5) { // Confidence threshold
          // Get bounding box (center_x, center_y, width, height)
          const centerX = output[offset];
          const centerY = output[offset + 1];
          const width = output[offset + 2];
          const height = output[offset + 3];
          
          // Convert to corner coordinates
          const x = centerX - width / 2;
          const y = centerY - height / 2;
          
          // Find the class with highest probability
          let maxClassProb = 0;
          let classIndex = 0;
          for (let j = 0; j < 80; j++) {
            const classProb = output[offset + 5 + j];
            if (classProb > maxClassProb) {
              maxClassProb = classProb;
              classIndex = j;
            }
          }
          
          const finalConfidence = confidence * maxClassProb;
          if (finalConfidence > 0.3) { // Final threshold
            detections.push({
              label: COCO_CLASSES[classIndex],
              confidence: finalConfidence,
              bbox: [x, y, width, height]
            });
          }
        }
      }
      
      return detections.slice(0, 10); // Limit to top 10 detections
    };

    if (isActive) {
      loadModelAndStart();
    } else {
      setDetections([]);
    }

    return () => {
      clearInterval(interval);
    };
  }, [isActive, videoRef]);

  return { detections, isLoading };
}
