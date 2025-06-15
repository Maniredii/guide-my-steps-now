
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
  const [isWaitingForCommand, setIsWaitingForCommand] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualStopRef = useRef(false);
  const lastProcessedTranscriptRef = useRef('');
  const waitingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechTimeRef = useRef<number>(0);
  const processingRef = useRef(false);

  // Check browser support and microphone permissions
  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      setIsSupported(supported);
      
      if (!supported) {
        setErrorMessage('Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
        return;
      }

      // Check microphone permission
      try {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicrophonePermission(permission.state);
        
        permission.onchange = () => {
          setMicrophonePermission(permission.state);
        };
      } catch (error) {
        console.log('Permission API not supported, will check on first use');
      }
    };

    checkSupport();
  }, []);

  // Enhanced wake word detection with better similarity
  const detectWakeWord = (text: string): boolean => {
    const lowerText = text.toLowerCase().replace(/[^\w\s]/g, '');
    const wakeWords = [
      'hey vision', 'vision', 'hey guide', 'guide', 'hey division', 
      'division', 'revision', 'havision', 'hey vis', 'hei vision', 
      'a vision', 'evision', 'hey fishing', 'fishing'
    ];
    
    return wakeWords.some(wake => {
      const similarity = calculateSimilarity(lowerText, wake);
      console.log(`Comparing "${lowerText}" with "${wake}": ${similarity}`);
      return lowerText.includes(wake) || similarity > 0.7;
    });
  };

  // Improved similarity calculation
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Controlled speech function
  const speakOnce = (text: string) => {
    const now = Date.now();
    if (now - lastSpeechTimeRef.current < 2000) {
      console.log('Speech blocked - too soon after last speech');
      return;
    }
    
    lastSpeechTimeRef.current = now;
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      console.log('Speaking:', text);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Reset waiting timeout
  const resetWaitingTimeout = () => {
    setIsWaitingForCommand(false);
    
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
    
    waitingTimeoutRef.current = setTimeout(() => {
      if (recognitionState === 'running' && !isProcessingCommand) {
        console.log('User inactive for 1 minute');
        setIsWaitingForCommand(true);
        speakOnce("I'm waiting for your command. Say hey vision followed by your request.");
      }
    }, 60000);
  };

  // Enhanced command processing
  const processVoiceCommand = (command: string, confidence: number) => {
    if (processingRef.current) {
      console.log('Already processing a command, skipping');
      return;
    }

    console.log('Processing command:', command, 'Confidence:', confidence);
    
    if (command === lastProcessedTranscriptRef.current) {
      console.log('Duplicate command ignored');
      return;
    }
    
    lastProcessedTranscriptRef.current = command;
    processingRef.current = true;
    setIsProcessingCommand(true);
    setLastCommand(command);
    resetWaitingTimeout();

    // Wake word detection
    if (!detectWakeWord(command)) {
      console.log('No wake word detected in:', command);
      processingRef.current = false;
      setIsProcessingCommand(false);
      return;
    }

    // Extract command after wake word
    let cleanCommand = command.toLowerCase();
    ['hey vision', 'vision', 'hey guide', 'guide', 'hey fishing', 'fishing'].forEach(wake => {
      cleanCommand = cleanCommand.replace(wake, '').trim();
    });

    console.log('Clean command:', cleanCommand);

    // Process main commands
    if (cleanCommand.includes('camera') || cleanCommand.includes('see') || cleanCommand.includes('look')) {
      onVoiceCommand('camera');
      speakOnce('Camera mode activated');
    } else if (cleanCommand.includes('navigate') || cleanCommand.includes('walk') || cleanCommand.includes('direction')) {
      onVoiceCommand('navigation');
      speakOnce('Navigation mode activated');
    } else if (cleanCommand.includes('emergency') || cleanCommand.includes('help') || cleanCommand.includes('urgent')) {
      onVoiceCommand('emergency');
      speakOnce('Emergency panel opened');
    } else if (cleanCommand.includes('settings') || cleanCommand.includes('preferences')) {
      onVoiceCommand('settings');
      speakOnce('Settings panel opened');
    } else if (cleanCommand.includes('status') || cleanCommand.includes('mode')) {
      speakOnce(`You are currently in ${currentMode} mode`);
    } else if (cleanCommand.includes('help') || cleanCommand.includes('commands')) {
      speakOnce('Available commands: Say hey vision followed by camera, navigate, emergency, or settings');
    } else if (cleanCommand.trim() === '') {
      speakOnce('Please tell me what you need after saying hey vision');
    } else {
      speakOnce(`I heard "${cleanCommand}" but didn't understand. Try saying hey vision help for available commands`);
    }

    // Reset processing state
    setTimeout(() => {
      processingRef.current = false;
      setIsProcessingCommand(false);
      lastProcessedTranscriptRef.current = '';
    }, 2000);
  };

  const handleRecognitionError = (error: any) => {
    console.log('Speech recognition error:', error);
    
    // Clear any existing restart timeout
    clearRestartTimeout();

    // Handle specific error types
    if (error.error === 'not-allowed') {
      setRecognitionState('stopped');
      onListeningChange(false);
      setMicrophonePermission('denied');
      setErrorMessage("Microphone access denied. Please allow microphone permissions in your browser settings.");
      isManualStopRef.current = true;
      setErrorCount(0);
      return;
    }

    if (error.error === 'aborted') {
      console.log('Recognition aborted (manual stop)');
      return;
    }

    if (error.error === 'no-speech') {
      console.log('No speech detected, continuing...');
      // Don't count as error, natural pause
      return;
    }

    if (error.error === 'audio-capture') {
      setErrorMessage("Audio capture error. Please check your microphone.");
      setRecognitionState('stopped');
      onListeningChange(false);
      return;
    }

    if (error.error === 'network') {
      setErrorMessage("Network error. Please check your internet connection.");
      setRecognitionState('stopped');
      onListeningChange(false);
      return;
    }

    // Increment error counter for other errors
    setErrorCount(prev => {
      const next = prev + 1;
      console.log(`Error count: ${next}`);
      
      if (next >= 5) {
        setRecognitionState('stopped');
        onListeningChange(false);
        setErrorMessage("Multiple recognition errors. Please refresh the page and try again.");
        isManualStopRef.current = true;
        return next;
      }
      
      // Restart with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, next), 10000);
      setTimeout(() => {
        if (!isManualStopRef.current && recognitionState === 'stopped') {
          console.log(`Restarting recognition after ${delay}ms delay`);
          startRecognition();
        }
      }, delay);
      
      return next;
    });
  };

  const clearRestartTimeout = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophonePermission('granted');
      setErrorMessage(null);
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setMicrophonePermission('denied');
      setErrorMessage("Microphone access is required for voice commands. Please allow microphone access.");
      return false;
    }
  };

  const startRecognition = async () => {
    if (!isSupported) {
      setErrorMessage('Speech recognition is not supported in this browser.');
      return;
    }

    if (microphonePermission === 'denied') {
      const granted = await requestMicrophonePermission();
      if (!granted) return;
    }

    if (!recognitionRef.current || recognitionState !== 'stopped' || isManualStopRef.current) {
      return;
    }

    console.log('Starting speech recognition...');
    setRecognitionState('starting');
    clearRestartTimeout();
    setErrorMessage(null);
    
    try {
      recognitionRef.current.start();
      resetWaitingTimeout();
      setErrorCount(0);
    } catch (error) {
      console.error('Failed to start recognition:', error);
      handleRecognitionError({ error: 'start_failed' });
    }
  };

  const stopRecognition = () => {
    isManualStopRef.current = true;
    clearRestartTimeout();
    
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
    
    if (recognitionRef.current && recognitionState !== 'stopped') {
      console.log('Stopping speech recognition...');
      recognitionRef.current.stop();
    }
    
    setRecognitionState('stopped');
    onListeningChange(false);
    setErrorMessage(null);
  };

  const { isLoading: whisperLoading, transcript: whisperTranscript, error: whisperError, recordAndTranscribe } = useWhisperTranscriber();

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognitionInstance = new SpeechRecognition();

    // Enhanced configuration for better recognition
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';
    recognitionInstance.maxAlternatives = 3;

    // Add grammar hints for better wake word detection with proper browser support check
    if ('grammars' in recognitionInstance) {
      const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
      if (SpeechGrammarList) {
        try {
          const grammar = '#JSGF V1.0; grammar commands; public <command> = hey vision | vision | camera | navigate | emergency | settings | help | status ;';
          const speechRecognitionList = new SpeechGrammarList();
          speechRecognitionList.addFromString(grammar, 1);
          recognitionInstance.grammars = speechRecognitionList;
        } catch (error) {
          console.log('Speech grammar not supported, continuing without it');
        }
      }
    }

    recognitionInstance.onstart = () => {
      console.log('Speech recognition started successfully');
      setRecognitionState('running');
      onListeningChange(true);
      setTranscript('');
      isManualStopRef.current = false;
      resetWaitingTimeout();
      setErrorMessage(null);
    };

    recognitionInstance.onend = () => {
      console.log('Speech recognition ended');
      setRecognitionState('stopped');
      onListeningChange(false);
      
      if (waitingTimeoutRef.current) {
        clearTimeout(waitingTimeoutRef.current);
      }
      
      // Only restart if not manually stopped and no errors
      if (!isManualStopRef.current && errorCount < 3) {
        restartTimeoutRef.current = setTimeout(() => {
          if (!isManualStopRef.current) {
            startRecognition();
          }
        }, 2000);
      }
    };

    recognitionInstance.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let bestConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.5;
        
        if (result.isFinal) {
          finalTranscript += transcript;
          bestConfidence = Math.max(bestConfidence, confidence);
        } else {
          interimTranscript += transcript;
        }
      }

      const displayTranscript = finalTranscript || interimTranscript;
      setTranscript(displayTranscript);
      setConfidence(bestConfidence);

      // Process final results with lower confidence threshold
      if (finalTranscript.trim() && bestConfidence > 0.3) {
        console.log('Final transcript:', finalTranscript, 'Confidence:', bestConfidence);
        processVoiceCommand(finalTranscript.trim(), bestConfidence);
        
        setTimeout(() => {
          setTranscript('');
        }, 3000);
      }
    };

    recognitionInstance.onerror = handleRecognitionError;

    recognitionRef.current = recognitionInstance;
    
    // Auto-start recognition after component mounts
    setTimeout(() => {
      if (isSupported && microphonePermission !== 'denied') {
        startRecognition();
      }
    }, 1000);

    return () => {
      clearRestartTimeout();
      if (waitingTimeoutRef.current) {
        clearTimeout(waitingTimeoutRef.current);
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
      speakOnce('Voice recognition stopped');
    } else {
      if (microphonePermission === 'denied') {
        const granted = await requestMicrophonePermission();
        if (!granted) return;
      }
      
      isManualStopRef.current = false;
      setErrorCount(0);
      await startRecognition();
      speakOnce('Voice recognition started. Say hey vision followed by your command');
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
          <h3 className="text-xl font-semibold text-white">Voice Control</h3>
        </div>
        <p className="text-gray-300 text-sm">Enhanced voice recognition with improved wake word detection</p>
      </div>

      {/* Microphone Permission Warning */}
      {microphonePermission === 'denied' && (
        <div className="bg-red-500/20 border-red-400/30 rounded-lg p-3 mb-4">
          <p className="text-red-200 text-center">
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
              : 'bg-red-500 hover:bg-red-600'
          } text-white w-20 h-20 rounded-full transition-all duration-300 transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed`}
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
          <p className="text-red-200 text-center text-sm">
            {errorMessage}
          </p>
        </div>
      )}

      {/* Waiting for Command Indicator */}
      {isWaitingForCommand && (
        <div className="bg-yellow-500/20 border-yellow-400/30 rounded-lg p-3 mb-4">
          <p className="text-yellow-200 text-center flex items-center justify-center gap-2">
            <Volume2 className="w-4 h-4 animate-pulse" />
            Waiting for your command... Say "Hey Vision" to continue
          </p>
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

      {/* Voice Commands Help */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {[
          { command: 'Hey Vision Camera', description: 'Activate object detection' },
          { command: 'Hey Vision Navigate', description: 'Start walking guidance' },
          { command: 'Hey Vision Emergency', description: 'Open emergency panel' },
          { command: 'Hey Vision Settings', description: 'Open settings panel' },
          { command: 'Hey Vision Help', description: 'Get available commands' },
          { command: 'Hey Vision Status', description: 'Check current mode' },
        ].map((cmd, index) => (
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
          {recognitionState === 'running' ? 'Listening for "Hey Vision"...' : 
           recognitionState === 'starting' ? 'Starting voice recognition...' :
           'Voice recognition stopped'}
        </span>
        {errorCount > 0 && (
          <span className="text-yellow-300 text-xs ml-2">
            (Errors: {errorCount})
          </span>
        )}
      </div>

      {/* Whisper Transcription Demo */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="text-center mb-2">
          <h4 className="text-white text-sm font-medium">Alternative: Whisper Transcription</h4>
          <p className="text-gray-400 text-xs">Use if voice recognition is not working well</p>
        </div>
        <div className="flex flex-col items-center">
          <Button 
            onClick={recordAndTranscribe}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-2 mb-2"
            disabled={whisperLoading}
          >
            {whisperLoading ? "Recording & Processing..." : "Record with Whisper"}
          </Button>
          {whisperLoading && <div className="text-orange-200 text-sm mt-1">Recording up to 4 seconds...</div>}
          {whisperTranscript && (
            <div className="mt-2 px-3 py-2 rounded bg-orange-700/30 border border-orange-500 text-white text-center text-sm">
              <strong>Whisper result:</strong> "{whisperTranscript}"
            </div>
          )}
          {whisperError && (
            <div className="mt-2 px-2 py-1 rounded bg-red-500/30 border border-red-500 text-red-200 text-center text-sm">
              {whisperError}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
