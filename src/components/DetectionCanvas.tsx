
import React, { useRef, useEffect } from 'react';

type Detection = {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
};

interface DetectionCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  detections: Detection[];
  isActive: boolean;
}

export const DetectionCanvas: React.FC<DetectionCanvasProps> = ({
  videoRef,
  detections,
  isActive
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isActive || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw detection boxes
    detections.forEach((detection) => {
      const [x, y, width, height] = detection.bbox;
      
      // Scale coordinates from YOLO input size (640x640) to video size
      const scaleX = canvas.width / 640;
      const scaleY = canvas.height / 640;
      
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;

      // Draw bounding box
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw label background
      ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
      const labelText = `${detection.label} ${(detection.confidence * 100).toFixed(1)}%`;
      const textMetrics = ctx.measureText(labelText);
      ctx.fillRect(scaledX, scaledY - 25, textMetrics.width + 10, 25);

      // Draw label text
      ctx.fillStyle = '#000000';
      ctx.font = '14px Arial';
      ctx.fillText(labelText, scaledX + 5, scaledY - 8);
    });
  }, [detections, isActive, videoRef]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
};
