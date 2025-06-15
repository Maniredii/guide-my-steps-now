import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
  const [isWaitingForCommand, setIsWaitingForCommand] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // track error display
  const [errorCount, setErrorCount] = useState(0); // handle persistent errors

  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualStopRef = useRef(false);
  const lastProcessedTranscriptRef = useRef('');
  const waitingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechTimeRef = useRef<number>(0);
  const processingRef = useRef(false);

  // Enhanced wake word detection
  const detectWakeWord = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    const wakeWords = [
      'hey vision', 'vision', 'hey guide', 'guide', 'hey division', 'division', 'revision', 'havision', 'hey vis', 'hei vision', 'a vision', 'evision'
    ];
    // Accepts if any word in phrase is in the wakeWords set, or Levenshtein similarity > 0.6
    return wakeWords.some(wake =>
      lowerText.includes(wake) ||
      calculateSimilarity(lowerText, wake) > 0.6
    ) || lowerText.replace(/[^a-z]/g,"").startsWith('vision') // Accept trailing/partial
  };

  // Simple similarity calculation
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
      utterance.rate = 0.8;
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
      console.log('No wake word detected');
      processingRef.current = false;
      setIsProcessingCommand(false);
      return;
    }

    // Extract command after wake word
    let cleanCommand = command.toLowerCase();
    ['hey vision', 'vision', 'hey guide', 'guide'].forEach(wake => {
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

    // Increment error counter
    setErrorCount(prev => {
      const next = prev + 1;
      if (next >= 3) {
        setRecognitionState('stopped');
        onListeningChange(false);
        setErrorMessage("Unable to access microphone or unsupported browser. Please check your microphone permissions and browser support for speech recognition.");
        return next; // stop auto-restarting
      }
      return next;
    });

    if (error.error === 'aborted') {
      setRecognitionState('stopped');
      onListeningChange(false);
      return;
    }

    if (error.error === 'not-allowed') {
      setRecognitionState('stopped');
      onListeningChange(false);
      setErrorMessage("Microphone access denied. Please allow microphone permissions in your browser.");
      isManualStopRef.current = true;
      return;
    }

    // Previously, this code caused infinite restarts (which doesn't resolve the underlying error)
    // Now, restart IF below error threshold only.
    setTimeout(() => {
      if (errorCount < 3 && !isManualStopRef.current && recognitionState === 'stopped') {
        startRecognition();
      }
    }, 2000);
  };

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

    console.log('Starting speech recognition...');
    setRecognitionState('starting');
    clearRestartTimeout();
    
    try {
      recognitionRef.current.start();
      resetWaitingTimeout();
      setErrorCount(0); // reset error count if starting works
      setErrorMessage(null); // clear errors
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
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 5; // Increase alternatives for more possible matches

      // These hints are browser-specific and may not all be honored,
      // but we offer them for best accuracy
      if ('grammars' in recognitionInstance) {
        // Fix: Safely access SpeechGrammarList or webkitSpeechGrammarList with proper TS check
        const SpeechGrammarList =
          (window as any).SpeechGrammarList ||
          (window as any).webkitSpeechGrammarList;
        if (SpeechGrammarList) {
          const grammar =
            '#JSGF V1.0; grammar commands; public <command> = hey vision | vision | camera | navigate | emergency | settings | help | status ;';
          const speechRecognitionList = new SpeechGrammarList();
          speechRecognitionList.addFromString(grammar, 1);
          recognitionInstance.grammars = speechRecognitionList;
        }
      }

      recognitionInstance.onstart = () => {
        console.log('Speech recognition started');
        setRecognitionState('running');
        onListeningChange(true);
        setTranscript('');
        isManualStopRef.current = false;
        resetWaitingTimeout();
      };

      recognitionInstance.onend = () => {
        console.log('Speech recognition ended');
        setRecognitionState('stopped');
        onListeningChange(false);
        
        if (waitingTimeoutRef.current) {
          clearTimeout(waitingTimeoutRef.current);
        }
        
        if (!isManualStopRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (!isManualStopRef.current) {
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

        if (finalTranscript.trim() && bestConfidence > 0.4) {
          processVoiceCommand(finalTranscript.trim(), bestConfidence);
          
          setTimeout(() => {
            setTranscript('');
          }, 3000);
        }
      };

      recognitionInstance.onerror = handleRecognitionError;

      recognitionRef.current = recognitionInstance;
      
      // Start recognition after component mounts
      setTimeout(() => {
        startRecognition();
      }, 500);
    } else {
      speakOnce('Voice recognition is not supported in this browser.');
    }

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
  }, []);

  const toggleListening = () => {
    if (recognitionState === 'running') {
      stopRecognition();
      speakOnce('Voice recognition stopped');
    } else {
      isManualStopRef.current = false;
      startRecognition();
      speakOnce('Voice recognition started. Say hey vision followed by your command');
    }
  };

  return (
    <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Brain className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">Voice Control</h3>
        </div>
        <p className="text-gray-300 text-sm">Real-time voice recognition with wake word detection</p>
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
        >
          {recognitionState === 'running' ? (
            <Mic className="w-8 h-8" />
          ) : (
            <MicOff className="w-8 h-8" />
          )}
        </Button>
      </div>

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
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-500/20 border-red-400/30 rounded-lg p-3 mb-4">
          <p className="text-red-200 text-center flex items-center justify-center gap-2">
            {errorMessage}
          </p>
        </div>
      )}
    </Card>
  );
};
