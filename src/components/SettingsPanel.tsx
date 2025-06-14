
import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Settings, User, Smartphone, Accessibility } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

interface SettingsPanelProps {
  speak: (text: string) => void;
}

export const SettingsPanel = ({ speak }: SettingsPanelProps) => {
  const [speechRate, setSpeechRate] = useState([0.8]);
  const [speechPitch, setSpeechPitch] = useState([1]);
  const [speechVolume, setSpeechVolume] = useState([1]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    // Get available voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !selectedVoice) {
        setSelectedVoice(voices[0].name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [selectedVoice]);

  const testSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        'This is a test of your voice settings. The speech rate, pitch, and volume have been adjusted according to your preferences.'
      );
      
      utterance.rate = speechRate[0];
      utterance.pitch = speechPitch[0];
      utterance.volume = speechVolume[0];
      
      if (selectedVoice) {
        const voice = availableVoices.find(v => v.name === selectedVoice);
        if (voice) utterance.voice = voice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    if (newState) {
      speak('Voice feedback enabled');
    } else {
      // One last announcement before disabling
      speak('Voice feedback disabled');
    }
  };

  const resetSettings = () => {
    setSpeechRate([0.8]);
    setSpeechPitch([1]);
    setSpeechVolume([1]);
    setVoiceEnabled(true);
    speak('Settings reset to default values');
  };

  const accessibilityFeatures = [
    {
      title: 'High Contrast Mode',
      description: 'Increase visual contrast for better visibility',
      enabled: true
    },
    {
      title: 'Large Text Mode',
      description: 'Increase text size throughout the app',
      enabled: false
    },
    {
      title: 'Vibration Feedback',
      description: 'Feel vibrations for important notifications',
      enabled: true
    },
    {
      title: 'Screen Reader Support',
      description: 'Enhanced compatibility with screen readers',
      enabled: true
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">App Settings</h2>
        <p className="text-gray-300">Customize your accessibility preferences</p>
      </div>

      {/* Voice Settings */}
      <Card className="bg-white/10 border-white/20 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Volume2 className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">Voice Settings</h3>
        </div>

        {/* Voice On/Off */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-white font-medium">Voice Feedback</label>
            <Button
              onClick={toggleVoice}
              className={`${
                voiceEnabled 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : 'bg-gray-500 hover:bg-gray-600'
              } text-white px-4 py-2`}
              onFocus={() => speak(voiceEnabled ? 'Voice feedback is on' : 'Voice feedback is off')}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4 mr-2" /> : <VolumeX className="w-4 h-4 mr-2" />}
              {voiceEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </div>

        {voiceEnabled && (
          <>
            {/* Speech Rate */}
            <div className="mb-6">
              <label className="text-white font-medium mb-2 block">
                Speech Rate: {speechRate[0].toFixed(1)}x
              </label>
              <Slider
                value={speechRate}
                onValueChange={setSpeechRate}
                max={2}
                min={0.1}
                step={0.1}
                className="w-full"
                onFocus={() => speak('Adjust speech rate')}
              />
              <div className="flex justify-between text-gray-400 text-sm mt-1">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>

            {/* Speech Pitch */}
            <div className="mb-6">
              <label className="text-white font-medium mb-2 block">
                Speech Pitch: {speechPitch[0].toFixed(1)}
              </label>
              <Slider
                value={speechPitch}
                onValueChange={setSpeechPitch}
                max={2}
                min={0.1}
                step={0.1}
                className="w-full"
                onFocus={() => speak('Adjust speech pitch')}
              />
              <div className="flex justify-between text-gray-400 text-sm mt-1">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            {/* Speech Volume */}
            <div className="mb-6">
              <label className="text-white font-medium mb-2 block">
                Speech Volume: {Math.round(speechVolume[0] * 100)}%
              </label>
              <Slider
                value={speechVolume}
                onValueChange={setSpeechVolume}
                max={1}
                min={0.1}
                step={0.1}
                className="w-full"
                onFocus={() => speak('Adjust speech volume')}
              />
              <div className="flex justify-between text-gray-400 text-sm mt-1">
                <span>Quiet</span>
                <span>Loud</span>
              </div>
            </div>

            {/* Voice Selection */}
            {availableVoices.length > 0 && (
              <div className="mb-6">
                <label className="text-white font-medium mb-2 block">Voice Selection</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                  onFocus={() => speak('Select voice')}
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.name} value={voice.name} className="bg-gray-800">
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Test Speech Button */}
            <Button
              onClick={testSpeech}
              className="bg-blue-500 hover:bg-blue-600 text-white w-full mb-4"
            >
              <Volume2 className="w-4 h-4 mr-2" />
              Test Voice Settings
            </Button>
          </>
        )}
      </Card>

      {/* Accessibility Features */}
      <Card className="bg-white/10 border-white/20 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Accessibility className="w-6 h-6 text-green-400" />
          <h3 className="text-xl font-semibold text-white">Accessibility Features</h3>
        </div>

        <div className="space-y-4">
          {accessibilityFeatures.map((feature, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div>
                <div className="text-white font-medium">{feature.title}</div>
                <div className="text-gray-300 text-sm">{feature.description}</div>
              </div>
              <Button
                className={`${
                  feature.enabled 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-gray-500 hover:bg-gray-600'
                } text-white px-3 py-1 text-sm`}
                onFocus={() => speak(`${feature.title} is ${feature.enabled ? 'enabled' : 'disabled'}`)}
              >
                {feature.enabled ? 'On' : 'Off'}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* App Information */}
      <Card className="bg-white/10 border-white/20 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Smartphone className="w-6 h-6 text-purple-400" />
          <h3 className="text-xl font-semibold text-white">App Information</h3>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-300">Version:</span>
            <span className="text-white">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Build:</span>
            <span className="text-white">2024.01.15</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Platform:</span>
            <span className="text-white">Web App</span>
          </div>
        </div>
      </Card>

      {/* Reset Settings */}
      <div className="flex justify-center">
        <Button
          onClick={resetSettings}
          className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3"
          onFocus={() => speak('Reset all settings to default')}
        >
          <Settings className="w-5 h-5 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};
