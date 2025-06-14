
import { useState, useEffect } from 'react';
import { Navigation, Play, Pause, RotateCcw, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface NavigationGuideProps {
  speak: (text: string) => void;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
}

export const NavigationGuide = ({ speak, isActive, onActiveChange }: NavigationGuideProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const navigationSteps = [
    "Welcome to navigation mode. I will guide you step by step.",
    "Face forward and take 5 steps straight ahead.",
    "Good! Now turn slightly right and continue for 10 steps.",
    "Excellent progress. Walk straight for 8 more steps.",
    "Turn left at the intersection and walk 12 steps forward.",
    "You're doing great! Continue straight for 6 steps.",
    "Turn right and walk 4 steps to reach your destination.",
    "Congratulations! You have reached your destination safely."
  ];

  const startNavigation = () => {
    setIsNavigating(true);
    setCurrentStep(0);
    onActiveChange(true);
    speak(navigationSteps[0]);
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    onActiveChange(false);
    speak("Navigation stopped. You can restart anytime by saying Hey Vision Start Navigation.");
  };

  const nextStep = () => {
    if (currentStep < navigationSteps.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      speak(navigationSteps[newStep]);
    } else {
      speak("Navigation complete! You have reached your destination.");
      setIsNavigating(false);
      onActiveChange(false);
    }
  };

  const repeatStep = () => {
    speak(navigationSteps[currentStep]);
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      speak("Getting your current location...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          speak(`Your current coordinates are latitude ${position.coords.latitude.toFixed(4)}, longitude ${position.coords.longitude.toFixed(4)}`);
        },
        () => {
          speak("Unable to get your location. Please check location permissions.");
        }
      );
    } else {
      speak("Location services are not available on this device.");
    }
  };

  useEffect(() => {
    if (isActive && !isNavigating) {
      startNavigation();
    } else if (!isActive && isNavigating) {
      stopNavigation();
    }
  }, [isActive]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Walking Navigation Guide</h2>
        <p className="text-gray-300">Use voice commands: "Hey Vision Start Navigation", "Hey Vision Next Step", "Hey Vision Repeat"</p>
      </div>

      {/* Navigation Status */}
      <Card className={`${isNavigating ? 'bg-green-500/20 border-green-400/30' : 'bg-gray-500/20 border-gray-400/30'} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Navigation className={`w-8 h-8 ${isNavigating ? 'text-green-400' : 'text-gray-400'}`} />
            <div>
              <h3 className="text-lg font-semibold text-white">
                {isNavigating ? 'Navigation Active' : 'Navigation Ready'}
              </h3>
              <p className="text-gray-300 text-sm">
                {isNavigating ? `Step ${currentStep + 1} of ${navigationSteps.length}` : 'Say "Hey Vision Start Navigation" to begin'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Current Step Display */}
      {isNavigating && (
        <Card className="bg-blue-500/20 border-blue-400/30 p-6">
          <h3 className="text-xl font-semibold text-blue-200 mb-3">Current Instruction:</h3>
          <p className="text-white text-lg mb-4">{navigationSteps[currentStep]}</p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={nextStep}
              className="bg-green-500 hover:bg-green-600 text-white"
              disabled={currentStep >= navigationSteps.length - 1}
            >
              <Play className="w-4 h-4 mr-2" />
              Next Step
            </Button>
            <Button
              onClick={repeatStep}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Repeat
            </Button>
          </div>
        </Card>
      )}

      {/* Navigation Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button
          onClick={isNavigating ? stopNavigation : startNavigation}
          className={`${
            isNavigating 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-green-500 hover:bg-green-600'
          } text-white h-16 text-lg`}
          onFocus={() => speak(isNavigating ? 'Stop navigation' : 'Start navigation')}
        >
          {isNavigating ? (
            <>
              <Pause className="w-6 h-6 mr-2" />
              Stop Navigation
            </>
          ) : (
            <>
              <Play className="w-6 h-6 mr-2" />
              Start Navigation
            </>
          )}
        </Button>

        <Button
          onClick={getCurrentLocation}
          className="bg-purple-500 hover:bg-purple-600 text-white h-16 text-lg"
          onFocus={() => speak('Get current location')}
        >
          <MapPin className="w-6 h-6 mr-2" />
          Current Location
        </Button>
      </div>

      {/* Progress Indicator */}
      {isNavigating && (
        <Card className="bg-white/10 border-white/20 p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Navigation Progress</h3>
          <div className="w-full bg-gray-700 rounded-full h-4">
            <div
              className="bg-green-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / navigationSteps.length) * 100}%` }}
            ></div>
          </div>
          <p className="text-gray-300 text-sm mt-2 text-center">
            Step {currentStep + 1} of {navigationSteps.length}
          </p>
        </Card>
      )}

      {/* Voice Commands */}
      <Card className="bg-green-500/20 border-green-400/30 p-4">
        <h3 className="text-lg font-semibold text-green-200 mb-3">Navigation Voice Commands:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-green-100">
          <div>"Hey Vision Start Navigation" - Begin guidance</div>
          <div>"Hey Vision Next Step" - Continue to next instruction</div>
          <div>"Hey Vision Repeat" - Repeat current instruction</div>
          <div>"Hey Vision Stop Navigation" - End guidance</div>
        </div>
      </Card>

      {/* Safety Tips */}
      <Card className="bg-yellow-500/20 border-yellow-400/30 p-4">
        <h3 className="text-lg font-semibold text-yellow-200 mb-3">Safety Tips:</h3>
        <ul className="text-yellow-100 space-y-1 text-sm">
          <li>• Always use your white cane or guide dog while navigating</li>
          <li>• Listen carefully to your surroundings and traffic sounds</li>
          <li>• Take your time and don't rush through instructions</li>
          <li>• Stop navigation if you feel unsafe or confused</li>
          <li>• Ask for human assistance when needed</li>
        </ul>
      </Card>
    </div>
  );
};
