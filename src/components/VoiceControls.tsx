
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface VoiceControlsProps {
  isListening: boolean;
  onListeningChange: (listening: boolean) => void;
  onVoiceCommand: (command: string) => void;
  speak: (text: string) => void;
}

export const VoiceControls = ({ 
  isListening, 
  onListeningChange, 
  onVoiceCommand, 
  speak 
}: VoiceControlsProps) => {
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [transcript, setTranscript] = useState('');

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
      };

      recognitionInstance.onresult = (event) => {
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
          onVoiceCommand(finalTranscript);
          setTranscript('');
        }
      };

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        onListeningChange(false);
        if (event.error === 'no-speech') {
          speak('I did not hear anything. Please try again.');
        } else {
          speak('Voice recognition error. Please try again.');
        }
      };

      setRecognition(recognitionInstance);
    }
  }, [onListeningChange, onVoiceCommand, speak]);

  const toggleListening = () => {
    if (!recognition) {
      speak('Voice recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const voiceCommands = [
    { command: 'Camera', description: 'Activate smart vision mode' },
    { command: 'Navigate', description: 'Start walking guidance' },
    { command: 'Emergency', description: 'Open emergency panel' },
    { command: 'Settings', description: 'Open app settings' },
    { command: 'Help', description: 'Get voice assistance' },
  ];

  return (
    <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-6">
      <div className="text-center mb-4">
        <h3 className="text-xl font-semibold text-white mb-2">Voice Commands</h3>
        <p className="text-gray-300 text-sm">Hold the microphone button and speak clearly</p>
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
          {isListening ? 'Listening...' : 'Voice commands ready'}
        </span>
      </div>
    </Card>
  );
};
