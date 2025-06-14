
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
  const [transcript, setTranscript] = useState('');
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [recognitionState, setRecognitionState] = useState<'stopped' | 'starting' | 'running'>('stopped');
  const [lastCommand, setLastCommand] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualStopRef = useRef(false);
  const lastProcessedTranscriptRef = useRef('');

  const clearRestartTimeout = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  };

  const startRecognition = () => {
    if (!recognitionRef.current || recognitionState !== 'stopped' || isManualStopRef.current) {
      return;
    }

    try {
      console.log('Starting speech recognition...');
      setRecognitionState('starting');
      clearRestartTimeout();
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setRecognitionState('stopped');
      
      // Retry with exponential backoff
      if (!isManualStopRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (recognitionState === 'stopped' && !isManualStopRef.current) {
            startRecognition();
          }
        }, 3000);
      }
    }
  };

  const stopRecognition = () => {
    isManualStopRef.current = true;
    clearRestartTimeout();
    
    if (recognitionRef.current && recognitionState !== 'stopped') {
      console.log('Stopping speech recognition...');
      recognitionRef.current.stop();
    }
    
    setRecognitionState('stopped');
    onListeningChange(false);
  };

  const processVoiceCommand = (command: string) => {
    console.log('Raw command received:', command);
    
    // Prevent duplicate processing
    if (command === lastProcessedTranscriptRef.current) {
      console.log('Duplicate command ignored');
      return;
    }
    lastProcessedTranscriptRef.current = command;
    
    setLastCommand(command);
    setIsProcessingCommand(true);
    
    // Normalize the command
    const normalizedCommand = command
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    console.log('Normalized command:', normalizedCommand);

    // Enhanced wake word detection with variations
    const wakePatterns = [
      /\b(hey\s+)?vision\b/,
      /\bdivision\b/,
      /\brevision\b/,
      /\bhey\s+google\b/,
      /\bhey\s+siri\b/,
      /\bvision\s+guide\b/
    ];

    const hasWakeWord = wakePatterns.some(pattern => pattern.test(normalizedCommand));

    if (!hasWakeWord) {
      console.log('No wake word detected');
      setIsProcessingCommand(false);
      return;
    }

    // Extract command after removing wake words
    let cleanCommand = normalizedCommand;
    wakePatterns.forEach(pattern => {
      cleanCommand = cleanCommand.replace(pattern, '').trim();
    });

    console.log('Clean command after wake word removal:', cleanCommand);

    // Process commands with better pattern matching
    if (processMainCommands(cleanCommand)) {
      return;
    }

    if (processModeSpecificCommands(cleanCommand)) {
      return;
    }

    if (processGeneralCommands(cleanCommand)) {
      return;
    }

    // If no command matched
    speak(`I heard you say: ${cleanCommand}. Try saying hey vision help to hear available commands.`);
    setIsProcessingCommand(false);
  };

  const processMainCommands = (command: string): boolean => {
    const modeCommands = [
      { patterns: [/camera/, /vision/, /see/, /look/, /watch/, /detect/, /view/], mode: 'camera' },
      { patterns: [/navigat/, /walk/, /direction/, /guide/, /move/, /go/], mode: 'navigation' },
      { patterns: [/emergency/, /help/, /urgent/, /danger/, /call/], mode: 'emergency' },
      { patterns: [/setting/, /preference/, /configure/, /setup/, /adjust/], mode: 'settings' }
    ];

    for (const modeCmd of modeCommands) {
      if (modeCmd.patterns.some(pattern => pattern.test(command))) {
        onVoiceCommand(modeCmd.mode);
        setIsProcessingCommand(false);
        return true;
      }
    }
    return false;
  };

  const processModeSpecificCommands = (command: string): boolean => {
    // Camera commands
    if (currentMode === 'camera') {
      if (/start|activate|turn\s+on|begin|open|on/.test(command)) {
        onCameraAction('start');
        speak('Starting camera for object detection');
        setIsProcessingCommand(false);
        return true;
      }
      if (/stop|close|turn\s+off|end|deactivate|off/.test(command)) {
        onCameraAction('stop');
        speak('Stopping camera');
        setIsProcessingCommand(false);
        return true;
      }
      if (/analyze|describe|what\s+do\s+you\s+see|scan|check|tell\s+me/.test(command)) {
        onCameraAction('analyze');
        speak('Analyzing your surroundings now');
        setIsProcessingCommand(false);
        return true;
      }
    }

    // Navigation commands
    if (currentMode === 'navigation') {
      if (/start|begin|activate|turn\s+on/.test(command)) {
        onNavigationAction('start');
        setIsProcessingCommand(false);
        return true;
      }
      if (/next|continue|forward|proceed|step/.test(command)) {
        onNavigationAction('next');
        setIsProcessingCommand(false);
        return true;
      }
      if (/repeat|again|say\s+again|once\s+more/.test(command)) {
        onNavigationAction('repeat');
        setIsProcessingCommand(false);
        return true;
      }
      if (/stop|end|finish|quit/.test(command)) {
        onNavigationAction('stop');
        setIsProcessingCommand(false);
        return true;
      }
    }

    // Emergency commands
    if (currentMode === 'emergency') {
      if (/call\s+emergency|nine\s+one\s+one|911|dial\s+emergency/.test(command)) {
        onEmergencyAction('call-911');
        setIsProcessingCommand(false);
        return true;
      }
      if (/call\s+family|family\s+contact|family\s+member/.test(command)) {
        onEmergencyAction('call-family');
        setIsProcessingCommand(false);
        return true;
      }
      if (/call\s+friend|trusted\s+friend|friend\s+contact/.test(command)) {
        onEmergencyAction('call-friend');
        setIsProcessingCommand(false);
        return true;
      }
      if (/share\s+location|send\s+location|location/.test(command)) {
        onEmergencyAction('share-location');
        setIsProcessingCommand(false);
        return true;
      }
      if (/send\s+help|help\s+message|distress/.test(command)) {
        onEmergencyAction('send-help');
        setIsProcessingCommand(false);
        return true;
      }
    }

    // Settings commands
    if (currentMode === 'settings') {
      if (/faster|speed\s+up|quick|rapid|speech\s+faster/.test(command)) {
        onSettingsChange('speechRate', 'increase');
        speak('Speech rate increased');
        setIsProcessingCommand(false);
        return true;
      }
      if (/slower|slow\s+down|gentle|calm|speech\s+slower/.test(command)) {
        onSettingsChange('speechRate', 'decrease');
        speak('Speech rate decreased');
        setIsProcessingCommand(false);
        return true;
      }
      if (/louder|volume\s+up|increase\s+volume/.test(command)) {
        onSettingsChange('speechVolume', 'increase');
        speak('Volume increased');
        setIsProcessingCommand(false);
        return true;
      }
      if (/quieter|volume\s+down|decrease\s+volume/.test(command)) {
        onSettingsChange('speechVolume', 'decrease');
        speak('Volume decreased');
        setIsProcessingCommand(false);
        return true;
      }
      if (/test|try|sample/.test(command)) {
        onSettingsChange('test', true);
        setIsProcessingCommand(false);
        return true;
      }
      if (/reset|default|original/.test(command)) {
        onSettingsChange('reset', true);
        setIsProcessingCommand(false);
        return true;
      }
    }

    return false;
  };

  const processGeneralCommands = (command: string): boolean => {
    if (/status|where\s+am\s+i|current\s+mode|what\s+mode/.test(command)) {
      speak(`You are currently in ${currentMode} mode. Say hey vision followed by camera, navigate, emergency, or settings to switch modes.`);
      setIsProcessingCommand(false);
      return true;
    }

    if (/help|commands|what\s+can\s+you\s+do|instructions/.test(command)) {
      speak('Say hey vision followed by: camera for object detection, navigate for walking guidance, emergency for help, or settings for preferences. You can also say status to check current mode.');
      setIsProcessingCommand(false);
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      // Optimized settings for better recognition
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 3;
      
      recognitionInstance.onstart = () => {
        console.log('Speech recognition started');
        setRecognitionState('running');
        onListeningChange(true);
        setTranscript('');
        isManualStopRef.current = false;
      };

      recognitionInstance.onend = () => {
        console.log('Speech recognition ended');
        setRecognitionState('stopped');
        onListeningChange(false);
        
        // Auto-restart if not manually stopped and not processing
        if (!isManualStopRef.current && !isProcessingCommand) {
          restartTimeoutRef.current = setTimeout(() => {
            if (!isManualStopRef.current && recognitionState === 'stopped') {
              startRecognition();
            }
          }, 1000);
        }
      };

      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        let bestConfidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence || 0.7;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            bestConfidence = Math.max(bestConfidence, confidence);
          } else {
            interimTranscript += transcript;
          }
        }

        const displayTranscript = finalTranscript || interimTranscript;
        setTranscript(displayTranscript);
        setConfidence(bestConfidence);

        // Process final transcript with adjusted confidence threshold
        if (finalTranscript.trim() && bestConfidence > 0.1) {
          console.log('Processing final command:', finalTranscript, 'Confidence:', bestConfidence);
          processVoiceCommand(finalTranscript.trim());
          
          // Clear transcript after processing
          setTimeout(() => {
            setTranscript('');
            setIsProcessingCommand(false);
            lastProcessedTranscriptRef.current = '';
          }, 3000);
        }
      };

      recognitionInstance.onerror = (event: any) => {
        console.log('Speech recognition error:', event.error);
        
        if (event.error === 'aborted') {
          console.log('Recognition aborted, stopping restart cycle');
          return;
        }
        
        setRecognitionState('stopped');
        onListeningChange(false);
        
        if (event.error === 'no-speech') {
          console.log('No speech detected, continuing...');
        } else if (event.error === 'network') {
          speak('Network error. Voice recognition temporarily unavailable.');
        } else if (event.error === 'not-allowed') {
          speak('Microphone access denied. Please allow microphone permissions.');
          isManualStopRef.current = true;
          return;
        }
        
        // Restart with longer delay for errors
        if (!isManualStopRef.current) {
          clearRestartTimeout();
          restartTimeoutRef.current = setTimeout(() => {
            if (!isManualStopRef.current && recognitionState === 'stopped') {
              startRecognition();
            }
          }, 2000);
        }
      };

      recognitionRef.current = recognitionInstance;
      
      // Start recognition immediately
      setTimeout(startRecognition, 500);
    } else {
      console.log('Speech recognition not supported');
      speak('Voice recognition is not supported in this browser or device.');
    }

    return () => {
      clearRestartTimeout();
      if (recognitionRef.current) {
        isManualStopRef.current = true;
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Reset processing state when command processing is complete
  useEffect(() => {
    if (!isProcessingCommand && recognitionState === 'stopped' && !isManualStopRef.current) {
      const timeout = setTimeout(() => {
        if (!isManualStopRef.current) {
          startRecognition();
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isProcessingCommand, recognitionState]);

  const toggleListening = () => {
    if (recognitionState === 'running') {
      stopRecognition();
      speak('Voice recognition stopped');
    } else {
      isManualStopRef.current = false;
      startRecognition();
      speak('Voice recognition started. Say hey vision followed by your command');
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
            recognitionState === 'running'
              ? 'bg-green-500 hover:bg-green-600 animate-pulse' 
              : 'bg-red-500 hover:bg-red-600'
          } text-white w-20 h-20 rounded-full transition-all duration-300 transform hover:scale-110`}
          onFocus={() => speak(recognitionState === 'running' ? 'Voice listening active' : 'Voice listening inactive')}
        >
          {recognitionState === 'running' ? (
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

      {/* Last Command */}
      {lastCommand && (
        <div className="bg-green-500/20 border-green-400/30 rounded-lg p-3 mb-4">
          <p className="text-white text-center">
            <span className="text-green-200 text-sm">Last Command: </span>
            "{lastCommand}"
          </p>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessingCommand && (
        <div className="bg-yellow-500/20 border-yellow-400/30 rounded-lg p-3 mb-4">
          <p className="text-yellow-200 text-center">
            Processing command...
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
        <div className={`w-3 h-3 rounded-full ${
          recognitionState === 'running' ? 'bg-green-400 animate-pulse' : 
          recognitionState === 'starting' ? 'bg-yellow-400 animate-pulse' : 
          'bg-red-500'
        }`}></div>
        <span className="text-white text-sm">
          {recognitionState === 'running' ? 'Always listening for "Hey Vision"...' : 
           recognitionState === 'starting' ? 'Starting voice recognition...' :
           'Voice recognition stopped'}
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
