
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Add TypeScript declarations for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface VoiceControlsProps {
  isListening: boolean;
  onListeningChange: (listening: boolean) => void;
  onVoiceCommand: (command: string) => void;
  speak: (text: string) => void;
  currentMode: string;
  onSettingsChange: (setting: string, value: any) => void;
  onCameraAction: (action: string) => void;
  onNavigationAction: (action: string) => void;
  onEmergencyAction: (action: string) => void;
}

export const VoiceControls = ({ 
  isListening, 
  onListeningChange, 
  onVoiceCommand, 
  speak,
  currentMode,
  onSettingsChange,
  onCameraAction,
  onNavigationAction,
  onEmergencyAction
}: VoiceControlsProps) => {
  const [recognition, setRecognition] = useState<any>(null);
  const [transcript, setTranscript] = useState('');
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onstart = () => {
        onListeningChange(true);
        speak('Listening for your command');
      };

      recognitionInstance.onend = () => {
        onListeningChange(false);
        if (!isProcessingCommand) {
          // Auto-restart listening for continuous voice control
          setTimeout(() => {
            if (recognition) {
              recognition.start();
            }
          }, 1000);
        }
      };

      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript + interimTranscript);

        if (finalTranscript) {
          setIsProcessingCommand(true);
          processVoiceCommand(finalTranscript.toLowerCase().trim());
          setTranscript('');
          setTimeout(() => setIsProcessingCommand(false), 2000);
        }
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        onListeningChange(false);
        if (event.error === 'no-speech') {
          speak('I did not hear anything. Say hey vision to activate commands.');
        } else {
          speak('Voice recognition error. Please try again.');
        }
      };

      setRecognition(recognitionInstance);
    }
  }, [onListeningChange, speak, isProcessingCommand]);

  const processVoiceCommand = (command: string) => {
    console.log('Processing command:', command);
    
    // Wake word detection
    if (!command.includes('hey vision') && !command.includes('vision guide')) {
      return; // Ignore commands without wake word
    }

    // Remove wake word for processing
    const cleanCommand = command.replace(/hey vision|vision guide/g, '').trim();
    
    // Mode switching commands
    if (cleanCommand.includes('camera') || cleanCommand.includes('vision') || cleanCommand.includes('see')) {
      onVoiceCommand('camera');
      return;
    }
    
    if (cleanCommand.includes('navigate') || cleanCommand.includes('walk') || cleanCommand.includes('direction')) {
      onVoiceCommand('navigation');
      return;
    }
    
    if (cleanCommand.includes('emergency') || cleanCommand.includes('help') || cleanCommand.includes('call')) {
      onVoiceCommand('emergency');
      return;
    }
    
    if (cleanCommand.includes('settings') || cleanCommand.includes('preferences') || cleanCommand.includes('configure')) {
      onVoiceCommand('settings');
      return;
    }

    // Camera mode commands
    if (currentMode === 'camera') {
      if (cleanCommand.includes('start camera') || cleanCommand.includes('activate camera')) {
        onCameraAction('start');
        speak('Starting camera for object detection');
        return;
      }
      if (cleanCommand.includes('stop camera') || cleanCommand.includes('close camera')) {
        onCameraAction('stop');
        speak('Stopping camera');
        return;
      }
      if (cleanCommand.includes('analyze') || cleanCommand.includes('describe') || cleanCommand.includes('what do you see')) {
        onCameraAction('analyze');
        speak('Analyzing your surroundings now');
        return;
      }
    }

    // Navigation mode commands
    if (currentMode === 'navigation') {
      if (cleanCommand.includes('start navigation') || cleanCommand.includes('begin walking')) {
        onNavigationAction('start');
        return;
      }
      if (cleanCommand.includes('next step') || cleanCommand.includes('continue')) {
        onNavigationAction('next');
        return;
      }
      if (cleanCommand.includes('repeat') || cleanCommand.includes('say again')) {
        onNavigationAction('repeat');
        return;
      }
      if (cleanCommand.includes('stop navigation') || cleanCommand.includes('end navigation')) {
        onNavigationAction('stop');
        return;
      }
    }

    // Emergency mode commands
    if (currentMode === 'emergency') {
      if (cleanCommand.includes('call emergency') || cleanCommand.includes('nine one one')) {
        onEmergencyAction('call-911');
        return;
      }
      if (cleanCommand.includes('call family') || cleanCommand.includes('family contact')) {
        onEmergencyAction('call-family');
        return;
      }
      if (cleanCommand.includes('call friend') || cleanCommand.includes('trusted friend')) {
        onEmergencyAction('call-friend');
        return;
      }
      if (cleanCommand.includes('share location') || cleanCommand.includes('send location')) {
        onEmergencyAction('share-location');
        return;
      }
      if (cleanCommand.includes('send help') || cleanCommand.includes('help message')) {
        onEmergencyAction('send-help');
        return;
      }
    }

    // Settings mode commands
    if (currentMode === 'settings') {
      if (cleanCommand.includes('speech faster') || cleanCommand.includes('speed up')) {
        onSettingsChange('speechRate', 'increase');
        speak('Speech rate increased');
        return;
      }
      if (cleanCommand.includes('speech slower') || cleanCommand.includes('slow down')) {
        onSettingsChange('speechRate', 'decrease');
        speak('Speech rate decreased');
        return;
      }
      if (cleanCommand.includes('volume up') || cleanCommand.includes('louder')) {
        onSettingsChange('speechVolume', 'increase');
        speak('Volume increased');
        return;
      }
      if (cleanCommand.includes('volume down') || cleanCommand.includes('quieter')) {
        onSettingsChange('speechVolume', 'decrease');
        speak('Volume decreased');
        return;
      }
      if (cleanCommand.includes('test voice') || cleanCommand.includes('test speech')) {
        onSettingsChange('test', true);
        return;
      }
      if (cleanCommand.includes('reset settings') || cleanCommand.includes('default settings')) {
        onSettingsChange('reset', true);
        return;
      }
    }

    // General commands
    if (cleanCommand.includes('status') || cleanCommand.includes('where am i')) {
      speak(`You are currently in ${currentMode} mode. Say hey vision followed by camera, navigate, emergency, or settings to switch modes.`);
      return;
    }

    if (cleanCommand.includes('help') || cleanCommand.includes('commands')) {
      speak('Say hey vision followed by: camera for object detection, navigate for walking guidance, emergency for help, or settings for preferences. You can also say status to check current mode.');
      return;
    }

    // If no command matched
    speak(`I heard: ${cleanCommand}. Say hey vision help to hear available commands.`);
  };

  const toggleListening = () => {
    if (!recognition) {
      speak('Voice recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsProcessingCommand(false);
    } else {
      recognition.start();
    }
  };

  const voiceCommands = [
    { command: 'Hey Vision Camera', description: 'Activate smart vision mode' },
    { command: 'Hey Vision Navigate', description: 'Start walking guidance' },
    { command: 'Hey Vision Emergency', description: 'Open emergency panel' },
    { command: 'Hey Vision Settings', description: 'Open app settings' },
    { command: 'Hey Vision Help', description: 'Get voice assistance' },
    { command: 'Hey Vision Status', description: 'Check current mode' },
  ];

  return (
    <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6">
      <div className="text-center mb-4">
        <h3 className="text-xl font-semibold text-white mb-2">Voice Commands</h3>
        <p className="text-gray-300 text-sm">Say "Hey Vision" followed by your command</p>
      </div>

      {/* Voice Control Button */}
      <div className="flex justify-center mb-6">
        <Button
          onClick={toggleListening}
          className={`${
            isListening 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : 'bg-green-500 hover:bg-green-600'
          } text-white w-20 h-20 rounded-full transition-all duration-300 transform hover:scale-110`}
          onFocus={() => speak(isListening ? 'Stop listening' : 'Start voice commands')}
        >
          {isListening ? (
            <MicOff className="w-8 h-8" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </Button>
      </div>

      {/* Live Transcript */}
      {transcript && (
        <div className="bg-blue-500/20 border-blue-400/30 rounded-lg p-3 mb-4">
          <p className="text-white text-center">
            <span className="text-blue-200 text-sm">You said: </span>
            "{transcript}"
          </p>
        </div>
      )}

      {/* Voice Commands Help */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {voiceCommands.map((cmd, index) => (
          <div
            key={index}
            className="bg-white/5 rounded-lg p-3 border border-white/10"
          >
            <div className="text-white font-medium">"{cmd.command}"</div>
            <div className="text-gray-300 text-sm">{cmd.description}</div>
          </div>
        ))}
      </div>

      {/* Status Indicator */}
      <div className="flex items-center justify-center mt-4 gap-2">
        <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
        <span className="text-white text-sm">
          {isListening ? 'Listening for "Hey Vision"...' : 'Voice commands ready'}
        </span>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-yellow-500/20 border-yellow-400/30 rounded-lg">
        <p className="text-yellow-200 text-sm text-center">
          <strong>Always start with "Hey Vision"</strong> followed by your command for hands-free operation
        </p>
      </div>
    </Card>
  );
};
