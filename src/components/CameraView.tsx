
import { useRef, useEffect, useState } from 'react';
import { Camera, Eye, AlertTriangle, Users, Car, TreePine, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { useRealTimeObjectDetection } from '@/hooks/useRealTimeObjectDetection';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use real object detection
  const detected = useRealTimeObjectDetection(videoRef, isActive);

  // When detected objects change, show labels and give spoken description
  useEffect(() => {
    if (!isActive || detected.length === 0) {
      if (isActive) {
        onDetectedObjects([]);
        setLastDescription('Nothing recognized confidently at the moment.');
      }
      return;
    }
    const labels = detected.map(d => d.label).filter(label => !!label);
    onDetectedObjects(labels);

    let description = '';
    if (labels.length) {
      description = "I can see " + labels.slice(0, 3).map((l, idx) =>
        idx === 0 ? l : "and " + l
      ).join(", ") + 
      '.';
    }
    setLastDescription(description);
    speak(description);
    // eslint-disable-next-line
  }, [JSON.stringify(detected), isActive]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      onActiveChange(true);
      speak('Camera activated. I will analyze what is visible in front of you.');
    } catch (error) {
      speak('Unable to access camera. Please check permissions.');
      toast.error('Camera access denied');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    onActiveChange(false);
    speak('Camera stopped.');
  };

  useEffect(() => {
    if (isActive && !stream) {
      startCamera();
    } else if (!isActive && stream) {
      stopCamera();
    }
    // eslint-disable-next-line
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line
  }, [stream]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Smart Vision Assistant</h2>
        <p className="text-gray-300">Say "Hey Vision Start Camera" or "Hey Vision Analyze" to use voice commands</p>
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
          onFocus={() => speak(isActive ? 'Stop camera' : 'Start camera')}
        >
          <Camera className="w-6 h-6 mr-2" />
          {isActive ? 'Stop Camera' : 'Start Camera'}
        </Button>
      </div>

      {/* Camera Feed */}
      {isActive && (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-w-md mx-auto rounded-lg border-2 border-white/20"
            width={320}
            height={240}
          />
          <canvas
            ref={canvasRef}
            className="hidden"
          />

          {/* Live indicator */}
          <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            LIVE
          </div>
        </div>
      )}

      {/* Detected Objects Display */}
      {isActive && detectedObjects.length > 0 && (
        <Card className="bg-white/10 border-white/20 p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Currently Detected:</h3>
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
          <h3 className="text-lg font-semibold text-blue-200 mb-2">Latest Scene Description:</h3>
          <p className="text-white">{lastDescription}</p>
          <Button
            onClick={() => speak(lastDescription)}
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
          <div>"Hey Vision Start Camera" - Activate camera</div>
          <div>"Hey Vision Stop Camera" - Stop camera</div>
          <div>"Hey Vision Analyze" - Describe surroundings</div>
          <div>"Hey Vision What Do You See" - Get scene description</div>
        </div>
      </Card>
    </div>
  );
};
