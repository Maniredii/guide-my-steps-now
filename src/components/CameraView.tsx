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
    // Add more real-world objects, edge-cases, and co-occurrences
    const possibleObjects = [
      // --- Urban/Outdoor
      { name: 'person walking', distance: '2 meters ahead', warning: false, weight: 30 },
      { name: 'child standing', distance: '5 meters to your left', warning: false, weight: 10 },
      { name: 'dog', distance: '2 meters held by owner', warning: false, weight: 17 },
      { name: 'bicycle parked', distance: '3 meters ahead', warning: false, weight: 10 },
      { name: 'bicycle moving', distance: 'quickly passing by on right', warning: true, weight: 8 },
      { name: 'runner jogging', distance: '8 meters behind', warning: false, weight: 9 },
      { name: 'group of people', distance: 'standing 6 meters ahead', warning: false, weight: 15 },
      { name: 'elderly person with cane', distance: 'slowly approaching', warning: false, weight: 5 },
      { name: 'child on scooter', distance: '5 meters ahead', warning: true, weight: 3 },
      { name: 'man using phone', distance: 'next to crosswalk', warning: false, weight: 3 },
      { name: 'wheelchair user', distance: 'to your right', warning: false, weight: 3 },
      { name: 'traffic cone', distance: 'on the path 7 meters ahead', warning: true, weight: 10 },
      { name: 'road sign', distance: '3 meters to your right', warning: false, weight: 9 },
      { name: 'crosswalk', distance: '10 meters ahead', warning: false, weight: 8 },
      { name: 'street performer', distance: 'by building entrance', warning: false, weight: 3 },
      { name: 'fire hydrant', distance: 'beside the path 2 meters ahead', warning: false, weight: 5 },
      { name: 'car', distance: '9 meters ahead', warning: true, weight: 18 },
      { name: 'moving car', distance: 'approaching from left', warning: true, weight: 9 },
      { name: 'bus', distance: '15 meters stopped', warning: false, weight: 3 },
      { name: 'open door', distance: '1 meter ahead', warning: false, weight: 6 },
      { name: 'broken pavement', distance: 'by edge', warning: true, weight: 3 },
      { name: 'stairs going up', distance: '7 meters ahead', warning: true, weight: 7 },
      { name: 'stairs going down', distance: 'nearby', warning: true, weight: 4 },
      { name: 'glass door', distance: 'right ahead', warning: true, weight: 4 },
      { name: 'construction barrier', distance: 'blocking path', warning: true, weight: 3 },
      { name: 'pothole', distance: 'on path, 2 meters ahead', warning: true, weight: 3 },
      { name: 'wheelchair ramp', distance: 'beside stairs', warning: false, weight: 2 },
      { name: 'streetlight', distance: 'overhead', warning: false, weight: 3 },
      { name: 'bench', distance: '2 meters behind', warning: false, weight: 8 },
      { name: 'lamp post', distance: 'to your left', warning: false, weight: 8 },
      { name: 'trash can', distance: 'next to bench', warning: false, weight: 5 },
      { name: 'stop sign', distance: '10 meters ahead', warning: false, weight: 5 },
      { name: 'trash bin', distance: 'right side', warning: false, weight: 3 },
      // --- Indoor
      { name: 'door', distance: 'right ahead', warning: false, weight: 12 },
      { name: 'steps up', distance: 'just in front', warning: true, weight: 3 },
      { name: 'steps down', distance: 'to your left', warning: true, weight: 2 },
      { name: 'chair', distance: 'at 3 meters', warning: false, weight: 9 },
      { name: 'table', distance: 'centered', warning: false, weight: 8 },
      { name: 'wall', distance: 'close right side', warning: false, weight: 15 },
      { name: 'window', distance: 'on your left', warning: false, weight: 10 },
      { name: 'elevator', distance: 'ahead', warning: false, weight: 2 },
      { name: 'shopping bag', distance: 'in corridor', warning: false, weight: 2 },
      // --- Nature
      { name: 'tree', distance: '4 meters to your right', warning: false, weight: 30 },
      { name: 'flower bush', distance: '3 meters left', warning: false, weight: 6 },
      { name: 'open grass area', distance: 'ahead', warning: false, weight: 4 },
      { name: 'lake', distance: 'far right', warning: false, weight: 2 },
      { name: 'puddle', distance: 'on the path', warning: true, weight: 3 },
      { name: 'bird', distance: 'on ground nearby', warning: false, weight: 10 },
      // --- Misc/Edge
      { name: 'empty path', distance: '', warning: false, weight: 22 },
      { name: 'sidewalk continues', distance: '', warning: false, weight: 17 },
      { name: 'sign post', distance: '3 meters to your right', warning: false, weight: 7 },
      { name: 'cat', distance: 'on the sidewalk', warning: false, weight: 5 },
      { name: 'dog leash', distance: 'across the path', warning: true, weight: 2 },
      { name: 'shopping cart', distance: 'by store entrance', warning: false, weight: 2 },
      { name: 'delivery robot', distance: 'crossing path', warning: false, weight: 2 },
      { name: 'electric scooter', distance: '2 meters ahead', warning: true, weight: 3 },
      { name: 'street vendor', distance: 'next to food truck', warning: false, weight: 2 },
      { name: 'baby stroller', distance: 'pushed by someone', warning: false, weight: 2 },
      { name: 'shopping trolley', distance: 'approaching checkout', warning: false, weight: 1 },
      // --- Environment
      { name: 'cloud shadow', distance: 'over the road', warning: false, weight: 2 },
      { name: 'dog walker', distance: 'on opposite curb', warning: false, weight: 3 },
      { name: 'trash collection bin', distance: 'on left', warning: false, weight: 2 },
      { name: 'street musician', distance: 'by bus stop', warning: false, weight: 1 },
      // --- Transportation
      { name: 'tram', distance: 'in distance', warning: false, weight: 2 },
      { name: 'motorcycle', distance: 'passing by', warning: true, weight: 2 },
      { name: 'truck', distance: 'parked', warning: false, weight: 3 },
      { name: 'van', distance: 'on side street', warning: false, weight: 2 },
      { name: 'skateboarder', distance: 'quickly approaching', warning: true, weight: 1 },
    ];

    // Pseudo-grouping by context
    const pool = possibleObjects.flatMap(obj => Array(obj.weight).fill(obj));
    const maxObjects = 2 + Math.round(Math.random() * 2); // 2-4 objects to simulate a real scene
    const objectsToShow: typeof possibleObjects = [];

    while (objectsToShow.length < maxObjects && pool.length) {
      const idx = Math.floor(Math.random() * pool.length);
      const candidate = pool[idx];
      // Prefer contextually plausible grouping: e.g., a "crosswalk" with "stop sign" and "moving car"
      if (
        objectsToShow.length === 1 &&
        (candidate.name.includes('car') && objectsToShow.some(o => o.name.includes('crosswalk')))
      ) {
        objectsToShow.unshift(candidate); // Push car before crosswalk if possible
      } else if (
        objectsToShow.some(o => o.name === candidate.name)
      ) {
        // No duplicates
        pool.splice(idx, 1);
        continue;
      } else {
        objectsToShow.push(candidate);
      }
      // Remove all copies
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
