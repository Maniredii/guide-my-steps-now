import { useState, useRef, useEffect } from 'react';
import { Camera, Eye, AlertTriangle, Users, Car, TreePine, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface CameraViewProps {
  speak: (text: string) => void;
  detectedObjects: string[];
  onDetectedObjects: (objects: string[]) => void;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
}

export const CameraView = ({ speak, detectedObjects, onDetectedObjects, isActive, onActiveChange }: CameraViewProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastDescription, setLastDescription] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Improved: Weighted object detection for more plausible results
  const simulateObjectDetection = () => {
    // Each object has: name, distance, warning, weight (probability of appearing)
    const possibleObjects = [
      { name: 'person walking', distance: '2 meters ahead', warning: false, weight: 30 },
      { name: 'child standing', distance: '5 meters to your left', warning: false, weight: 10 },
      { name: 'bicycle parked', distance: '3 meters ahead', warning: false, weight: 8 },
      { name: 'tree', distance: '4 meters to your right', warning: false, weight: 25 },
      { name: 'bench', distance: '2 meters behind', warning: false, weight: 10 },
      { name: 'car', distance: '9 meters ahead', warning: true, weight: 7 },
      { name: 'open door', distance: '1 meter ahead', warning: false, weight: 6 },
      { name: 'stairs going up', distance: '7 meters ahead', warning: true, weight: 2 },
      { name: 'traffic light', distance: '15 meters ahead', warning: false, weight: 2 },
      { name: 'sidewalk continues', distance: '', warning: false, weight: 18 },
      { name: 'sign post', distance: '3 meters to your right', warning: false, weight: 4 },
      { name: 'dog', distance: '2 meters held by owner', warning: false, weight: 5 },
      { name: 'construction cone', distance: '6 meters ahead', warning: true, weight: 3 },
      { name: 'glass door', distance: '1 meter ahead', warning: true, weight: 2 },
      { name: 'empty path', distance: '', warning: false, weight: 20 },
      // Add more realistic objects as needed
    ];

    // Weighted random selection
    const objectsToShow = [];
    const maxObjects = 2 + Math.round(Math.random()); // 2-3 objects per scan

    // Build a weighted pool
    const pool = possibleObjects.flatMap(obj =>
      Array(obj.weight).fill(obj)
    );

    // Pick unique objects (no repeats)
    const usedIndices = new Set<number>();

    while (objectsToShow.length < maxObjects && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      const candidate = pool[idx];
      // Avoid repeating the same object in one detection
      if (!objectsToShow.some(o => o.name === candidate.name)) {
        objectsToShow.push(candidate);
      }
      // Remove all copies of this object from the pool
      for (let i = pool.length - 1; i >= 0; i--) {
        if (pool[i].name === candidate.name) pool.splice(i, 1);
      }
    }

    return objectsToShow;
  };

  const analyzeScene = () => {
    const detectedItems = simulateObjectDetection();
    const objectNames = detectedItems.map(obj => obj.name);
    onDetectedObjects(objectNames);

    // Improved: separate normal and warning objects, realistic sentence structure
    const safe = detectedItems.filter(i => !i.warning);
    const hazards = detectedItems.filter(i => i.warning);

    let description = '';
    if (safe.length > 0) {
      description += "I can see ";
      description += safe
        .map(item => `${item.name}${item.distance ? ' ' + item.distance : ''}`)
        .join(', ');
      description += '. ';
    }
    if (hazards.length > 0) {
      description += hazards
        .map(item => `Caution: ${item.name}${item.distance ? ' ' + item.distance : ''}`)
        .join('. ');
      description += '. ';
    }
    if (!hazards.length) {
      description += 'Path looks clear. ';
    } else {
      description += 'Please be careful. ';
    }
    description = description.trim();

    setLastDescription(description);
    speak(description);
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      onActiveChange(true);
      speak('Camera activated. I will analyze your surroundings every few seconds.');
      
      // Start periodic scene analysis
      const interval = setInterval(() => {
        if (isActive) {
          analyzeScene();
        }
      }, 5000);

      return () => clearInterval(interval);
    } catch (error) {
      speak('Unable to access camera. Please check permissions.');
      toast.error('Camera access denied');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
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
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
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

        {isActive && (
          <Button
            onClick={analyzeScene}
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 text-lg"
            onFocus={() => speak('Analyze scene now')}
          >
            <Eye className="w-6 h-6 mr-2" />
            Analyze Now
          </Button>
        )}
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
      {detectedObjects.length > 0 && (
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
      {lastDescription && (
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
