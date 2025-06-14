
import { useState, useRef, useEffect } from 'react';
import { Camera, Volume2, Navigation, Phone, Settings, Mic, MicOff, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { CameraView } from '@/components/CameraView';
import { VoiceControls } from '@/components/VoiceControls';
import { NavigationGuide } from '@/components/NavigationGuide';
import { EmergencyPanel } from '@/components/EmergencyPanel';
import { SettingsPanel } from '@/components/SettingsPanel';

const Index = () => {
  const [activeMode, setActiveMode] = useState<'camera' | 'navigation' | 'emergency' | 'settings'>('camera');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);

  // Speech synthesis for voice feedback
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Voice command handler
  const handleVoiceCommand = (command: string) => {
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('camera') || lowerCommand.includes('see')) {
      setActiveMode('camera');
      speak('Camera mode activated. I will describe what I see around you.');
    } else if (lowerCommand.includes('navigate') || lowerCommand.includes('walk')) {
      setActiveMode('navigation');
      speak('Navigation mode activated. I will guide your steps.');
    } else if (lowerCommand.includes('emergency') || lowerCommand.includes('help')) {
      setActiveMode('emergency');
      speak('Emergency panel opened. Say call emergency for immediate assistance.');
    } else if (lowerCommand.includes('settings')) {
      setActiveMode('settings');
      speak('Settings panel opened.');
    } else {
      speak('I heard: ' + command + '. You can say camera, navigate, emergency, or settings.');
    }
  };

  useEffect(() => {
    // Welcome message when app loads
    setTimeout(() => {
      speak('Welcome to your personal vision assistant. I am here to help you navigate safely. You can use voice commands or tap the large buttons. Say camera to start object detection.');
    }, 1000);
  }, []);

  const modes = [
    {
      id: 'camera' as const,
      icon: Camera,
      label: 'Smart Vision',
      description: 'Detect objects and describe surroundings',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      id: 'navigation' as const,
      icon: Navigation,
      label: 'Walk Guide',
      description: 'Step-by-step navigation assistance',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      id: 'emergency' as const,
      icon: Phone,
      label: 'Emergency',
      description: 'Quick access to emergency contacts',
      color: 'bg-red-500 hover:bg-red-600'
    },
    {
      id: 'settings' as const,
      icon: Settings,
      label: 'Settings',
      description: 'Customize voice and preferences',
      color: 'bg-purple-500 hover:bg-purple-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Vision Guide</h1>
          <div className="flex items-center gap-2">
            {isSpeaking && (
              <div className="flex items-center gap-2 text-green-400">
                <Volume2 className="w-5 h-5 animate-pulse" />
                <span className="text-sm">Speaking...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 space-y-6">
        {/* Mode Selection - Large accessible buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {modes.map((mode) => {
            const IconComponent = mode.icon;
            return (
              <Button
                key={mode.id}
                onClick={() => {
                  setActiveMode(mode.id);
                  speak(mode.label + ' mode activated');
                }}
                className={`${mode.color} text-white h-24 text-left p-6 transition-all duration-300 transform hover:scale-105 ${
                  activeMode === mode.id ? 'ring-4 ring-white/50 scale-105' : ''
                }`}
                onFocus={() => speak(mode.label + '. ' + mode.description)}
              >
                <div className="flex items-center gap-4">
                  <IconComponent className="w-8 h-8" />
                  <div>
                    <div className="text-xl font-bold">{mode.label}</div>
                    <div className="text-sm opacity-90">{mode.description}</div>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>

        {/* Voice Controls */}
        <VoiceControls
          isListening={isListening}
          onListeningChange={setIsListening}
          onVoiceCommand={handleVoiceCommand}
          speak={speak}
        />

        {/* Active Mode Content */}
        <Card className="bg-black/20 backdrop-blur-sm border-white/10 p-6">
          {activeMode === 'camera' && (
            <CameraView
              speak={speak}
              detectedObjects={detectedObjects}
              onDetectedObjects={setDetectedObjects}
            />
          )}
          
          {activeMode === 'navigation' && (
            <NavigationGuide speak={speak} />
          )}
          
          {activeMode === 'emergency' && (
            <EmergencyPanel speak={speak} />
          )}
          
          {activeMode === 'settings' && (
            <SettingsPanel speak={speak} />
          )}
        </Card>

        {/* Quick Actions Footer */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2">
          <Button
            onClick={() => speak('Vision Guide is ready to assist you. Current mode: ' + activeMode)}
            className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 rounded-full px-8 py-3"
          >
            <Volume2 className="w-5 h-5 mr-2" />
            Status Check
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
