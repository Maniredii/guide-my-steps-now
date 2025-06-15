
import { useState, useRef } from "react";

// Simple color-based path segmentation demo
export function usePathSegmentation(videoEl: HTMLVideoElement | null, isActive: boolean) {
  const [hasPath, setHasPath] = useState(false);
  const lastCheck = useRef<number>(0);

  // Demo: Checks periodically if the center bottom of the frame is "bright enough"
  const analyzeFrame = () => {
    if (!videoEl) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    // Sample a strip at bottom center
    let sum = 0, count = 0;
    for (let x = canvas.width / 3; x < 2 * canvas.width / 3; x += 8) {
      for (let y = canvas.height - 60; y < canvas.height; y += 8) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        const brightness = (r + g + b) / 3;
        sum += brightness;
        count++;
      }
    }
    const avg = sum / count;
    setHasPath(avg > 70); // > 70 means "clear/light", demo value
    lastCheck.current = Date.now();
  };

  // Hook: check every 900ms when active
  if (isActive && videoEl && Date.now() - lastCheck.current > 900) {
    analyzeFrame();
  }

  return { hasPath };
}
