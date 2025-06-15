
import { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, Eye, AlertTriangle, Users, Car, TreePine, Volume2, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { useYOLODetection } from '@/hooks/useYOLODetection';
import { DetectionCanvas } from './DetectionCanvas';

interface CameraViewProps {
  speak: (text: string) => void;
  detectedObjects: string[];
  onDetectedObjects: (objects: string[]) => void;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
}

export const CameraView = ({
  speak,
  detectedObjects,
  onDetectedObjects,
  isActive,
  onActiveChange,
}: CameraViewProps) => {
  const [lastDescription, setLastDescription] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Use YOLO object detection
  const { detections, isLoading } = useYOLODetection(videoRef, isActive);

  // Memoize the speak function to prevent unnecessary re-renders
  const speakCallback = useCallback(speak, []);

  // When detected objects change, show labels and give spoken description
  useEffect(() => {
    if (!isActive || detections.length === 0) {
      if (isActive && !isLoading) {
        onDetectedObjects([]);
        if (lastDescription !== 'No objects detected at the moment.') {
          setLastDescription('No objects detected at the moment.');
        }
      }
      return;
    }

    const labels = detections.map(d => d.label).slice(0, 5); // Top 5 detections
    onDetectedObjects(labels);

    let description = '';
    if (labels.length > 0) {
      const uniqueLabels = [...new Set(labels)];
      description = "I can see " + uniqueLabels.slice(0, 3).join(", ") + ".";
    }
    
    if (description !== lastDescription) {
      setLastDescription(description);
      speakCallback(description);
    }
  }, [detections, isActive, isLoading, onDetectedObjects, lastDescription, speakCallback]);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      onActiveChange(true);
      speakCallback('Camera activated. Loading YOLO object detection model...');
    } catch (error) {
      speakCallback('Unable to access camera. Please check permissions.');
      toast.error('Camera access denied');
    }
  }, [onActiveChange, speakCallback]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    onActiveChange(false);
    speakCallback('Camera stopped.');
  }, [stream, onActiveChange, speakCallback]);

  // Handle camera activation/deactivation - Fixed to prevent infinite loop
  useEffect(() => {
    if (isActive && !stream) {
      startCamera();
    }
    // Note: We don't auto-stop camera when isActive becomes false
    // This should be handled by the parent component calling stopCamera explicitly
  }, [isActive, stream, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">YOLO Object Detection</h2>
        <p className="text-gray-300">Advanced real-time object detection using YOLO + OpenCV</p>
      </div>

      {/* Camera Controls */}
      <div className="flex justify-center gap-4">
        <Button
          onClick={isActive ? stopCamera : startCamera}
          className={`${
            isActive
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          } text-white px-8 py-4 text-lg`}
          disabled={isLoading}
          onFocus={() => speakCallback(isActive ? 'Stop camera' : 'Start camera')}
        >
          {isLoading ? (
            <Loader className="w-6 h-6 mr-2 animate-spin" />
          ) : (
            <Camera className="w-6 h-6 mr-2" />
          )}
          {isLoading ? 'Loading Model...' : isActive ? 'Stop Camera' : 'Start Camera'}
        </Button>
      </div>

      {/* Loading Status */}
      {isLoading && (
        <Card className="bg-yellow-500/20 border-yellow-400/30 p-4">
          <div className="flex items-center gap-3">
            <Loader className="w-5 h-5 animate-spin text-yellow-400" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-200">Loading YOLO Model</h3>
              <p className="text-yellow-100 text-sm">This may take a moment on first load...</p>
            </div>
          </div>
        </Card>
      )}

      {/* Camera Feed with Detection Overlay */}
      {isActive && (
        <div className="relative mx-auto max-w-md">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg border-2 border-white/20"
            width={640}
            height={480}
          />
          
          {/* Detection Canvas Overlay */}
          <DetectionCanvas
            videoRef={videoRef}
            detections={detections}
            isActive={isActive && !isLoading}
          />

          {/* Live indicator */}
          <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            LIVE
          </div>

          {/* Detection count */}
          {detections.length > 0 && (
            <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
              {detections.length} detected
            </div>
          )}
        </div>
      )}

      {/* Detected Objects Display */}
      {isActive && detectedObjects.length > 0 && (
        <Card className="bg-white/10 border-white/20 p-4">
          <h3 className="text-lg font-semibold text-white mb-3">YOLO Detections:</h3>
          <div className="grid grid-cols-2 gap-2">
            {detectedObjects.map((object, index) => (
              <div
                key={index}
                className="bg-white/10 rounded-lg p-3 flex items-center gap-2"
              >
                {object.includes('person') && <Users className="w-5 h-5 text-blue-400" />}
                {object.includes('car') && <Car className="w-5 h-5 text-red-400" />}
                {object.includes('tree') && <TreePine className="w-5 h-5 text-green-400" />}
                {!object.includes('person') && !object.includes('car') && !object.includes('tree') &&
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                }
                <span className="text-white text-sm">{object}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Last Description */}
      {isActive && lastDescription && (
        <Card className="bg-blue-500/20 border-blue-400/30 p-4">
          <h3 className="text-lg font-semibold text-blue-200 mb-2">Latest YOLO Detection:</h3>
          <p className="text-white">{lastDescription}</p>
          <Button
            onClick={() => speakCallback(lastDescription)}
            className="mt-3 bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Volume2 className="w-4 h-4 mr-2" />
            Repeat Description
          </Button>
        </Card>
      )}

      {/* Voice Commands */}
      <Card className="bg-green-500/20 border-green-400/30 p-4">
        <h3 className="text-lg font-semibold text-green-200 mb-3">Voice Commands:</h3>
        <div className="grid grid-cols-1 gap-2 text-sm text-green-100">
          <div>"Hey Vision Start Camera" - Activate YOLO detection</div>
          <div>"Hey Vision Stop Camera" - Stop detection</div>
          <div>"Hey Vision Analyze" - Get current detections</div>
          <div>"Hey Vision What Do You See" - Describe scene</div>
        </div>
      </Card>
    </div>
  );
};
