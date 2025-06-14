
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Enhanced TypeScript declarations for Web Speech API
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
  const [confidence, setConfidence] = useState(0);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      // Enhanced speech recognition settings
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 3;
      
      recognitionInstance.onstart = () => {
        console.log('Speech recognition started');
        onListeningChange(true);
        setTranscript('');
      };

      recognitionInstance.onend = () => {
        console.log('Speech recognition ended');
        onListeningChange(false);
        
        // Auto-restart listening after a short delay unless we're processing a command
        if (!isProcessingCommand) {
          restartTimeoutRef.current = setTimeout(() => {
            if (recognitionInstance && !isProcessingCommand) {
              try {
                recognitionInstance.start();
              } catch (error) {
                console.log('Recognition restart failed:', error);
              }
            }
          }, 1000);
        }
      };

      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        let maxConfidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence || 0;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            maxConfidence = Math.max(maxConfidence, confidence);
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript + interimTranscript);
        setConfidence(maxConfidence);

        if (finalTranscript && maxConfidence > 0.3) { // Lower confidence threshold
          console.log('Processing command:', finalTranscript, 'Confidence:', maxConfidence);
          setIsProcessingCommand(true);
          processVoiceCommand(finalTranscript.toLowerCase().trim());
          
          // Clear transcript and reset processing after delay
          setTimeout(() => {
            setTranscript('');
            setIsProcessingCommand(false);
          }, 2000);
        }
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        onListeningChange(false);
        
        if (event.error === 'no-speech') {
          // Don't announce no-speech errors to avoid interruption
          console.log('No speech detected');
        } else if (event.error === 'network') {
          speak('Network error. Voice recognition temporarily unavailable.');
        } else {
          console.log('Voice recognition error:', event.error);
        }
        
        // Restart recognition after error
        setTimeout(() => {
          if (!isProcessingCommand) {
            try {
              recognitionInstance.start();
            } catch (error) {
              console.log('Failed to restart recognition after error');
            }
          }
        }, 2000);
      };

      setRecognition(recognitionInstance);
      
      // Auto-start recognition
      try {
        recognitionInstance.start();
      } catch (error) {
        console.log('Initial recognition start failed');
      }
    } else {
      console.log('Speech recognition not supported');
      speak('Voice recognition is not supported in this browser or device.');
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [onListeningChange, isProcessingCommand]);

  const processVoiceCommand = (command: string) => {
    console.log('Processing command:', command);
    
    // Normalize the command text
    const normalizedCommand = command
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    // More flexible wake word detection
    const hasWakeWord = normalizedCommand.includes('hey vision') || 
                       normalizedCommand.includes('vision') || 
                       normalizedCommand.includes('hey google') || // Common misheard wake words
                       normalizedCommand.includes('hey siri') ||
                       normalizedCommand.startsWith('vision') ||
                       normalizedCommand.includes('vision guide');

    if (!hasWakeWord) {
      console.log('No wake word detected in:', normalizedCommand);
      return;
    }

    // Extract command after wake word
    let cleanCommand = normalizedCommand
      .replace(/hey vision|vision guide|hey google|hey siri|vision/g, '')
      .trim();

    console.log('Clean command:', cleanCommand);

    // Mode switching with more flexible matching
    if (cleanCommand.match(/camera|vision|see|look|watch|detect/)) {
      onVoiceCommand('camera');
      return;
    }
    
    if (cleanCommand.match(/navigate|walk|direction|guide|move|go/)) {
      onVoiceCommand('navigation');
      return;
    }
    
    if (cleanCommand.match(/emergency|help|urgent|danger|call/)) {
      onVoiceCommand('emergency');
      return;
    }
    
    if (cleanCommand.match(/settings|preferences|configure|setup|adjust/)) {
      onVoiceCommand('settings');
      return;
    }

    // Camera mode commands with flexible matching
    if (currentMode === 'camera') {
      if (cleanCommand.match(/start|activate|turn on|begin|open/)) {
        onCameraAction('start');
        speak('Starting camera for object detection');
        return;
      }
      if (cleanCommand.match(/stop|close|turn off|end|deactivate/)) {
        onCameraAction('stop');
        speak('Stopping camera');
        return;
      }
      if (cleanCommand.match(/analyze|describe|what do you see|look|scan|check/)) {
        onCameraAction('analyze');
        speak('Analyzing your surroundings now');
        return;
      }
    }

    // Navigation mode commands
    if (currentMode === 'navigation') {
      if (cleanCommand.match(/start|begin|activate|turn on/)) {
        onNavigationAction('start');
        return;
      }
      if (cleanCommand.match(/next|continue|forward|proceed/)) {
        onNavigationAction('next');
        return;
      }
      if (cleanCommand.match(/repeat|again|say again|once more/)) {
        onNavigationAction('repeat');
        return;
      }
      if (cleanCommand.match(/stop|end|finish|quit/)) {
        onNavigationAction('stop');
        return;
      }
    }

    // Emergency mode commands
    if (currentMode === 'emergency') {
      if (cleanCommand.match(/call emergency|nine one one|911|dial emergency/)) {
        onEmergencyAction('call-911');
        return;
      }
      if (cleanCommand.match(/call family|family contact|family member/)) {
        onEmergencyAction('call-family');
        return;
      }
      if (cleanCommand.match(/call friend|trusted friend|friend contact/)) {
        onEmergencyAction('call-friend');
        return;
      }
      if (cleanCommand.match(/share location|send location|location/)) {
        onEmergencyAction('share-location');
        return;
      }
      if (cleanCommand.match(/send help|help message|distress/)) {
        onEmergencyAction('send-help');
        return;
      }
    }

    // Settings mode commands
    if (currentMode === 'settings') {
      if (cleanCommand.match(/faster|speed up|quick|rapid/)) {
        onSettingsChange('speechRate', 'increase');
        speak('Speech rate increased');
        return;
      }
      if (cleanCommand.match(/slower|slow down|gentle|calm/)) {
        onSettingsChange('speechRate', 'decrease');
        speak('Speech rate decreased');
        return;
      }
      if (cleanCommand.match(/louder|volume up|increase volume/)) {
        onSettingsChange('speechVolume', 'increase');
        speak('Volume increased');
        return;
      }
      if (cleanCommand.match(/quieter|volume down|decrease volume/)) {
        onSettingsChange('speechVolume', 'decrease');
        speak('Volume decreased');
        return;
      }
      if (cleanCommand.match(/test|try|sample/)) {
        onSettingsChange('test', true);
        return;
      }
      if (cleanCommand.match(/reset|default|original/)) {
        onSettingsChange('reset', true);
        return;
      }
    }

    // General commands
    if (cleanCommand.match(/status|where am i|current mode|what mode/)) {
      speak(`You are currently in ${currentMode} mode. Say hey vision followed by camera, navigate, emergency, or settings to switch modes.`);
      return;
    }

    if (cleanCommand.match(/help|commands|what can you do|instructions/)) {
      speak('Say hey vision followed by: camera for object detection, navigate for walking guidance, emergency for help, or settings for preferences. You can also say status to check current mode.');
      return;
    }

    // If no command matched, provide helpful feedback
    speak(`I heard you say: ${cleanCommand}. Try saying hey vision help to hear available commands, or hey vision camera to start object detection.`);
  };

  const toggleListening = () => {
    if (!recognition) {
      speak('Voice recognition is not supported in this browser or device.');
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsProcessingCommand(false);
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    } else {
      try {
        recognition.start();
      } catch (error) {
        console.log('Failed to start recognition manually');
        speak('Voice recognition could not be started. Please try again.');
      }
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
        <p className="text-gray-300 text-sm">Always listening for "Hey Vision" commands</p>
      </div>

      {/* Voice Control Button */}
      <div className="flex justify-center mb-6">
        <Button
          onClick={toggleListening}
          className={`${
            isListening 
              ? 'bg-green-500 hover:bg-green-600 animate-pulse' 
              : 'bg-red-500 hover:bg-red-600'
          } text-white w-20 h-20 rounded-full transition-all duration-300 transform hover:scale-110`}
          onFocus={() => speak(isListening ? 'Voice listening active' : 'Voice listening inactive')}
        >
          {isListening ? (
            <Mic className="w-8 h-8" />
          ) : (
            <MicOff className="w-8 h-8" />
          )}
        </Button>
      </div>

      {/* Live Transcript */}
      {transcript && (
        <div className="bg-blue-500/20 border-blue-400/30 rounded-lg p-3 mb-4">
          <p className="text-white text-center">
            <span className="text-blue-200 text-sm">Listening: </span>
            "{transcript}"
            {confidence > 0 && (
              <span className="text-blue-300 text-xs block">
                Confidence: {Math.round(confidence * 100)}%
              </span>
            )}
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
        <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></div>
        <span className="text-white text-sm">
          {isListening ? 'Always listening for "Hey Vision"...' : 'Voice recognition stopped'}
        </span>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-yellow-500/20 border-yellow-400/30 rounded-lg">
        <p className="text-yellow-200 text-sm text-center">
          <strong>Say "Hey Vision" clearly</strong> followed by your command. The app is always listening and will respond to your voice.
        </p>
      </div>
    </Card>
  );
};
