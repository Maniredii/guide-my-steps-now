
import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";

// These labels are the 1000 ImageNet classes the default MobileNet recognizes.
import IMAGENET_CLASSES from "./imagenet_classes.json"; // We'll create this as well

type DetectionResult = { label: string; confidence: number }[];

export function useRealTimeObjectDetection(videoRef: React.RefObject<HTMLVideoElement>, isActive: boolean) {
  const [detected, setDetected] = useState<DetectionResult>([]);
  const modelRef = useRef<tf.GraphModel | null>(null);

  useEffect(() => {
    let interval: any;

    const loadModelAndStart = async () => {
      if (!modelRef.current) {
        // Loads from TensorFlow Hub, will cache after first load
        modelRef.current = await tf.loadGraphModel(
          "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_140_224/classification/4/default/1",
          { fromTFHub: true }
        );
      }

      interval = setInterval(async () => {
        if (
          !isActive ||
          !videoRef.current ||
          videoRef.current.readyState < 2 ||
          !modelRef.current
        ) {
          setDetected([]);
          return;
        }

        const video = videoRef.current;
        // Get frame from video, resize to 224x224, normalize and predict
        const input = tf.browser.fromPixels(video).resizeNearestNeighbor([224, 224]).toFloat().expandDims(0).div(255);
        const logits = modelRef.current.predict(input) as tf.Tensor;
        const data = await logits.data();
        input.dispose();
        logits.dispose();

        // Find top 3 predictions (>15% confidence)
        const results: DetectionResult = [];
        for (let i = 0; i < 3; ++i) {
          const idx = data.indexOf(Math.max(...data));
          const confidence = data[idx];
          if (confidence > 0.15) {
            results.push({ label: IMAGENET_CLASSES[idx], confidence });
            data[idx] = -1; // So next max() is the 2nd, etc
          }
        }
        setDetected(results);
      }, 1200); // every ~1.2 seconds

    };

    if (isActive) {
      loadModelAndStart();
    } else {
      setDetected([]);
    }

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line
  }, [isActive, videoRef]);

  return detected;
}
