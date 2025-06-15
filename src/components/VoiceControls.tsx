import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWhisperTranscriber } from "@/hooks/useWhisperTranscriber";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
    SpeechGrammarList: any;
    webkitSpeechGrammarList: any;
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
  const [recognitionState, setRecognitionState] = useState<'stopped' | 'starting' | 'running' | 'stopping'>('stopped');
  const [lastCommand, setLastCommand] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isSupported, setIsSupported] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualStopRef = useRef(false);
  const lastProcessedRef = useRef<string>('');
  const startingRef = useRef(false);
  const lastStartTimeRef = useRef(0);

  // Command patterns - made them stricter and mutually exclusive
  const commandPatterns = {
    camera: /\b(camera|see|look|vision|view|photo|picture|detect|analyze|object|what (?:do you |can you )?see)\b/i,
    navigation: /\b(navigate|walk|direction|guide|route|move|go|travel|where|path)\b/i,
    emergency: /\b(emergency|help|urgent|call|sos|911|danger)\b/i,
    settings: /\b(settings|preferences|config|adjust|volume|speed|options|setup)\b/i,
    status: /\b(status|mode|current|state|info|how .*(?:doing|working)|what.*mode)\b/i,
    help: /\b(help|commands|what.*can|available|list|how.*use)\b/i,
    stop: /\b(stop|halt|end|quit|disable|off|pause|silent)\b/i,
  };

  const addDebugInfo = (info: string) => {
    console.log(`${new Date().toLocaleTimeString()}: ${info}`);
    setDebugInfo(prev => {
      const newInfo = [...prev, `${new Date().toLocaleTimeString()}: ${info}`];
      return newInfo.slice(-3);
    });
  };

  // Initialize voice recognition
  useEffect(() => {
    const initializeVoiceRecognition = async () => {
      addDebugInfo('Initializing voice recognition...');
      
      const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      setIsSupported(supported);
      
      if (!supported) {
        setErrorMessage('Speech recognition not supported. Please use Chrome, Edge, or Safari.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setMicrophonePermission('granted');
        setErrorMessage(null);
        
        // Auto-start after permission granted
        setTimeout(() => {
          if (!isManualStopRef.current) {
            startRecognition();
          }
        }, 1000);
      } catch (error) {
        setMicrophonePermission('denied');
        setErrorMessage('Microphone access required. Please allow and refresh the page.');
        addDebugInfo(`Microphone permission denied: ${error}`);
      }
    };

    initializeVoiceRecognition();
  }, []);

  const processVoiceCommand = (command: string, confidence: number) => {
    const cleanCommand = command.toLowerCase().trim();

    if (cleanCommand === lastProcessedRef.current || cleanCommand.length < 2) {
      return;
    }

    lastProcessedRef.current = cleanCommand;
    addDebugInfo(`[processVoiceCommand] Input: "${cleanCommand}" (conf: ${confidence})`);

    setIsProcessingCommand(true);
    setLastCommand(cleanCommand);

    let matchType: string | null = null;

    // Mutually exclusive matching for commands, ordered so more restrictive/rare are higher
    if (commandPatterns.stop.test(cleanCommand)) {
      matchType = "stop";
      addDebugInfo("Matched: stop");
      stopRecognition();
      speak("Voice recognition stopped");
    } else if (commandPatterns.emergency.test(cleanCommand)) {
      matchType = "emergency";
      addDebugInfo("Matched: emergency");
      onVoiceCommand("emergency");
      onEmergencyAction("open");
      speak("Emergency panel opened");
    } else if (commandPatterns.navigation.test(cleanCommand)) {
      matchType = "navigation";
      addDebugInfo("Matched: navigation");
      onVoiceCommand("navigation");
      onNavigationAction("start");
      speak("Navigation mode activated");
    } else if (commandPatterns.settings.test(cleanCommand)) {
      matchType = "settings";
      addDebugInfo("Matched: settings");
      onVoiceCommand("settings");
      speak("Settings panel opened");
    } else if (commandPatterns.status.test(cleanCommand)) {
      matchType = "status";
      addDebugInfo("Matched: status");
      speak(`Current mode is ${currentMode}. Voice recognition is active.`);
    } else if (commandPatterns.help.test(cleanCommand)) {
      matchType = "help";
      addDebugInfo("Matched: help");
      speak("Say camera for object detection, navigate for directions, emergency for help, or settings for preferences");
    } else if (commandPatterns.camera.test(cleanCommand)) {
      matchType = "camera";
      addDebugInfo("Matched: camera");
      onVoiceCommand("camera");
      onCameraAction("start");
      speak("Camera activated for object detection");
    }

    if (!matchType) {
      addDebugInfo(`[processVoiceCommand] No command matched (input: "${cleanCommand}")`);
      speak("Command not recognized. Try saying camera, navigate, emergency, settings, or help");
    }

    setTimeout(() => {
      setIsProcessingCommand(false);
      lastProcessedRef.current = '';
    }, 2000);
  };

  const handleRecognitionError = (error: any) => {
    addDebugInfo(`Recognition error: ${error.error}`);
    
    // Clear any pending restarts
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    switch (error.error) {
      case 'not-allowed':
        setRecognitionState('stopped');
        onListeningChange(false);
        setMicrophonePermission('denied');
        setErrorMessage("Microphone access denied. Please allow microphone access and refresh.");
        isManualStopRef.current = true;
        break;
      case 'network':
        setErrorMessage("Network error. Retrying...");
        scheduleRestart(3000);
        break;
      case 'audio-capture':
        setErrorMessage("Audio capture error. Check microphone.");
        scheduleRestart(2000);
        break;
      case 'no-speech':
        // Don't restart on no-speech, just continue
        addDebugInfo('No speech detected, continuing...');
        break;
      default:
        addDebugInfo('Unknown error, restarting...');
        scheduleRestart(2000);
    }
    
    // Reset starting flag
    startingRef.current = false;
  };

  const scheduleRestart = (delay: number) => {
    if (!isManualStopRef.current && recognitionState !== 'running' && !startingRef.current) {
      restartTimeoutRef.current = setTimeout(() => {
        startRecognition();
      }, delay);
    }
  };

  const startRecognition = () => {
    const now = Date.now();
    
    // Prevent rapid restarts (debounce)
    if (now - lastStartTimeRef.current < 1000) {
      addDebugInfo('Preventing rapid restart');
      return;
    }
    
    // Check if already starting or running
    if (startingRef.current || recognitionState === 'running' || recognitionState === 'starting') {
      addDebugInfo(`Cannot start - current state: ${recognitionState}, starting: ${startingRef.current}`);
      return;
    }

    if (!isSupported || isManualStopRef.current || microphonePermission !== 'granted') {
      addDebugInfo('Cannot start - not supported, manual stop, or permission denied');
      return;
    }

    lastStartTimeRef.current = now;
    startingRef.current = true;
    setRecognitionState('starting');
    setErrorMessage(null);
    
    addDebugInfo('Starting speech recognition...');
    
    try {
      // Clean up any existing recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore cleanup errors
        }
        recognitionRef.current = null;
      }
      
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognition();

      // Configure recognition
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        addDebugInfo('Speech recognition started successfully');
        setRecognitionState('running');
        onListeningChange(true);
        setTranscript('');
        startingRef.current = false;
        isManualStopRef.current = false;
      };

      recognition.onend = () => {
        addDebugInfo('Speech recognition ended');
        setRecognitionState('stopped');
        onListeningChange(false);
        startingRef.current = false;
        
        // Only restart if not manually stopped and no pending restart
        if (!isManualStopRef.current && !restartTimeoutRef.current) {
          scheduleRestart(1500);
        }
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        let maxConfidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript.trim();
          const confidence = result[0].confidence || 0.8;
          
          if (result.isFinal) {
            finalTranscript += transcript;
            maxConfidence = Math.max(maxConfidence, confidence);
          } else {
            interimTranscript += transcript;
          }
        }

        const displayTranscript = finalTranscript || interimTranscript;
        setTranscript(displayTranscript);
        setConfidence(maxConfidence);

        // Process final results
        if (finalTranscript && finalTranscript.length > 1) {
          addDebugInfo(`Final transcript: "${finalTranscript}" (confidence: ${maxConfidence})`);
          processVoiceCommand(finalTranscript, maxConfidence);
          
          setTimeout(() => setTranscript(''), 3000);
        }
      };

      recognition.onerror = handleRecognitionError;
      
      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (error) {
      addDebugInfo(`Failed to start recognition: ${error}`);
      setErrorMessage("Failed to start voice recognition. Please try again.");
      setRecognitionState('stopped');
      startingRef.current = false;
    }
  };

  const stopRecognition = () => {
    isManualStopRef.current = true;
    startingRef.current = false;
    addDebugInfo('Stopping recognition manually');
    
    // Clear any pending restarts
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    if (recognitionRef.current && recognitionState !== 'stopped') {
      setRecognitionState('stopping');
      try {
        recognitionRef.current.stop();
      } catch (error) {
        addDebugInfo(`Error stopping recognition: ${error}`);
      }
    }
    
    // Force state update
    setTimeout(() => {
      setRecognitionState('stopped');
      onListeningChange(false);
      setErrorMessage(null);
    }, 500);
  };

  const toggleListening = () => {
    if (recognitionState === 'running' || recognitionState === 'starting') {
      stopRecognition();
      speak('Voice recognition stopped');
    } else {
      if (microphonePermission !== 'granted') {
        setErrorMessage('Please allow microphone access and refresh the page.');
        return;
      }
      
      isManualStopRef.current = false;
      startRecognition();
      speak('Voice recognition started. Speak clearly.');
    }
  };

  const { isLoading: whisperLoading, transcript: whisperTranscript, error: whisperError, recordAndTranscribe } = useWhisperTranscriber();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isManualStopRef.current = true;
      startingRef.current = false;
      
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  if (!isSupported) {
    return (
      <Card className="bg-red-500/20 border-red-400/30 p-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-red-200 mb-2">Speech Recognition Not Supported</h3>
          <p className="text-red-300">Please use Chrome, Edge, or Safari for voice commands.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Brain className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">Voice Control</h3>
        </div>
        <p className="text-gray-300 text-sm">Speak clearly for voice commands</p>
        {confidence > 0 && (
          <div className="text-green-400 text-xs mt-1">
            Confidence: {Math.round(confidence * 100)}%
          </div>
        )}
      </div>

      {/* Microphone Permission Warning */}
      {microphonePermission === 'denied' && (
        <div className="bg-red-500/20 border-red-400/30 rounded-lg p-3 mb-4">
          <p className="text-red-200 text-center text-sm">
            Microphone access denied. Please allow microphone permissions and refresh the page.
          </p>
        </div>
      )}

      {/* Voice Control Button */}
      <div className="flex justify-center mb-6">
        <Button
          onClick={toggleListening}
          disabled={microphonePermission === 'denied'}
          className={`${
            recognitionState === 'running'
              ? 'bg-green-500 hover:bg-green-600 animate-pulse' 
              : recognitionState === 'starting'
              ? 'bg-yellow-500 hover:bg-yellow-600 animate-pulse'
              : 'bg-red-500 hover:bg-red-600'
          } text-white w-20 h-20 rounded-full transition-all duration-300 transform hover:scale-110`}
        >
          {recognitionState === 'running' ? (
            <Mic className="w-8 h-8" />
          ) : (
            <MicOff className="w-8 h-8" />
          )}
        </Button>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-500/20 border-red-400/30 rounded-lg p-3 mb-4">
          <p className="text-red-200 text-center text-sm">{errorMessage}</p>
        </div>
      )}

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
          <p className="text-yellow-200 text-center flex items-center justify-center gap-2">
            <Brain className="w-4 h-4 animate-pulse" />
            Processing command...
          </p>
        </div>
      )}

      {/* Debug Information */}
      {debugInfo.length > 0 && (
        <div className="bg-gray-500/20 border-gray-400/30 rounded-lg p-3 mb-4">
          <h4 className="text-gray-200 text-sm font-medium mb-2">Status:</h4>
          {debugInfo.map((info, index) => (
            <p key={index} className="text-gray-300 text-xs">{info}</p>
          ))}
        </div>
      )}

      {/* Voice Commands */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {[
          { command: 'Camera', description: 'Activate object detection' },
          { command: 'Navigate', description: 'Start navigation mode' },
          { command: 'Emergency', description: 'Open emergency panel' },
          { command: 'Settings', description: 'Open settings panel' },
          { command: 'Help', description: 'List available commands' },
          { command: 'Status', description: 'Check current mode' },
        ].map((cmd, index) => (
          <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10">
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
          {recognitionState === 'running' ? 'Listening for commands...' : 
           recognitionState === 'starting' ? 'Starting recognition...' :
           'Voice recognition stopped'}
        </span>
      </div>

      {/* Whisper Alternative */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="text-center mb-2">
          <h4 className="text-white text-sm font-medium">Backup: Whisper AI</h4>
          <p className="text-gray-400 text-xs">Alternative transcription method</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Button 
            onClick={recordAndTranscribe}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-2"
            disabled={whisperLoading}
          >
            {whisperLoading ? "Processing..." : "Record with Whisper"}
          </Button>
          {whisperTranscript && (
            <div className="px-3 py-2 rounded bg-orange-700/30 border border-orange-500 text-white text-center text-sm">
              <strong>Whisper:</strong> "{whisperTranscript}"
            </div>
          )}
          {whisperError && (
            <div className="px-2 py-1 rounded bg-red-500/30 border border-red-500 text-red-200 text-center text-sm">
              {whisperError}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
