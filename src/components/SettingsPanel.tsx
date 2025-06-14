
import { useState } from 'react';
import { Settings, Volume2, Gauge, TestTube, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

interface VoiceSettings {
  rate: number;
  pitch: number;
  volume: number;
  enabled: boolean;
}

interface SettingsPanelProps {
  speak: (text: string) => void;
  voiceSettings: VoiceSettings;
  onVoiceSettingsChange: (settings: VoiceSettings) => void;
}

export const SettingsPanel = ({ speak, voiceSettings, onVoiceSettingsChange }: SettingsPanelProps) => {
  const [testMessage] = useState("This is a test of your voice settings. You can adjust the speech rate, pitch, and volume to your preference.");

  const updateSetting = (setting: keyof VoiceSettings, value: number | boolean) => {
    const newSettings = { ...voiceSettings, [setting]: value };
    onVoiceSettingsChange(newSettings);
    
    // Provide immediate feedback
    if (setting === 'rate') {
      speak(`Speech rate set to ${Math.round(value as number * 100)} percent`);
    } else if (setting === 'volume') {
      speak(`Volume set to ${Math.round(value as number * 100)} percent`);
    } else if (setting === 'pitch') {
      speak(`Speech pitch adjusted`);
    }
  };

  const testVoiceSettings = () => {
    speak(testMessage);
  };

  const resetToDefaults = () => {
    const defaultSettings = { rate: 0.8, pitch: 1, volume: 1, enabled: true };
    onVoiceSettingsChange(defaultSettings);
    speak("Voice settings reset to default values");
  };

  const increaseSpeechRate = () => {
    const newRate = Math.min(voiceSettings.rate + 0.1, 2);
    updateSetting('rate', newRate);
  };

  const decreaseSpeechRate = () => {
    const newRate = Math.max(voiceSettings.rate - 0.1, 0.1);
    updateSetting('rate', newRate);
  };

  const increaseVolume = () => {
    const newVolume = Math.min(voiceSettings.volume + 0.1, 1);
    updateSetting('volume', newVolume);
  };

  const decreaseVolume = () => {
    const newVolume = Math.max(voiceSettings.volume - 0.1, 0.1);
    updateSetting('volume', newVolume);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Voice & Accessibility Settings</h2>
        <p className="text-gray-300">Customize your experience with voice commands</p>
      </div>

      {/* Voice Settings */}
      <Card className="bg-white/10 border-white/20 p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Volume2 className="w-6 h-6" />
          Voice Settings
        </h3>

        {/* Speech Rate */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-white font-medium block mb-2">
              Speech Rate: {Math.round(voiceSettings.rate * 100)}%
            </label>
            <Slider
              value={[voiceSettings.rate]}
              onValueChange={(value) => updateSetting('rate', value[0])}
              min={0.1}
              max={2}
              step={0.1}
              className="w-full"
            />
            <div className="flex gap-2 mt-2">
              <Button
                onClick={decreaseSpeechRate}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm"
                onFocus={() => speak('Decrease speech rate')}
              >
                Slower
              </Button>
              <Button
                onClick={increaseSpeechRate}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm"
                onFocus={() => speak('Increase speech rate')}
              >
                Faster
              </Button>
            </div>
          </div>

          {/* Volume */}
          <div>
            <label className="text-white font-medium block mb-2">
              Volume: {Math.round(voiceSettings.volume * 100)}%
            </label>
            <Slider
              value={[voiceSettings.volume]}
              onValueChange={(value) => updateSetting('volume', value[0])}
              min={0.1}
              max={1}
              step={0.1}
              className="w-full"
            />
            <div className="flex gap-2 mt-2">
              <Button
                onClick={decreaseVolume}
                className="bg-green-500 hover:bg-green-600 text-white text-sm"
                onFocus={() => speak('Decrease volume')}
              >
                Quieter
              </Button>
              <Button
                onClick={increaseVolume}
                className="bg-green-500 hover:bg-green-600 text-white text-sm"
                onFocus={() => speak('Increase volume')}
              >
                Louder
              </Button>
            </div>
          </div>

          {/* Pitch */}
          <div>
            <label className="text-white font-medium block mb-2">
              Speech Pitch: {voiceSettings.pitch.toFixed(1)}
            </label>
            <Slider
              value={[voiceSettings.pitch]}
              onValueChange={(value) => updateSetting('pitch', value[0])}
              min={0.5}
              max={2}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={testVoiceSettings}
            className="bg-purple-500 hover:bg-purple-600 text-white flex-1"
            onFocus={() => speak('Test voice settings')}
          >
            <TestTube className="w-4 h-4 mr-2" />
            Test Voice
          </Button>
          <Button
            onClick={resetToDefaults}
            className="bg-orange-500 hover:bg-orange-600 text-white flex-1"
            onFocus={() => speak('Reset to default settings')}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Defaults
          </Button>
        </div>
      </Card>

      {/* Voice Commands for Settings */}
      <Card className="bg-green-500/20 border-green-400/30 p-4">
        <h3 className="text-lg font-semibold text-green-200 mb-3">Settings Voice Commands:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-green-100">
          <div>"Hey Vision Speech Faster" - Increase speech rate</div>
          <div>"Hey Vision Speech Slower" - Decrease speech rate</div>
          <div>"Hey Vision Volume Up" - Increase volume</div>
          <div>"Hey Vision Volume Down" - Decrease volume</div>
          <div>"Hey Vision Test Voice" - Test current settings</div>
          <div>"Hey Vision Reset Settings" - Restore defaults</div>
        </div>
      </Card>

      {/* Accessibility Information */}
      <Card className="bg-blue-500/20 border-blue-400/30 p-4">
        <h3 className="text-lg font-semibold text-blue-200 mb-3">Accessibility Features:</h3>
        <div className="space-y-2 text-blue-100">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            <span>Full voice control - no screen interaction required</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            <span>Continuous voice recognition</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            <span>Adjustable speech rate and volume</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            <span>Audio feedback for all actions</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            <span>Emergency assistance integration</span>
          </div>
        </div>
      </Card>

      {/* Instructions */}
      <Card className="bg-yellow-500/20 border-yellow-400/30 p-4">
        <h3 className="text-lg font-semibold text-yellow-200 mb-3">How to Use Settings:</h3>
        <ul className="text-yellow-100 space-y-1 text-sm">
          <li>• Use voice commands starting with "Hey Vision" to adjust settings</li>
          <li>• Test your voice settings regularly to ensure comfortable listening</li>
          <li>• Adjust speech rate based on your preference and comprehension</li>
          <li>• Set volume appropriate for your environment</li>
          <li>• Reset to defaults if settings become uncomfortable</li>
        </ul>
      </Card>
    </div>
  );
};
