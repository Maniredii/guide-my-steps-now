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
  const detectionHistoryRef = useRef<YOLODetection[][]>([]);

  useEffect(() => {
    let interval: any;

    const loadModelAndStart = async () => {
      if (!sessionRef.current) {
        setIsLoading(true);
        try {
          // Using a public YOLOv8n ONNX model (lightweight version)
          const modelUrl = "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.onnx";
          
          // Enhanced ONNX Runtime configuration for better performance
          ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/";
          ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
          ort.env.wasm.simd = true;
          ort.env.webgl.contextId = "webgl2";
          
          console.log("Loading enhanced YOLO model...");
          sessionRef.current = await ort.InferenceSession.create(modelUrl, {
            executionProviders: ['webgl', 'wasm'],
            graphOptimizationLevel: 'all'
          });
          console.log("Enhanced YOLO model loaded successfully");
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

      // Enhanced detection frequency for better accuracy
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
      }, 500); // Increased frequency for better accuracy
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

      // Enhanced image preprocessing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, 0, 0, inputSize, inputSize);

      // Get image data with enhanced processing
      const imageData = ctx.getImageData(0, 0, inputSize, inputSize);
      
      // Enhanced preprocessing with normalization
      const input = new Float32Array(3 * inputSize * inputSize);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const pixelIndex = i / 4;
        // Enhanced normalization with gamma correction
        const r = Math.pow(imageData.data[i] / 255, 0.8);
        const g = Math.pow(imageData.data[i + 1] / 255, 0.8);
        const b = Math.pow(imageData.data[i + 2] / 255, 0.8);
        
        // YOLO expects CHW format (channels first)
        input[pixelIndex] = r; // R channel
        input[pixelIndex + inputSize * inputSize] = g; // G channel  
        input[pixelIndex + 2 * inputSize * inputSize] = b; // B channel
      }

      // Create tensor with enhanced configuration
      const tensor = new ort.Tensor('float32', input, [1, 3, inputSize, inputSize]);

      // Run inference with timeout
      const results = await Promise.race([
        sessionRef.current.run({ images: tensor }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Inference timeout')), 5000))
      ]) as any;
      
      // Enhanced YOLO output processing
      const output = results.output0.data as Float32Array;
      const detectedObjects = processYOLOOutput(output, inputSize);
      
      // Apply temporal smoothing for better accuracy
      const smoothedDetections = applyTemporalSmoothing(detectedObjects);
      setDetections(smoothedDetections);
    };

    const processYOLOOutput = (output: Float32Array, inputSize: number): YOLODetection[] => {
      const detections: YOLODetection[] = [];
      const numDetections = output.length / 85;
      
      for (let i = 0; i < numDetections; i++) {
        const offset = i * 85;
        const confidence = output[offset + 4];
        
        // Lowered confidence threshold for better detection
        if (confidence > 0.3) {
          const centerX = output[offset];
          const centerY = output[offset + 1];
          const width = output[offset + 2];
          const height = output[offset + 3];
          
          const x = centerX - width / 2;
          const y = centerY - height / 2;
          
          // Enhanced class probability calculation
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
          // Lowered final threshold for better detection
          if (finalConfidence > 0.2) {
            detections.push({
              label: COCO_CLASSES[classIndex],
              confidence: finalConfidence,
              bbox: [x, y, width, height]
            });
          }
        }
      }
      
      // Enhanced Non-Maximum Suppression
      return applyNMS(detections).slice(0, 15);
    };

    // Apply Non-Maximum Suppression to remove duplicate detections
    const applyNMS = (detections: YOLODetection[], iouThreshold = 0.5): YOLODetection[] => {
      if (detections.length === 0) return [];
      
      // Sort by confidence
      detections.sort((a, b) => b.confidence - a.confidence);
      
      const keep: YOLODetection[] = [];
      const suppressed = new Set<number>();
      
      for (let i = 0; i < detections.length; i++) {
        if (suppressed.has(i)) continue;
        
        keep.push(detections[i]);
        
        for (let j = i + 1; j < detections.length; j++) {
          if (suppressed.has(j)) continue;
          
          const iou = calculateIOU(detections[i].bbox, detections[j].bbox);
          if (iou > iouThreshold && detections[i].label === detections[j].label) {
            suppressed.add(j);
          }
        }
      }
      
      return keep;
    };

    // Calculate Intersection over Union
    const calculateIOU = (box1: [number, number, number, number], box2: [number, number, number, number]): number => {
      const [x1, y1, w1, h1] = box1;
      const [x2, y2, w2, h2] = box2;
      
      const xA = Math.max(x1, x2);
      const yA = Math.max(y1, y2);
      const xB = Math.min(x1 + w1, x2 + w2);
      const yB = Math.min(y1 + h1, y2 + h2);
      
      const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
      const box1Area = w1 * h1;
      const box2Area = w2 * h2;
      const unionArea = box1Area + box2Area - interArea;
      
      return unionArea === 0 ? 0 : interArea / unionArea;
    };

    // Apply temporal smoothing to reduce flickering
    const applyTemporalSmoothing = (currentDetections: YOLODetection[]): YOLODetection[] => {
      detectionHistoryRef.current.push(currentDetections);
      if (detectionHistoryRef.current.length > 3) {
        detectionHistoryRef.current.shift();
      }
      
      if (detectionHistoryRef.current.length < 2) {
        return currentDetections;
      }
      
      // Find consistent detections across frames
      const consistentDetections: YOLODetection[] = [];
      
      for (const detection of currentDetections) {
        let consistencyCount = 1;
        
        for (let i = 0; i < detectionHistoryRef.current.length - 1; i++) {
          const historicalFrame = detectionHistoryRef.current[i];
          const matchingDetection = historicalFrame.find(d => 
            d.label === detection.label && 
            calculateIOU(d.bbox, detection.bbox) > 0.3
          );
          
          if (matchingDetection) {
            consistencyCount++;
          }
        }
        
        // Only keep detections that appear in at least 2 of the last 3 frames
        if (consistencyCount >= 2) {
          consistentDetections.push(detection);
        }
      }
      
      return consistentDetections.length > 0 ? consistentDetections : currentDetections;
    };

    if (isActive) {
      loadModelAndStart();
    } else {
      setDetections([]);
      detectionHistoryRef.current = [];
    }

    return () => {
      clearInterval(interval);
    };
  }, [isActive, videoRef]);

  return { detections, isLoading };
}
