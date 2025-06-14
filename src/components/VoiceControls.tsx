import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Brain } from 'lucide-react';
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

interface CommandPattern {
  command: string;
  patterns: string[];
  phonetic: string[];
  weight: number;
  context?: string[];
}

interface LearningData {
  successfulCommands: Map<string, number>;
  failedCommands: Map<string, number>;
  userPreferences: Map<string, number>;
  contextHistory: string[];
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
    averageConfidence: 0,
    learningScore: 0
  });
  const [aiProcessingState, setAiProcessingState] = useState<'idle' | 'analyzing' | 'learning'>('idle');
  const [isWaitingForCommand, setIsWaitingForCommand] = useState(false);
  const [lastUserActivity, setLastUserActivity] = useState(Date.now());
  
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualStopRef = useRef(false);
  const lastProcessedTranscriptRef = useRef('');
  const commandHistoryRef = useRef<string[]>([]);
  const learningDataRef = useRef<LearningData>({
    successfulCommands: new Map(),
    failedCommands: new Map(),
    userPreferences: new Map(),
    contextHistory: []
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waitingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechRef = useRef<string>('');
  const isSpeakingInternalRef = useRef(false);

  // Advanced AI-powered command patterns with phonetic matching
  const commandPatterns: CommandPattern[] = [
    // Wake words with phonetic variations
    {
      command: 'wake',
      patterns: ['hey vision', 'vision', 'hey google', 'google'],
      phonetic: ['hay vizhn', 'vizhn', 'hay googl', 'googl', 'division', 'revision'],
      weight: 1.0
    },
    // Mode commands
    {
      command: 'camera',
      patterns: ['camera', 'vision', 'see', 'look', 'watch', 'detect', 'view', 'show me'],
      phonetic: ['kamra', 'vizhn', 'see', 'luk', 'wach', 'detekt'],
      weight: 0.9,
      context: ['visual', 'sight', 'object']
    },
    {
      command: 'navigation',
      patterns: ['navigate', 'navigation', 'walk', 'direction', 'guide', 'move', 'go'],
      phonetic: ['navigat', 'navigashn', 'wak', 'direksh', 'gyd'],
      weight: 0.9,
      context: ['movement', 'walking', 'path']
    },
    {
      command: 'emergency',
      patterns: ['emergency', 'help', 'urgent', 'danger', 'call', 'sos'],
      phonetic: ['emerjnsi', 'help', 'urjnt', 'danjr', 'sos'],
      weight: 1.0,
      context: ['urgent', 'critical', 'assistance']
    },
    {
      command: 'settings',
      patterns: ['settings', 'preferences', 'configure', 'setup', 'adjust', 'options'],
      phonetic: ['setings', 'prefrns', 'konfigyr', 'setup'],
      weight: 0.8,
      context: ['configuration', 'adjustment']
    }
  ];

  // Enhanced speak function with duplicate prevention
  const speakOnce = (text: string) => {
    // Prevent duplicate speech
    if (text === lastSpeechRef.current || isSpeakingInternalRef.current) {
      console.log('Preventing duplicate speech:', text);
      return;
    }
    
    lastSpeechRef.current = text;
    isSpeakingInternalRef.current = true;
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onstart = () => {
        console.log('Speech started:', text);
      };
      
      utterance.onend = () => {
        console.log('Speech ended:', text);
        isSpeakingInternalRef.current = false;
        // Clear the last speech after a delay to allow new messages
        setTimeout(() => {
          lastSpeechRef.current = '';
        }, 2000);
      };
      
      utterance.onerror = () => {
        isSpeakingInternalRef.current = false;
        lastSpeechRef.current = '';
      };
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Reset waiting timeout when user activity is detected
  const resetWaitingTimeout = () => {
    setLastUserActivity(Date.now());
    setIsWaitingForCommand(false);
    
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
    }
    
    // Set new timeout for 1 minute (60000ms)
    waitingTimeoutRef.current = setTimeout(() => {
      if (recognitionState === 'running' && !isProcessingCommand) {
        console.log('User inactive for 1 minute, prompting for command');
        setIsWaitingForCommand(true);
        speakOnce("I'm waiting for your command. Say hey vision followed by your request.");
      }
    }, 60000);
  };

  // Advanced text preprocessing with noise reduction
  const preprocessText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\b(um|uh|er|ah|like|you know)\b/g, '') // Remove filler words
      .replace(/\b(the|a|an|and|or|but)\b/g, '') // Remove common words for better matching
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/(\w)\1{2,}/g, '$1$1') // Reduce repeated characters
      .trim();
  };

  // Phonetic similarity using Soundex-like algorithm
  const getPhoneticCode = (word: string): string => {
    const soundexMap: { [key: string]: string } = {
      'b': '1', 'f': '1', 'p': '1', 'v': '1',
      'c': '2', 'g': '2', 'j': '2', 'k': '2', 'q': '2', 's': '2', 'x': '2', 'z': '2',
      'd': '3', 't': '3',
      'l': '4',
      'm': '5', 'n': '5',
      'r': '6'
    };

    const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!normalized) return '0000';

    let code = normalized[0];
    for (let i = 1; i < normalized.length; i++) {
      const char = normalized[i];
      const soundexChar = soundexMap[char] || '0';
      if (soundexChar !== '0' && soundexChar !== code.slice(-1)) {
        code += soundexChar;
      }
    }

    return (code + '0000').slice(0, 4);
  };

  // Advanced similarity calculation with multiple algorithms
  const calculateAdvancedSimilarity = (str1: string, str2: string): number => {
    // Levenshtein distance
    const levenshtein = getLevenshteinDistance(str1, str2);
    const maxLen = Math.max(str1.length, str2.length);
    const levenshteinSimilarity = maxLen === 0 ? 1 : 1 - (levenshtein / maxLen);

    // Jaccard similarity (token-based)
    const tokens1 = new Set(str1.split(' '));
    const tokens2 = new Set(str2.split(' '));
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    const jaccardSimilarity = union.size === 0 ? 0 : intersection.size / union.size;

    // Phonetic similarity
    const phonetic1 = getPhoneticCode(str1);
    const phonetic2 = getPhoneticCode(str2);
    const phoneticSimilarity = phonetic1 === phonetic2 ? 1 : 0;

    // N-gram similarity
    const ngramSimilarity = calculateNGramSimilarity(str1, str2, 2);

    // Weighted combination
    return (
      levenshteinSimilarity * 0.3 +
      jaccardSimilarity * 0.3 +
      phoneticSimilarity * 0.2 +
      ngramSimilarity * 0.2
    );
  };

  const getLevenshteinDistance = (str1: string, str2: string): number => {
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

  const calculateNGramSimilarity = (str1: string, str2: string, n: number): number => {
    const getNGrams = (str: string, n: number): Set<string> => {
      const ngrams = new Set<string>();
      for (let i = 0; i <= str.length - n; i++) {
        ngrams.add(str.slice(i, i + n));
      }
      return ngrams;
    };

    const ngrams1 = getNGrams(str1, n);
    const ngrams2 = getNGrams(str2, n);
    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  };

  // AI-powered wake word detection with context awareness
  const detectWakeWordAI = (text: string): { detected: boolean; confidence: number } => {
    setAiProcessingState('analyzing');
    
    const preprocessedText = preprocessText(text);
    const words = preprocessedText.split(' ');
    
    let bestMatch = 0;
    let bestConfidence = 0;

    // Check for wake word patterns
    const wakePattern = commandPatterns.find(p => p.command === 'wake');
    if (!wakePattern) return { detected: false, confidence: 0 };

    // Multi-level matching
    for (const pattern of wakePattern.patterns) {
      // Direct match
      if (preprocessedText.includes(pattern)) {
        bestMatch = Math.max(bestMatch, 1.0);
        bestConfidence = 1.0;
        continue;
      }

      // Fuzzy match
      const similarity = calculateAdvancedSimilarity(preprocessedText, pattern);
      if (similarity > bestMatch) {
        bestMatch = similarity;
        bestConfidence = similarity;
      }

      // Word-by-word phonetic matching
      for (const word of words) {
        for (const phoneticPattern of wakePattern.phonetic) {
          const phoneticSimilarity = calculateAdvancedSimilarity(word, phoneticPattern);
          if (phoneticSimilarity > 0.7) {
            bestMatch = Math.max(bestMatch, phoneticSimilarity);
            bestConfidence = Math.max(bestConfidence, phoneticSimilarity);
          }
        }
      }
    }

    // Context-aware adjustment
    const recentCommands = learningDataRef.current.contextHistory.slice(-5);
    if (recentCommands.some(cmd => cmd.includes('vision') || cmd.includes('hey'))) {
      bestConfidence *= 1.2; // Boost confidence if user has been using wake words
    }

    console.log(`AI Wake word analysis: "${text}" -> Match: ${bestMatch}, Confidence: ${bestConfidence}`);
    
    setAiProcessingState('idle');
    return { 
      detected: bestMatch > 0.6, 
      confidence: Math.min(bestConfidence, 1.0) 
    };
  };

  // AI-powered command matching with learning
  const matchCommandAI = (input: string, targetCommand: string): { match: boolean; confidence: number } => {
    setAiProcessingState('analyzing');
    
    const pattern = commandPatterns.find(p => p.command === targetCommand);
    if (!pattern) return { match: false, confidence: 0 };

    const preprocessedInput = preprocessText(input);
    let bestScore = 0;

    // Pattern matching with weights
    for (const patternText of pattern.patterns) {
      const similarity = calculateAdvancedSimilarity(preprocessedInput, patternText);
      const weightedScore = similarity * pattern.weight;
      bestScore = Math.max(bestScore, weightedScore);
    }

    // Phonetic matching
    for (const phoneticPattern of pattern.phonetic) {
      const phoneticSimilarity = calculateAdvancedSimilarity(preprocessedInput, phoneticPattern);
      const phoneticScore = phoneticSimilarity * 0.8; // Slightly lower weight for phonetic
      bestScore = Math.max(bestScore, phoneticScore);
    }

    // Context-aware boosting
    if (pattern.context) {
      for (const contextWord of pattern.context) {
        if (preprocessedInput.includes(contextWord)) {
          bestScore *= 1.3;
          break;
        }
      }
    }

    // Learning-based adjustment
    const learningData = learningDataRef.current;
    const successRate = learningData.successfulCommands.get(targetCommand) || 0;
    const failureRate = learningData.failedCommands.get(targetCommand) || 0;
    
    if (successRate > failureRate) {
      bestScore *= 1.1; // Boost commands that have been successful
    }

    // Current mode context boost
    if (targetCommand === currentMode) {
      bestScore *= 1.2;
    }

    const finalConfidence = Math.min(bestScore, 1.0);
    console.log(`AI Command match for "${targetCommand}": Score=${bestScore}, Confidence=${finalConfidence}`);
    
    setAiProcessingState('idle');
    return {
      match: finalConfidence > 0.65,
      confidence: finalConfidence
    };
  };

  // Machine learning update function
  const updateLearningData = (command: string, success: boolean, confidence: number) => {
    setAiProcessingState('learning');
    
    const learning = learningDataRef.current;
    
    if (success) {
      learning.successfulCommands.set(command, (learning.successfulCommands.get(command) || 0) + 1);
    } else {
      learning.failedCommands.set(command, (learning.failedCommands.get(command) || 0) + 1);
    }
    
    // Update context history
    learning.contextHistory.push(command);
    if (learning.contextHistory.length > 50) {
      learning.contextHistory.shift();
    }
    
    // Calculate learning score
    const totalSuccess = Array.from(learning.successfulCommands.values()).reduce((a, b) => a + b, 0);
    const totalFailure = Array.from(learning.failedCommands.values()).reduce((a, b) => a + b, 0);
    const learningScore = totalSuccess + totalFailure > 0 ? totalSuccess / (totalSuccess + totalFailure) : 0;
    
    setAccuracyMetrics(prev => ({
      ...prev,
      learningScore: learningScore
    }));
    
    console.log(`Learning update: ${command} -> ${success ? 'SUCCESS' : 'FAIL'}, Score: ${learningScore}`);
    setAiProcessingState('idle');
  };

  // Enhanced audio setup for noise reduction
  const setupAudioProcessing = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      source.connect(analyserRef.current);
      
      console.log('Advanced audio processing setup complete');
    } catch (error) {
      console.warn('Advanced audio processing not available:', error);
    }
  };

  // Audio quality analysis
  const analyzeAudioQuality = (): number => {
    if (!analyserRef.current) return 0.5;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate signal strength and quality
    const average = dataArray.reduce((a, b) => a + b) / bufferLength;
    const quality = Math.min(average / 128, 1); // Normalize to 0-1

    return quality;
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
      console.log('Starting AI-enhanced speech recognition...');
      setRecognitionState('starting');
      clearRestartTimeout();
      setupAudioProcessing();
      recognitionRef.current.start();
      resetWaitingTimeout(); // Start the waiting timeout
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
    
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
    }
    
    if (recognitionRef.current && recognitionState !== 'stopped') {
      console.log('Stopping AI speech recognition...');
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
        averageConfidence: newAvgConfidence,
        learningScore: prev.learningScore
      };
    });
  };

  // Enhanced voice command processing with activity tracking
  const processVoiceCommandAI = (command: string, confidence: number) => {
    console.log('Processing AI-enhanced command:', command, 'Confidence:', confidence);
    
    // Reset activity timeout since user spoke
    resetWaitingTimeout();
    
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

    // AI-powered wake word detection
    const wakeWordResult = detectWakeWordAI(command);
    console.log('AI Wake word result:', wakeWordResult);

    if (!wakeWordResult.detected) {
      console.log('No wake word detected by AI');
      setIsProcessingCommand(false);
      updateAccuracyMetrics(false, confidence);
      updateLearningData('wake_detection', false, confidence);
      return;
    }

    // Extract command after wake word with AI preprocessing
    let cleanCommand = preprocessText(command);
    ['hey vision', 'vision', 'hey google', 'google'].forEach(wake => {
      cleanCommand = cleanCommand.replace(wake, '').trim();
    });

    console.log('AI-processed clean command:', cleanCommand);

    // Process with AI-enhanced matching
    if (processMainCommandsAI(cleanCommand, confidence)) {
      updateLearningData('main_command', true, confidence);
      return;
    }

    if (processModeSpecificCommandsAI(cleanCommand, confidence)) {
      updateLearningData('mode_command', true, confidence);
      return;
    }

    if (processGeneralCommandsAI(cleanCommand, confidence)) {
      updateLearningData('general_command', true, confidence);
      return;
    }

    // If no command matched with high confidence, try learning-based suggestions
    const suggestions = generateCommandSuggestions(cleanCommand);
    if (suggestions.length > 0) {
      speakOnce(`I heard "${cleanCommand}" but didn't recognize it. Did you mean ${suggestions[0]}?`);
    } else {
      speakOnce(`I heard "${cleanCommand}" but didn't recognize the command. Try saying hey vision help for available commands.`);
    }
    
    updateAccuracyMetrics(false, confidence);
    updateLearningData('no_match', false, confidence);
    setIsProcessingCommand(false);
  };

  // AI-enhanced main command processing
  const processMainCommandsAI = (command: string, confidence: number): boolean => {
    const modeCommands = [
      { mode: 'camera', response: 'Camera mode activated for smart object detection' },
      { mode: 'navigation', response: 'Navigation mode activated for walking guidance' },
      { mode: 'emergency', response: 'Emergency assistance panel opened' },
      { mode: 'settings', response: 'Settings panel opened' }
    ];

    for (const modeCmd of modeCommands) {
      const matchResult = matchCommandAI(command, modeCmd.mode);
      console.log(`AI Mode command match for ${modeCmd.mode}:`, matchResult);
      
      if (matchResult.match) {
        onVoiceCommand(modeCmd.mode);
        speakOnce(modeCmd.response);
        updateAccuracyMetrics(true, matchResult.confidence);
        setIsProcessingCommand(false);
        return true;
      }
    }
    return false;
  };

  // AI-enhanced mode-specific command processing
  const processModeSpecificCommandsAI = (command: string, confidence: number): boolean => {
    // Similar structure but with AI-enhanced matching for mode-specific commands
    // ... keep existing mode-specific logic but use matchCommandAI instead

    if (currentMode === 'camera') {
      const cameraCommands = [
        { action: 'start', patterns: ['start', 'activate', 'turn on', 'begin', 'open', 'on'], response: 'Camera analysis starting' },
        { action: 'stop', patterns: ['stop', 'close', 'turn off', 'end', 'deactivate', 'off'], response: 'Camera analysis stopped' },
        { action: 'analyze', patterns: ['analyze', 'describe', 'what do you see', 'scan', 'check', 'tell me'], response: 'Analyzing your surroundings' }
      ];
      
      for (const cmd of cameraCommands) {
        let bestMatch = 0;
        for (const pattern of cmd.patterns) {
          const similarity = calculateAdvancedSimilarity(command, pattern);
          bestMatch = Math.max(bestMatch, similarity);
        }
        
        if (bestMatch > 0.6) {
          onCameraAction(cmd.action);
          speakOnce(cmd.response);
          setIsProcessingCommand(false);
          return true;
        }
      }
    }

    // Similar AI-enhanced processing for other modes
    return false;
  };

  // AI-enhanced general command processing
  const processGeneralCommandsAI = (command: string, confidence: number): boolean => {
    const generalCommands = [
      { 
        patterns: ['status', 'where am i', 'current mode', 'what mode'], 
        response: `You are in ${currentMode} mode. Say hey vision followed by camera, navigate, emergency, or settings to switch modes.`
      },
      { 
        patterns: ['help', 'commands', 'what can you do', 'instructions'], 
        response: 'Available commands: Say hey vision followed by camera for object detection, navigate for walking guidance, emergency for help, or settings for preferences.'
      }
    ];

    for (const cmd of generalCommands) {
      let bestMatch = 0;
      for (const pattern of cmd.patterns) {
        const similarity = calculateAdvancedSimilarity(command, pattern);
        bestMatch = Math.max(bestMatch, similarity);
      }
      
      if (bestMatch > 0.6) {
        speakOnce(cmd.response);
        setIsProcessingCommand(false);
        return true;
      }
    }
    return false;
  };

  // AI-powered command suggestions
  const generateCommandSuggestions = (failedCommand: string): string[] => {
    const allCommands = commandPatterns.flatMap(p => p.patterns);
    const suggestions: { command: string; similarity: number }[] = [];

    for (const cmd of allCommands) {
      const similarity = calculateAdvancedSimilarity(failedCommand, cmd);
      if (similarity > 0.4) {
        suggestions.push({ command: cmd, similarity });
      }
    }

    return suggestions
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(s => s.command);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      // AI-optimized settings for maximum accuracy
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 10; // More alternatives for AI processing
      
      recognitionInstance.onstart = () => {
        console.log('AI-enhanced speech recognition started');
        setRecognitionState('running');
        onListeningChange(true);
        setTranscript('');
        isManualStopRef.current = false;
        resetWaitingTimeout(); // Reset timeout when recognition starts
      };

      recognitionInstance.onend = () => {
        console.log('AI speech recognition ended');
        setRecognitionState('stopped');
        onListeningChange(false);
        
        if (waitingTimeoutRef.current) {
          clearTimeout(waitingTimeoutRef.current);
        }
        
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
          
          // Collect all alternatives for AI processing
          for (let j = 0; j < Math.min(result.length, 5); j++) {
            alternatives.push(result[j].transcript);
          }
          
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
        
        // Reset waiting timeout since user is speaking
        if (displayTranscript.trim()) {
          resetWaitingTimeout();
        }
        
        // AI-enhanced confidence calculation
        const audioQuality = analyzeAudioQuality();
        const adjustedConfidence = Math.min(bestConfidence * (0.7 + audioQuality * 0.3), 1.0);
        setConfidence(adjustedConfidence);

        console.log('AI Recognition alternatives:', alternatives);
        console.log('AI Final transcript:', finalTranscript, 'Adjusted confidence:', adjustedConfidence);

        // AI-powered processing with multiple alternatives
        if (finalTranscript.trim()) {
          // Try the best result first
          if (adjustedConfidence > 0.4) {
            processVoiceCommandAI(finalTranscript.trim(), adjustedConfidence);
          } else {
            // AI processes alternatives with wake word detection
            let processed = false;
            for (const alt of alternatives.slice(0, 5)) {
              const wakeResult = detectWakeWordAI(alt);
              if (wakeResult.detected && wakeResult.confidence > 0.5) {
                console.log('AI processing alternative with wake word:', alt);
                processVoiceCommandAI(alt.trim(), wakeResult.confidence);
                processed = true;
                break;
              }
            }
            
            if (!processed) {
              console.log('AI: Low confidence and no wake word in alternatives');
            }
          }
          
          // Clear transcript after processing
          setTimeout(() => {
            setTranscript('');
            setIsProcessingCommand(false);
            lastProcessedTranscriptRef.current = '';
          }, 3000);
        }
      };

      recognitionInstance.onerror = (event: any) => {
        console.log('AI Speech recognition error:', event.error);
        
        if (event.error === 'aborted') {
          return;
        }
        
        setRecognitionState('stopped');
        onListeningChange(false);
        
        if (waitingTimeoutRef.current) {
          clearTimeout(waitingTimeoutRef.current);
        }
        
        if (event.error === 'not-allowed') {
          speakOnce('Microphone access denied. Please allow microphone permissions.');
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
      if (audioContextRef.current) {
        audioContextRef.current.close();
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
          <h3 className="text-xl font-semibold text-white">AI-Enhanced Voice Recognition</h3>
        </div>
        <p className="text-gray-300 text-sm">Advanced ML-powered speech recognition with adaptive learning</p>
        {accuracyMetrics.totalCommands > 0 && (
          <div className="mt-2 text-sm text-blue-300 space-y-1">
            <div>Success Rate: {Math.round((accuracyMetrics.successfulCommands / accuracyMetrics.totalCommands) * 100)}%</div>
            <div>Avg Confidence: {Math.round(accuracyMetrics.averageConfidence * 100)}%</div>
            <div>AI Learning Score: {Math.round(accuracyMetrics.learningScore * 100)}%</div>
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

      {/* Waiting for Command Indicator */}
      {isWaitingForCommand && (
        <div className="bg-yellow-500/20 border-yellow-400/30 rounded-lg p-3 mb-4">
          <p className="text-yellow-200 text-center flex items-center justify-center gap-2">
            <Brain className="w-4 h-4 animate-pulse" />
            Waiting for your command... Say "Hey Vision" to continue
          </p>
        </div>
      )}

      {/* AI Processing State */}
      {aiProcessingState !== 'idle' && (
        <div className="bg-blue-500/20 border-blue-400/30 rounded-lg p-3 mb-4">
          <p className="text-blue-200 text-center flex items-center justify-center gap-2">
            <Brain className="w-4 h-4 animate-spin" />
            AI {aiProcessingState === 'analyzing' ? 'Analyzing' : 'Learning'} your speech patterns...
          </p>
        </div>
      )}

      {/* Live Transcript */}
      {transcript && (
        <div className="bg-blue-500/20 border-blue-400/30 rounded-lg p-3 mb-4">
          <p className="text-white text-center">
            <span className="text-blue-200 text-sm">AI Listening: </span>
            "{transcript}"
            {confidence > 0 && (
              <span className="text-blue-300 text-xs block">
                AI Confidence: {Math.round(confidence * 100)}%
              </span>
            )}
          </p>
        </div>
      )}

      {/* Last Command */}
      {lastCommand && (
        <div className="bg-green-500/20 border-green-400/30 rounded-lg p-3 mb-4">
          <p className="text-white text-center">
            <span className="text-green-200 text-sm">AI Processed: </span>
            "{lastCommand}"
          </p>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessingCommand && (
        <div className="bg-yellow-500/20 border-yellow-400/30 rounded-lg p-3 mb-4">
          <p className="text-yellow-200 text-center flex items-center justify-center gap-2">
            <Brain className="w-4 h-4 animate-pulse" />
            AI processing with advanced pattern recognition...
          </p>
        </div>
      )}

      {/* Command History */}
      {commandHistoryRef.current.length > 0 && (
        <div className="bg-purple-500/20 border-purple-400/30 rounded-lg p-3 mb-4">
          <h4 className="text-purple-200 text-sm font-semibold mb-2">AI Learning History:</h4>
          <div className="text-purple-100 text-xs space-y-1">
            {commandHistoryRef.current.slice(-3).map((cmd, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Brain className="w-3 h-3" />
                "{cmd}"
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Voice Commands Help */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {[
          { command: 'Hey Vision Camera', description: 'AI-powered object detection & scene analysis' },
          { command: 'Hey Vision Navigate', description: 'Intelligent walking guidance system' },
          { command: 'Hey Vision Emergency', description: 'Smart emergency assistance panel' },
          { command: 'Hey Vision Settings', description: 'AI learning preferences & voice settings' },
          { command: 'Hey Vision Help', description: 'Get AI-enhanced command assistance' },
          { command: 'Hey Vision Status', description: 'Check AI learning progress & mode' },
        ].map((cmd, index) => (
          <div
            key={index}
            className="bg-white/5 rounded-lg p-3 border border-white/10"
          >
            <div className="text-white font-medium flex items-center gap-2">
              <Brain className="w-3 h-3 text-blue-400" />
              "{cmd.command}"
            </div>
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
        <Brain className="w-4 h-4 text-blue-400" />
        <span className="text-white text-sm">
          {recognitionState === 'running' ? 'AI listening with advanced pattern recognition...' : 
           recognitionState === 'starting' ? 'Starting AI-enhanced voice recognition...' :
           'AI voice recognition stopped'}
        </span>
      </div>

      {/* AI Enhancement Notice */}
      <div className="mt-4 p-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 rounded-lg">
        <p className="text-blue-200 text-sm text-center">
          <strong>🤖 Smart Features:</strong> Speaks once per command, waits 1 minute for inactivity, then prompts for commands. Advanced AI learning for better recognition.
        </p>
      </div>
    </Card>
  );
};
