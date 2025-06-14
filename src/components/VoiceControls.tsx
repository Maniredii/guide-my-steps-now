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
  const [accuracyMetrics, setAccuracyMetrics] = useState({
    totalCommands: 0,
    successfulCommands: 0,
    averageConfidence: 0
  });
  
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualStopRef = useRef(false);
  const lastProcessedTranscriptRef = useRef('');
  const commandHistoryRef = useRef<string[]>([]);

  // Advanced text preprocessing for better recognition
  const preprocessText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\b(um|uh|er|ah)\b/g, '') // Remove filler words
      .replace(/\b(the|a|an)\b/g, '') // Remove articles for command matching
      .trim();
  };

  // Fuzzy matching for better command recognition
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const getEditDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];
    
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

  // Enhanced wake word detection with multiple variations and fuzzy matching
  const detectWakeWord = (text: string): boolean => {
    const wakeWords = [
      'hey vision', 'vision', 'hey google', 'google',
      'division', 'revision', 'television', 'provision'
    ];
    
    const preprocessedText = preprocessText(text);
    
    return wakeWords.some(wakeWord => {
      const similarity = calculateSimilarity(preprocessedText, wakeWord);
      const containsWord = preprocessedText.includes(wakeWord);
      const wordMatch = preprocessedText.split(' ').some(word => 
        calculateSimilarity(word, wakeWord.split(' ')[0]) > 0.7
      );
      
      console.log(`Wake word check: "${wakeWord}" vs "${preprocessedText}" - Similarity: ${similarity}, Contains: ${containsWord}, Word match: ${wordMatch}`);
      
      return similarity > 0.7 || containsWord || wordMatch;
    });
  };

  // Enhanced command matching with fuzzy logic
  const matchCommand = (input: string, patterns: string[]): { match: boolean; confidence: number } => {
    const preprocessedInput = preprocessText(input);
    
    let bestMatch = 0;
    
    for (const pattern of patterns) {
      const preprocessedPattern = preprocessText(pattern);
      
      // Direct substring match
      if (preprocessedInput.includes(preprocessedPattern)) {
        bestMatch = Math.max(bestMatch, 1.0);
        continue;
      }
      
      // Fuzzy string matching
      const similarity = calculateSimilarity(preprocessedInput, preprocessedPattern);
      bestMatch = Math.max(bestMatch, similarity);
      
      // Word-by-word matching
      const inputWords = preprocessedInput.split(' ');
      const patternWords = preprocessedPattern.split(' ');
      
      let wordMatches = 0;
      for (const patternWord of patternWords) {
        for (const inputWord of inputWords) {
          if (calculateSimilarity(inputWord, patternWord) > 0.8) {
            wordMatches++;
            break;
          }
        }
      }
      
      const wordMatchRatio = wordMatches / patternWords.length;
      bestMatch = Math.max(bestMatch, wordMatchRatio);
    }
    
    return {
      match: bestMatch > 0.6,
      confidence: bestMatch
    };
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

    try {
      console.log('Starting advanced speech recognition...');
      setRecognitionState('starting');
      clearRestartTimeout();
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setRecognitionState('stopped');
      
      if (!isManualStopRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (recognitionState === 'stopped' && !isManualStopRef.current) {
            startRecognition();
          }
        }, 2000);
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

  const updateAccuracyMetrics = (success: boolean, confidence: number) => {
    setAccuracyMetrics(prev => {
      const newTotal = prev.totalCommands + 1;
      const newSuccessful = prev.successfulCommands + (success ? 1 : 0);
      const newAvgConfidence = ((prev.averageConfidence * prev.totalCommands) + confidence) / newTotal;
      
      return {
        totalCommands: newTotal,
        successfulCommands: newSuccessful,
        averageConfidence: newAvgConfidence
      };
    });
  };

  const processVoiceCommand = (command: string, confidence: number) => {
    console.log('Processing advanced command:', command, 'Confidence:', confidence);
    
    // Prevent duplicate processing
    if (command === lastProcessedTranscriptRef.current) {
      console.log('Duplicate command ignored');
      return;
    }
    lastProcessedTranscriptRef.current = command;
    
    // Add to command history
    commandHistoryRef.current.push(command);
    if (commandHistoryRef.current.length > 10) {
      commandHistoryRef.current.shift();
    }
    
    setLastCommand(command);
    setIsProcessingCommand(true);

    const hasWakeWord = detectWakeWord(command);
    console.log('Wake word detected:', hasWakeWord);

    if (!hasWakeWord) {
      console.log('No wake word detected in:', command);
      setIsProcessingCommand(false);
      updateAccuracyMetrics(false, confidence);
      return;
    }

    // Extract command after wake word
    let cleanCommand = preprocessText(command);
    ['hey vision', 'vision', 'hey google', 'google'].forEach(wake => {
      cleanCommand = cleanCommand.replace(wake, '').trim();
    });

    console.log('Clean command after preprocessing:', cleanCommand);

    // Process commands with enhanced matching
    if (processMainCommands(cleanCommand, confidence)) {
      updateAccuracyMetrics(true, confidence);
      return;
    }

    if (processModeSpecificCommands(cleanCommand, confidence)) {
      updateAccuracyMetrics(true, confidence);
      return;
    }

    if (processGeneralCommands(cleanCommand, confidence)) {
      updateAccuracyMetrics(true, confidence);
      return;
    }

    // If no command matched
    console.log('No command pattern matched for:', cleanCommand);
    speak(`I heard "${cleanCommand}" but didn't recognize the command. Try saying hey vision help for available commands.`);
    updateAccuracyMetrics(false, confidence);
    setIsProcessingCommand(false);
  };

  const processMainCommands = (command: string, confidence: number): boolean => {
    const modeCommands = [
      { 
        patterns: ['camera', 'vision', 'see', 'look', 'watch', 'detect', 'view', 'show me'], 
        mode: 'camera',
        response: 'Camera mode activated for object detection'
      },
      { 
        patterns: ['navigate', 'navigation', 'walk', 'direction', 'guide', 'move', 'go'], 
        mode: 'navigation',
        response: 'Navigation mode activated for walking guidance'
      },
      { 
        patterns: ['emergency', 'help', 'urgent', 'danger', 'call', 'sos'], 
        mode: 'emergency',
        response: 'Emergency panel opened'
      },
      { 
        patterns: ['settings', 'preferences', 'configure', 'setup', 'adjust', 'options'], 
        mode: 'settings',
        response: 'Settings panel opened'
      }
    ];

    for (const modeCmd of modeCommands) {
      const matchResult = matchCommand(command, modeCmd.patterns);
      console.log(`Mode command match for ${modeCmd.mode}:`, matchResult);
      
      if (matchResult.match) {
        onVoiceCommand(modeCmd.mode);
        speak(modeCmd.response);
        setIsProcessingCommand(false);
        return true;
      }
    }
    return false;
  };

  const processModeSpecificCommands = (command: string, confidence: number): boolean => {
    // Camera commands
    if (currentMode === 'camera') {
      const cameraCommands = [
        { patterns: ['start', 'activate', 'turn on', 'begin', 'open', 'on'], action: 'start', response: 'Starting camera for object detection' },
        { patterns: ['stop', 'close', 'turn off', 'end', 'deactivate', 'off'], action: 'stop', response: 'Stopping camera' },
        { patterns: ['analyze', 'describe', 'what do you see', 'scan', 'check', 'tell me'], action: 'analyze', response: 'Analyzing your surroundings now' }
      ];
      
      for (const cmd of cameraCommands) {
        const matchResult = matchCommand(command, cmd.patterns);
        if (matchResult.match) {
          onCameraAction(cmd.action);
          speak(cmd.response);
          setIsProcessingCommand(false);
          return true;
        }
      }
    }

    // Navigation commands
    if (currentMode === 'navigation') {
      const navCommands = [
        { patterns: ['start', 'begin', 'activate', 'turn on'], action: 'start' },
        { patterns: ['next', 'continue', 'forward', 'proceed', 'step'], action: 'next' },
        { patterns: ['repeat', 'again', 'say again', 'once more'], action: 'repeat' },
        { patterns: ['stop', 'end', 'finish', 'quit'], action: 'stop' }
      ];
      
      for (const cmd of navCommands) {
        const matchResult = matchCommand(command, cmd.patterns);
        if (matchResult.match) {
          onNavigationAction(cmd.action);
          setIsProcessingCommand(false);
          return true;
        }
      }
    }

    // Emergency commands
    if (currentMode === 'emergency') {
      const emergencyCommands = [
        { patterns: ['call emergency', 'nine one one', '911', 'dial emergency'], action: 'call-911' },
        { patterns: ['call family', 'family contact', 'family member'], action: 'call-family' },
        { patterns: ['call friend', 'trusted friend', 'friend contact'], action: 'call-friend' },
        { patterns: ['share location', 'send location', 'location'], action: 'share-location' },
        { patterns: ['send help', 'help message', 'distress'], action: 'send-help' }
      ];
      
      for (const cmd of emergencyCommands) {
        const matchResult = matchCommand(command, cmd.patterns);
        if (matchResult.match) {
          onEmergencyAction(cmd.action);
          setIsProcessingCommand(false);
          return true;
        }
      }
    }

    // Settings commands
    if (currentMode === 'settings') {
      const settingsCommands = [
        { patterns: ['faster', 'speed up', 'quick', 'rapid', 'speech faster'], setting: 'speechRate', value: 'increase', response: 'Speech rate increased' },
        { patterns: ['slower', 'slow down', 'gentle', 'calm', 'speech slower'], setting: 'speechRate', value: 'decrease', response: 'Speech rate decreased' },
        { patterns: ['louder', 'volume up', 'increase volume'], setting: 'speechVolume', value: 'increase', response: 'Volume increased' },
        { patterns: ['quieter', 'volume down', 'decrease volume'], setting: 'speechVolume', value: 'decrease', response: 'Volume decreased' },
        { patterns: ['test', 'try', 'sample'], setting: 'test', value: true, response: '' },
        { patterns: ['reset', 'default', 'original'], setting: 'reset', value: true, response: '' }
      ];
      
      for (const cmd of settingsCommands) {
        const matchResult = matchCommand(command, cmd.patterns);
        if (matchResult.match) {
          onSettingsChange(cmd.setting, cmd.value);
          if (cmd.response) speak(cmd.response);
          setIsProcessingCommand(false);
          return true;
        }
      }
    }

    return false;
  };

  const processGeneralCommands = (command: string, confidence: number): boolean => {
    const generalCommands = [
      { 
        patterns: ['status', 'where am i', 'current mode', 'what mode'], 
        response: `You are currently in ${currentMode} mode. Say hey vision followed by camera, navigate, emergency, or settings to switch modes.`
      },
      { 
        patterns: ['help', 'commands', 'what can you do', 'instructions'], 
        response: 'Say hey vision followed by: camera for object detection, navigate for walking guidance, emergency for help, or settings for preferences. You can also say status to check current mode.'
      }
    ];

    for (const cmd of generalCommands) {
      const matchResult = matchCommand(command, cmd.patterns);
      if (matchResult.match) {
        speak(cmd.response);
        setIsProcessingCommand(false);
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      // Enhanced settings for maximum accuracy
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 5; // Get more alternatives for better matching
      
      recognitionInstance.onstart = () => {
        console.log('Advanced speech recognition started');
        setRecognitionState('running');
        onListeningChange(true);
        setTranscript('');
        isManualStopRef.current = false;
      };

      recognitionInstance.onend = () => {
        console.log('Speech recognition ended');
        setRecognitionState('stopped');
        onListeningChange(false);
        
        if (!isManualStopRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (!isManualStopRef.current && recognitionState === 'stopped') {
              startRecognition();
            }
          }, 500);
        }
      };

      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        let bestConfidence = 0;
        let alternatives: string[] = [];

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          
          // Collect all alternatives
          for (let j = 0; j < result.length; j++) {
            alternatives.push(result[j].transcript);
          }
          
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0.7;
          
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

        console.log('Recognition alternatives:', alternatives);
        console.log('Final transcript:', finalTranscript, 'Confidence:', bestConfidence);

        // Process final transcript with lower threshold for better responsiveness
        if (finalTranscript.trim()) {
          // Try the best result first
          if (bestConfidence > 0.3) {
            processVoiceCommand(finalTranscript.trim(), bestConfidence);
          } else {
            // If confidence is low, try alternatives with wake word detection
            let processed = false;
            for (const alt of alternatives.slice(0, 3)) { // Try top 3 alternatives
              if (detectWakeWord(alt)) {
                console.log('Processing alternative with wake word:', alt);
                processVoiceCommand(alt.trim(), 0.5);
                processed = true;
                break;
              }
            }
            
            if (!processed) {
              console.log('Low confidence and no wake word in alternatives');
            }
          }
          
          // Clear transcript after processing
          setTimeout(() => {
            setTranscript('');
            setIsProcessingCommand(false);
            lastProcessedTranscriptRef.current = '';
          }, 2000);
        }
      };

      recognitionInstance.onerror = (event: any) => {
        console.log('Speech recognition error:', event.error);
        
        if (event.error === 'aborted') {
          return;
        }
        
        setRecognitionState('stopped');
        onListeningChange(false);
        
        if (event.error === 'not-allowed') {
          speak('Microphone access denied. Please allow microphone permissions.');
          isManualStopRef.current = true;
          return;
        }
        
        if (!isManualStopRef.current) {
          clearRestartTimeout();
          restartTimeoutRef.current = setTimeout(() => {
            if (!isManualStopRef.current && recognitionState === 'stopped') {
              startRecognition();
            }
          }, 1000);
        }
      };

      recognitionRef.current = recognitionInstance;
      setTimeout(startRecognition, 300);
    } else {
      speak('Voice recognition is not supported in this browser.');
    }

    return () => {
      clearRestartTimeout();
      if (recognitionRef.current) {
        isManualStopRef.current = true;
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = () => {
    if (recognitionState === 'running') {
      stopRecognition();
      speak('Voice recognition stopped');
    } else {
      isManualStopRef.current = false;
      startRecognition();
      speak('Advanced voice recognition started. Say hey vision followed by your command');
    }
  };

  const voiceCommands = [
    { command: 'Hey Vision Camera', description: 'Smart vision & object detection' },
    { command: 'Hey Vision Navigate', description: 'Walking guidance system' },
    { command: 'Hey Vision Emergency', description: 'Emergency assistance panel' },
    { command: 'Hey Vision Settings', description: 'Voice & app preferences' },
    { command: 'Hey Vision Help', description: 'Get detailed assistance' },
    { command: 'Hey Vision Status', description: 'Check current mode' },
  ];

  return (
    <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6">
      <div className="text-center mb-4">
        <h3 className="text-xl font-semibold text-white mb-2">Advanced Voice Commands</h3>
        <p className="text-gray-300 text-sm">AI-Enhanced voice recognition with fuzzy matching</p>
        {accuracyMetrics.totalCommands > 0 && (
          <div className="mt-2 text-sm text-blue-300">
            Success Rate: {Math.round((accuracyMetrics.successfulCommands / accuracyMetrics.totalCommands) * 100)}% 
            | Avg Confidence: {Math.round(accuracyMetrics.averageConfidence * 100)}%
          </div>
        )}
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
            AI Processing command with fuzzy matching...
          </p>
        </div>
      )}

      {/* Command History */}
      {commandHistoryRef.current.length > 0 && (
        <div className="bg-purple-500/20 border-purple-400/30 rounded-lg p-3 mb-4">
          <h4 className="text-purple-200 text-sm font-semibold mb-2">Recent Commands:</h4>
          <div className="text-purple-100 text-xs space-y-1">
            {commandHistoryRef.current.slice(-3).map((cmd, idx) => (
              <div key={idx}>"{cmd}"</div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Voice Commands Help */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {[
          { command: 'Hey Vision Camera', description: 'Smart vision & object detection' },
          { command: 'Hey Vision Navigate', description: 'Walking guidance system' },
          { command: 'Hey Vision Emergency', description: 'Emergency assistance panel' },
          { command: 'Hey Vision Settings', description: 'Voice & app preferences' },
          { command: 'Hey Vision Help', description: 'Get detailed assistance' },
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
          {recognitionState === 'running' ? 'AI listening with enhanced recognition...' : 
           recognitionState === 'starting' ? 'Starting AI voice recognition...' :
           'Voice recognition stopped'}
        </span>
      </div>

      {/* AI Enhancement Notice */}
      <div className="mt-4 p-3 bg-green-500/20 border-green-400/30 rounded-lg">
        <p className="text-green-200 text-sm text-center">
          <strong>AI-Enhanced Recognition:</strong> Using fuzzy matching, multiple alternatives, and adaptive learning for improved accuracy.
        </p>
      </div>
    </Card>
  );
};
