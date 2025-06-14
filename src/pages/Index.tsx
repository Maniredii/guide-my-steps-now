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
  const [cameraActive, setCameraActive] = useState(false);
  const [navigationActive, setNavigationActive] = useState(false);
  
  // Voice settings state
  const [voiceSettings, setVoiceSettings] = useState({
    rate: 0.8,
    pitch: 1,
    volume: 1,
    enabled: true
  });

  // Speech synthesis for voice feedback
  const speak = (text: string) => {
    if ('speechSynthesis' in window && voiceSettings.enabled) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = voiceSettings.rate;
      utterance.pitch = voiceSettings.pitch;
      utterance.volume = voiceSettings.volume;
      
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
      speak('Settings panel opened. You can adjust speech settings with voice commands.');
    }
  };

  // Handle settings changes via voice
  const handleSettingsChange = (setting: string, value: any) => {
    if (setting === 'speechRate') {
      if (value === 'increase') {
        const newRate = Math.min(voiceSettings.rate + 0.1, 2);
        setVoiceSettings(prev => ({ ...prev, rate: newRate }));
      } else if (value === 'decrease') {
        const newRate = Math.max(voiceSettings.rate - 0.1, 0.1);
        setVoiceSettings(prev => ({ ...prev, rate: newRate }));
      }
    } else if (setting === 'speechVolume') {
      if (value === 'increase') {
        const newVolume = Math.min(voiceSettings.volume + 0.1, 1);
        setVoiceSettings(prev => ({ ...prev, volume: newVolume }));
      } else if (value === 'decrease') {
        const newVolume = Math.max(voiceSettings.volume - 0.1, 0.1);
        setVoiceSettings(prev => ({ ...prev, volume: newVolume }));
      }
    } else if (setting === 'test') {
      speak('This is a test of your voice settings. The speech rate, pitch, and volume have been adjusted according to your preferences.');
    } else if (setting === 'reset') {
      setVoiceSettings({ rate: 0.8, pitch: 1, volume: 1, enabled: true });
      speak('Settings reset to default values');
    }
  };

  // Handle camera actions via voice
  const handleCameraAction = (action: string) => {
    if (action === 'start') {
      setCameraActive(true);
    } else if (action === 'stop') {
      setCameraActive(false);
    } else if (action === 'analyze') {
      // This will be handled by the CameraView component
    }
  };

  // Handle navigation actions via voice
  const handleNavigationAction = (action: string) => {
    if (action === 'start') {
      setNavigationActive(true);
    } else if (action === 'stop') {
      setNavigationActive(false);
    }
    // Other actions like 'next' and 'repeat' will be handled by NavigationGuide component
  };

  // Handle emergency actions via voice
  const handleEmergencyAction = (action: string) => {
    if (action === 'call-911') {
      speak('Calling emergency services now');
      if (typeof window !== 'undefined') {
        window.location.href = 'tel:911';
      }
    } else if (action === 'call-family') {
      speak('Calling family contact');
      if (typeof window !== 'undefined') {
        window.location.href = 'tel:+1-555-0123';
      }
    } else if (action === 'call-friend') {
      speak('Calling trusted friend');
      if (typeof window !== 'undefined') {
        window.location.href = 'tel:+1-555-0456';
      }
    } else if (action === 'share-location') {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            speak('Location acquired and ready to share');
          },
          () => speak('Unable to get location')
        );
      }
    } else if (action === 'send-help') {
      speak('Help message prepared and ready to send');
    }
  };

  useEffect(() => {
    // Welcome message when app loads
    setTimeout(() => {
      speak('Welcome to Vision Guide, your personal assistant for the visually impaired. Say Hey Vision Help to hear all available commands. I am here to help you navigate safely using voice commands only.');
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
        {/* Voice Controls - Always visible and primary interface */}
        <VoiceControls
          isListening={isListening}
          onListeningChange={setIsListening}
          onVoiceCommand={handleVoiceCommand}
          speak={speak}
          currentMode={activeMode}
          onSettingsChange={handleSettingsChange}
          onCameraAction={handleCameraAction}
          onNavigationAction={handleNavigationAction}
          onEmergencyAction={handleEmergencyAction}
        />

        {/* Current Mode Indicator */}
        <Card className="bg-white/10 border-white/20 p-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">Current Mode: {activeMode.charAt(0).toUpperCase() + activeMode.slice(1)}</h2>
            <p className="text-gray-300">Use voice commands starting with "Hey Vision" to control the app</p>
          </div>
        </Card>

        {/* Active Mode Content */}
        <Card className="bg-black/20 backdrop-blur-sm border-white/10 p-6">
          {activeMode === 'camera' && (
            <CameraView
              speak={speak}
              detectedObjects={detectedObjects}
              onDetectedObjects={setDetectedObjects}
              isActive={cameraActive}
              onActiveChange={setCameraActive}
            />
          )}
          
          {activeMode === 'navigation' && (
            <NavigationGuide 
              speak={speak} 
              isActive={navigationActive}
              onActiveChange={setNavigationActive}
            />
          )}
          
          {activeMode === 'emergency' && (
            <EmergencyPanel speak={speak} />
          )}
          
          {activeMode === 'settings' && (
            <SettingsPanel 
              speak={speak} 
              voiceSettings={voiceSettings}
              onVoiceSettingsChange={setVoiceSettings}
            />
          )}
        </Card>

        {/* Voice Command Quick Reference */}
        <Card className="bg-green-500/20 border-green-400/30 p-4">
          <h3 className="text-lg font-semibold text-green-200 mb-3">Quick Voice Commands:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-green-100">
            <div>"Hey Vision Camera" - Object detection</div>
            <div>"Hey Vision Navigate" - Walking guidance</div>
            <div>"Hey Vision Emergency" - Emergency help</div>
            <div>"Hey Vision Settings" - Adjust preferences</div>
            <div>"Hey Vision Help" - List all commands</div>
            <div>"Hey Vision Status" - Check current mode</div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;
