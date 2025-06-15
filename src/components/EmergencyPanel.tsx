import { useState } from 'react';
import { Phone, MessageSquare, MapPin, AlertTriangle, Heart, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface EmergencyPanelProps {
  speak: (text: string) => void;
}

export const EmergencyPanel = ({ speak }: EmergencyPanelProps) => {
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);

  const emergencyContacts = [
    {
      id: '911',
      name: 'Emergency Services',
      number: '911',
      icon: AlertTriangle,
      color: 'bg-red-500 hover:bg-red-600',
      description: 'Police, Fire, Medical Emergency'
    },
    {
      id: 'family',
      name: 'Family Contact',
      number: '+1-555-0123',
      icon: Heart,
      color: 'bg-purple-500 hover:bg-purple-600',
      description: 'Primary family emergency contact'
    },
    {
      id: 'friend',
      name: 'Trusted Friend',
      number: '+1-555-0456',
      icon: Shield,
      color: 'bg-blue-500 hover:bg-blue-600',
      description: 'Friend who can provide assistance'
    }
  ];

  const quickActions = [
    {
      id: 'location',
      name: 'Share Location',
      icon: MapPin,
      action: () => shareLocation(),
      color: 'bg-orange-500 hover:bg-orange-600'
    },
    {
      id: 'text',
      name: 'Send Help Text',
      icon: MessageSquare,
      action: () => sendHelpText(),
      color: 'bg-green-500 hover:bg-green-600'
    }
  ];

  // Helper to get contact phone numbers (except 911, which should not be in SMS lists)
  const getSmsContacts = () =>
    emergencyContacts
      .filter((c) => c.id !== "911")
      .map((c) => c.number.replace(/[^+\d]/g, ""))
      .join(",");

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      speak("Location sharing is not supported on this device.");
      toast.error("Location services not supported.");
      return;
    }

    try {
      speak("Acquiring your current location...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const locationUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
          const smsBody = encodeURIComponent(
            `My current location (from Vision Guide): ${locationUrl}`
          );
          const smsRecipients = getSmsContacts();
          const smsLink = `sms:${smsRecipients}?&body=${smsBody}`;

          speak("Your location is ready. Opening the SMS app. Please review and send your message.");
          toast.success(
            "Location acquired. Launching SMS...",
            { description: "Your SMS app will open to complete sending." }
          );

          if (typeof window !== "undefined") {
            window.location.href = smsLink;
          }
        },
        (error) => {
          let msg = "";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              msg = "Location permission denied. Please enable location access in your device settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              msg = "Location unavailable. Please try moving to an area with better GPS signal.";
              break;
            case error.TIMEOUT:
              msg = "Location request timed out. Please try again.";
              break;
            default:
              msg = "Unable to fetch location. Please try again.";
          }
          speak(msg);
          toast.error("Failed to get location", { description: msg });
        },
        { timeout: 10000 }
      );
    } catch (e) {
      speak("Unexpected error occurred during location sharing.");
      toast.error("Unexpected error while getting location.");
    }
  };

  const sendHelpText = () => {
    const helpMessage =
      "I need assistance. This is an automated message from my Vision Guide app. Please contact me or come to my location if possible.";
    const smsBody = encodeURIComponent(helpMessage);
    const smsRecipients = getSmsContacts();
    const smsLink = `sms:${smsRecipients}?&body=${smsBody}`;

    if (!smsRecipients) {
      speak("No contacts are available to send the help message.");
      toast.error("No emergency contacts set up.");
      return;
    }

    // Some browsers or desktops may not support sms: protocol
    try {
      speak("Opening your SMS app with a prefilled help message. Please review and send.");
      toast.success(
        "Help message prepared. Launching SMS...",
        { description: "Your SMS app will open to complete sending." }
      );
      if (typeof window !== "undefined") {
        window.location.href = smsLink;
      }
    } catch (e) {
      speak(
        "Could not open SMS app. Please try sending your help message manually in case of emergency."
      );
      toast.error("Could not launch SMS app. Try manually sending your message.");
    }
  };

  const makeCall = (contact: typeof emergencyContacts[0]) => {
    setSelectedContact(contact.id);
    speak(`Calling ${contact.name} at ${contact.number}`);
    
    // In a real app, this would initiate the call
    if (contact.number === '911') {
      setEmergencyActive(true);
      speak('Emergency call initiated. Stay on the line and speak clearly about your situation.');
    }
    
    // Simulate call
    toast.success(`Calling ${contact.name}...`);
    
    // For demo purposes, we'll use the tel: protocol which may work on mobile
    if (typeof window !== 'undefined') {
      window.location.href = `tel:${contact.number}`;
    }
  };

  const cancelEmergency = () => {
    setEmergencyActive(false);
    setSelectedContact(null);
    speak('Emergency cancelled. You are now in safe mode.');
    toast.info('Emergency mode cancelled');
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Emergency Assistance</h2>
        <p className="text-gray-300">Quick access to help when you need it most</p>
      </div>

      {/* Emergency Status */}
      {emergencyActive && (
        <Card className="bg-red-500/30 border-red-400/50 p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <div>
              <div className="text-red-200 font-bold text-lg">EMERGENCY MODE ACTIVE</div>
              <div className="text-red-300 text-sm">Emergency services contacted</div>
            </div>
          </div>
          <Button
            onClick={cancelEmergency}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white"
          >
            Cancel Emergency
          </Button>
        </Card>
      )}

      {/* Emergency Contacts */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Emergency Contacts</h3>
        <div className="grid grid-cols-1 gap-4">
          {emergencyContacts.map((contact) => {
            const IconComponent = contact.icon;
            return (
              <Button
                key={contact.id}
                onClick={() => makeCall(contact)}
                className={`${contact.color} text-white h-20 text-left p-4 transition-all duration-300 transform hover:scale-105`}
                onFocus={() => speak(`${contact.name}. ${contact.description}`)}
              >
                <div className="flex items-center gap-4 w-full">
                  <IconComponent className="w-8 h-8" />
                  <div className="flex-1">
                    <div className="text-lg font-bold">{contact.name}</div>
                    <div className="text-sm opacity-90">{contact.number}</div>
                    <div className="text-xs opacity-75">{contact.description}</div>
                  </div>
                  <Phone className="w-6 h-6" />
                </div>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <Button
                key={action.id}
                onClick={action.action}
                className={`${action.color} text-white h-16 transition-all duration-300 transform hover:scale-105`}
                onFocus={() => speak(action.name)}
              >
                <IconComponent className="w-6 h-6 mr-3" />
                {action.name}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Safety Information */}
      <Card className="bg-blue-500/20 border-blue-400/30 p-4">
        <h3 className="text-lg font-semibold text-blue-200 mb-3">Emergency Tips:</h3>
        <ul className="text-blue-100 space-y-2 text-sm">
          <li>• Stay calm and speak clearly when calling for help</li>
          <li>• Share your location immediately with emergency services</li>
          <li>• Keep your phone charged and accessible</li>
          <li>• Practice using these emergency features regularly</li>
          <li>• Update emergency contacts information regularly</li>
          <li>• Consider wearing medical alert identification</li>
        </ul>
      </Card>

      {/* Voice Commands for Emergency */}
      <Card className="bg-yellow-500/20 border-yellow-400/30 p-4">
        <h3 className="text-lg font-semibold text-yellow-200 mb-3">Emergency Voice Commands:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="text-yellow-100 text-sm">"Call Emergency" - Dial 911</div>
          <div className="text-yellow-100 text-sm">"Call Family" - Contact family member</div>
          <div className="text-yellow-100 text-sm">"Share Location" - Send GPS coordinates</div>
          <div className="text-yellow-100 text-sm">"Send Help" - Send distress message</div>
        </div>
      </Card>
    </div>
  );
};
