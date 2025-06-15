
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
  const [recognitionState, setRecognitionState] = useState<'stopped' | 'starting' | 'running'>('stopped');
  const [lastCommand, setLastCommand] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isSupported, setIsSupported] = useState(false);
  const [recognitionAccuracy, setRecognitionAccuracy] = useState(0);

  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualStopRef = useRef(false);
  const commandHistoryRef = useRef<string[]>([]);
  const processingRef = useRef(false);

  // Enhanced wake word patterns with variations
  const wakeWordPatterns = [
    /\b(hey\s+vision|hey\s+division|hey\s+revision|hey\s+evision)\b/i,
    /\b(vision\s+guide|guide\s+vision|hey\s+guide)\b/i,
    /\b(vision|division|revision|evision)\b/i,
  ];

  // Enhanced command patterns for better accuracy
  const commandPatterns = {
    camera: /\b(camera|see|look|vision|view|detect|analyze|scan)\b/i,
    navigation: /\b(navigate|walk|direction|guide|route|move|go)\b/i,
    emergency: /\b(emergency|help|urgent|call|sos|assist)\b/i,
    settings: /\b(settings|preferences|config|adjust|volume|speed)\b/i,
    status: /\b(status|mode|current|where|what)\b/i,
    help: /\b(help|commands|what\s+can|available)\b/i,
  };

  // Check browser support and permissions
  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      setIsSupported(supported);
      
      if (!supported) {
        setErrorMessage('Speech recognition not supported. Use Chrome, Edge, or Safari.');
        return;
      }

      try {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicrophonePermission(permission.state);
        permission.onchange = () => setMicrophonePermission(permission.state);
      } catch (error) {
        console.log('Permission API not supported');
      }
    };

    checkSupport();
  }, []);

  // Enhanced wake word detection
  const detectWakeWord = (text: string): { detected: boolean; cleanCommand: string } => {
    const lowerText = text.toLowerCase().trim();
    console.log(`Analyzing text: "${lowerText}"`);
    
    for (const pattern of wakeWordPatterns) {
      const match = pattern.exec(lowerText);
      if (match) {
        const cleanCommand = lowerText.replace(pattern, '').trim();
        console.log(`Wake word detected! Clean command: "${cleanCommand}"`);
        return { detected: true, cleanCommand };
      }
    }
    
    return { detected: false, cleanCommand: lowerText };
  };

  // Enhanced command processing with pattern matching
  const processVoiceCommand = (command: string, confidence: number) => {
    if (processingRef.current) {
      console.log('Already processing, skipping duplicate');
      return;
    }

    console.log(`Processing: "${command}" (confidence: ${confidence})`);
    
    // Check for duplicate commands
    const recentCommands = commandHistoryRef.current.slice(-3);
    if (recentCommands.includes(command)) {
      console.log('Duplicate command ignored');
      return;
    }

    commandHistoryRef.current.push(command);
    if (commandHistoryRef.current.length > 10) {
      commandHistoryRef.current.shift();
    }

    processingRef.current = true;
    setIsProcessingCommand(true);
    setLastCommand(command);
    setRecognitionAccuracy(confidence * 100);

    const { detected, cleanCommand } = detectWakeWord(command);
    
    if (!detected) {
      console.log('No wake word detected');
      processingRef.current = false;
      setIsProcessingCommand(false);
      return;
    }

    // Process commands with enhanced pattern matching
    let commandExecuted = false;

    if (commandPatterns.camera.test(cleanCommand)) {
      onVoiceCommand('camera');
      onCameraAction('start');
      speak('Camera activated for object detection');
      commandExecuted = true;
    } else if (commandPatterns.navigation.test(cleanCommand)) {
      onVoiceCommand('navigation');
      onNavigationAction('start');
      speak('Navigation mode activated');
      commandExecuted = true;
    } else if (commandPatterns.emergency.test(cleanCommand)) {
      onVoiceCommand('emergency');
      speak('Emergency panel opened');
      commandExecuted = true;
    } else if (commandPatterns.settings.test(cleanCommand)) {
      onVoiceCommand('settings');
      speak('Settings panel opened');
      commandExecuted = true;
    } else if (commandPatterns.status.test(cleanCommand)) {
      speak(`Current mode is ${currentMode}. Recognition accuracy: ${Math.round(confidence * 100)}%`);
      commandExecuted = true;
    } else if (commandPatterns.help.test(cleanCommand)) {
      speak('Say hey vision followed by: camera for detection, navigate for guidance, emergency for help, or settings for preferences');
      commandExecuted = true;
    }

    if (!commandExecuted) {
      speak(`Command not recognized: "${cleanCommand}". Try saying hey vision help for available commands`);
    }

    // Reset processing state
    setTimeout(() => {
      processingRef.current = false;
      setIsProcessingCommand(false);
    }, 2000);
  };

  // Enhanced error handling
  const handleRecognitionError = (error: any) => {
    console.log('Recognition error:', error.error);
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }

    switch (error.error) {
      case 'not-allowed':
        setRecognitionState('stopped');
        onListeningChange(false);
        setMicrophonePermission('denied');
        setErrorMessage("Microphone access denied. Please allow microphone access.");
        isManualStopRef.current = true;
        break;
      case 'network':
        setErrorMessage("Network error. Check internet connection.");
        restartRecognition(3000);
        break;
      case 'audio-capture':
        setErrorMessage("Audio capture error. Check microphone.");
        restartRecognition(2000);
        break;
      case 'no-speech':
        console.log('No speech detected, continuing...');
        break;
      default:
        console.log('Unknown error, restarting...');
        restartRecognition(1000);
    }
  };

  const restartRecognition = (delay: number) => {
    if (!isManualStopRef.current) {
      restartTimeoutRef.current = setTimeout(() => {
        startRecognition();
      }, delay);
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophonePermission('granted');
      setErrorMessage(null);
      return true;
    } catch (error) {
      setMicrophonePermission('denied');
      setErrorMessage("Microphone access required for voice commands.");
      return false;
    }
  };

  const startRecognition = async () => {
    if (!isSupported || recognitionState !== 'stopped' || isManualStopRef.current) return;

    if (microphonePermission === 'denied') {
      const granted = await requestMicrophonePermission();
      if (!granted) return;
    }

    console.log('Starting enhanced speech recognition...');
    setRecognitionState('starting');
    setErrorMessage(null);
    
    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      handleRecognitionError({ error: 'start_failed' });
    }
  };

  const stopRecognition = () => {
    isManualStopRef.current = true;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    if (recognitionRef.current && recognitionState !== 'stopped') {
      recognitionRef.current.stop();
    }
    
    setRecognitionState('stopped');
    onListeningChange(false);
    setErrorMessage(null);
  };

  const { isLoading: whisperLoading, transcript: whisperTranscript, error: whisperError, recordAndTranscribe } = useWhisperTranscriber();

  // Enhanced speech recognition setup
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognitionInstance = new SpeechRecognition();

    // Optimized configuration for accuracy
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';
    recognitionInstance.maxAlternatives = 5; // Increased for better accuracy
    
    // Enhanced grammar support
    if ('grammars' in recognitionInstance) {
      const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
      if (SpeechGrammarList) {
        try {
          const grammar = `#JSGF V1.0; grammar commands; 
            public <command> = <wake> <action>;
            <wake> = hey vision | vision | hey guide | guide;
            <action> = camera | navigate | emergency | settings | help | status | see | look | walk | call;`;
          const speechRecognitionList = new SpeechGrammarList();
          speechRecognitionList.addFromString(grammar, 1);
          recognitionInstance.grammars = speechRecognitionList;
        } catch (error) {
          console.log('Grammar not supported, continuing without it');
        }
      }
    }

    recognitionInstance.onstart = () => {
      console.log('Enhanced speech recognition started');
      setRecognitionState('running');
      onListeningChange(true);
      setTranscript('');
      isManualStopRef.current = false;
      setErrorMessage(null);
    };

    recognitionInstance.onend = () => {
      console.log('Speech recognition ended');
      setRecognitionState('stopped');
      onListeningChange(false);
      
      if (!isManualStopRef.current) {
        restartRecognition(1500);
      }
    };

    recognitionInstance.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let maxConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        const confidence = result[0].confidence || 0.7;
        
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

      // Process final results with improved threshold
      if (finalTranscript && maxConfidence > 0.4) {
        console.log(`Final: "${finalTranscript}" (${maxConfidence})`);
        processVoiceCommand(finalTranscript, maxConfidence);
        
        setTimeout(() => setTranscript(''), 4000);
      }
    };

    recognitionInstance.onerror = handleRecognitionError;
    recognitionRef.current = recognitionInstance;
    
    // Auto-start after setup
    setTimeout(() => {
      if (isSupported && microphonePermission !== 'denied') {
        startRecognition();
      }
    }, 1000);

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        isManualStopRef.current = true;
        recognitionRef.current.stop();
      }
    };
  }, [isSupported, microphonePermission]);

  const toggleListening = async () => {
    if (recognitionState === 'running') {
      stopRecognition();
      speak('Voice recognition stopped');
    } else {
      if (microphonePermission === 'denied') {
        const granted = await requestMicrophonePermission();
        if (!granted) return;
      }
      
      isManualStopRef.current = false;
      await startRecognition();
      speak('Enhanced voice recognition started. Say hey vision followed by your command');
    }
  };

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
          <h3 className="text-xl font-semibold text-white">Enhanced Voice Control</h3>
        </div>
        <p className="text-gray-300 text-sm">Advanced speech recognition with improved accuracy</p>
        {recognitionAccuracy > 0 && (
          <div className="text-green-400 text-xs mt-1">
            Recognition Accuracy: {Math.round(recognitionAccuracy)}%
          </div>
        )}
      </div>

      {/* Microphone Permission Warning */}
      {microphonePermission === 'denied' && (
        <div className="bg-red-500/20 border-red-400/30 rounded-lg p-3 mb-4">
          <p className="text-red-200 text-center text-sm">
            Microphone access denied. Please allow microphone permissions and refresh.
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
            Processing enhanced command...
          </p>
        </div>
      )}

      {/* Enhanced Voice Commands */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {[
          { command: 'Hey Vision Camera', description: 'Activate YOLO object detection' },
          { command: 'Hey Vision Navigate', description: 'Start GPS navigation' },
          { command: 'Hey Vision Emergency', description: 'Open emergency contacts' },
          { command: 'Hey Vision Settings', description: 'Adjust voice settings' },
          { command: 'Hey Vision Help', description: 'List all commands' },
          { command: 'Hey Vision Status', description: 'Check current mode & accuracy' },
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
          {recognitionState === 'running' ? 'Enhanced listening active...' : 
           recognitionState === 'starting' ? 'Starting enhanced recognition...' :
           'Voice recognition stopped'}
        </span>
      </div>

      {/* Whisper Alternative */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="text-center mb-2">
          <h4 className="text-white text-sm font-medium">Backup: Whisper Transcription</h4>
          <p className="text-gray-400 text-xs">Use if voice recognition issues persist</p>
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
