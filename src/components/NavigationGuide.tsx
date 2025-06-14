
import { useState, useEffect } from 'react';
import { Navigation, MapPin, Compass, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface NavigationGuideProps {
  speak: (text: string) => void;
}

export const NavigationGuide = ({ speak }: NavigationGuideProps) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [location, setLocation] = useState<GeolocationPosition | null>(null);

  // Sample navigation steps
  const navigationSteps = [
    { 
      instruction: 'Walk straight ahead for 10 steps', 
      detail: 'Keep the sidewalk on your right side',
      type: 'straight' as const
    },
    { 
      instruction: 'Turn left at the intersection', 
      detail: 'Listen for traffic sounds before crossing',
      type: 'turn' as const
    },
    { 
      instruction: 'Continue straight for 20 steps', 
      detail: 'There is a building on your left',
      type: 'straight' as const
    },
    { 
      instruction: 'Destination ahead on your right', 
      detail: 'Look for the main entrance',
      type: 'destination' as const
    },
  ];

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(position);
          speak('Location acquired. Ready for navigation guidance.');
        },
        (error) => {
          speak('Unable to get your location. Navigation will work in relative mode.');
        }
      );
    }
  }, [speak]);

  const startNavigation = () => {
    setIsNavigating(true);
    setCurrentStep(0);
    speak(`Starting navigation guidance. ${navigationSteps[0].instruction}. ${navigationSteps[0].detail}`);
  };

  const nextStep = () => {
    if (currentStep < navigationSteps.length - 1) {
      const nextStepIndex = currentStep + 1;
      setCurrentStep(nextStepIndex);
      const step = navigationSteps[nextStepIndex];
      speak(`Step ${nextStepIndex + 1}. ${step.instruction}. ${step.detail}`);
    } else {
      setIsNavigating(false);
      speak('You have arrived at your destination. Navigation complete.');
    }
  };

  const repeatInstruction = () => {
    const step = navigationSteps[currentStep];
    speak(`Current step: ${step.instruction}. ${step.detail}`);
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    setCurrentStep(0);
    speak('Navigation stopped.');
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Walking Navigation</h2>
        <p className="text-gray-300">Step-by-step audio guidance for safe walking</p>
      </div>

      {/* Location Status */}
      <Card className="bg-white/10 border-white/20 p-4">
        <div className="flex items-center gap-3">
          <MapPin className={`w-6 h-6 ${location ? 'text-green-400' : 'text-yellow-400'}`} />
          <div>
            <div className="text-white font-medium">
              {location ? 'Location Found' : 'Location Unavailable'}
            </div>
            <div className="text-gray-300 text-sm">
              {location 
                ? `Lat: ${location.coords.latitude.toFixed(4)}, Lng: ${location.coords.longitude.toFixed(4)}`
                : 'Using relative navigation mode'
              }
            </div>
          </div>
        </div>
      </Card>

      {/* Navigation Controls */}
      <div className="flex justify-center gap-4">
        {!isNavigating ? (
          <Button
            onClick={startNavigation}
            className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 text-lg"
            onFocus={() => speak('Start navigation guidance')}
          >
            <Navigation className="w-6 h-6 mr-2" />
            Start Navigation
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button
              onClick={nextStep}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3"
              onFocus={() => speak('Next step')}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Next Step
            </Button>
            <Button
              onClick={repeatInstruction}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3"
              onFocus={() => speak('Repeat current instruction')}
            >
              <Compass className="w-5 h-5 mr-2" />
              Repeat
            </Button>
            <Button
              onClick={stopNavigation}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3"
              onFocus={() => speak('Stop navigation')}
            >
              Stop
            </Button>
          </div>
        )}
      </div>

      {/* Current Navigation Step */}
      {isNavigating && (
        <Card className="bg-blue-500/20 border-blue-400/30 p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
              {currentStep + 1}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white mb-2">
                {navigationSteps[currentStep].instruction}
              </h3>
              <p className="text-blue-200 mb-4">
                {navigationSteps[currentStep].detail}
              </p>
              <div className="flex items-center gap-2 text-blue-300 text-sm">
                <Compass className="w-4 h-4" />
                Step {currentStep + 1} of {navigationSteps.length}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* All Navigation Steps Preview */}
      <Card className="bg-white/5 border-white/10 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Navigation Preview:</h3>
        <div className="space-y-3">
          {navigationSteps.map((step, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                isNavigating && index === currentStep
                  ? 'bg-blue-500/30 border border-blue-400/50'
                  : isNavigating && index < currentStep
                  ? 'bg-green-500/20 border border-green-400/30'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              <div className={`rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold ${
                isNavigating && index === currentStep
                  ? 'bg-blue-500 text-white'
                  : isNavigating && index < currentStep
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-500 text-white'
              }`}>
                {index + 1}
              </div>
              <div>
                <div className="text-white font-medium">{step.instruction}</div>
                <div className="text-gray-300 text-sm">{step.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Safety Tips */}
      <Card className="bg-yellow-500/20 border-yellow-400/30 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-400 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-yellow-200 mb-2">Safety Reminders:</h3>
            <ul className="text-yellow-100 space-y-1 text-sm">
              <li>• Always listen for traffic sounds before crossing</li>
              <li>• Use your cane or guide dog as usual during navigation</li>
              <li>• Stop if you feel unsafe and ask for human assistance</li>
              <li>• Keep your phone volume at a comfortable level</li>
              <li>• Be aware of your surroundings at all times</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};
