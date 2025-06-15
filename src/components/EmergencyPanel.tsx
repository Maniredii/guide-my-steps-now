
import { useState } from 'react';
import { Phone, MessageSquare, MapPin, AlertTriangle, Heart, Shield, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface EmergencyPanelProps {
  speak: (text: string) => void;
}

export const EmergencyPanel = ({ speak }: EmergencyPanelProps) => {
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [lastLocationUpdate, setLastLocationUpdate] = useState<string>('');

  const emergencyContacts = [
    {
      id: '911',
      name: 'Emergency Services',
      number: '911',
      icon: AlertTriangle,
      color: 'bg-red-500 hover:bg-red-600 focus:bg-red-700',
      description: 'Police, Fire, Medical Emergency - Call immediately for life-threatening situations',
      audioDescription: 'Emergency Services - 9-1-1. Press Enter to call immediately for police, fire, or medical emergencies.'
    },
    {
      id: 'family',
      name: 'Family Contact',
      number: '+1-555-0123',
      icon: Heart,
      color: 'bg-purple-500 hover:bg-purple-600 focus:bg-purple-700',
      description: 'Primary family emergency contact - Your trusted family member',
      audioDescription: 'Family Contact. Press Enter to call your primary family emergency contact at 5-5-5, 0-1-2-3.'
    },
    {
      id: 'friend',
      name: 'Trusted Friend',
      number: '+1-555-0456',
      icon: Shield,
      color: 'bg-blue-500 hover:bg-blue-600 focus:bg-blue-700',
      description: 'Friend who can provide assistance - Your emergency support person',
      audioDescription: 'Trusted Friend. Press Enter to call your emergency support friend at 5-5-5, 0-4-5-6.'
    }
  ];

  const quickActions = [
    {
      id: 'location',
      name: 'Share My Location',
      icon: MapPin,
      action: () => shareLocation(),
      color: 'bg-orange-500 hover:bg-orange-600 focus:bg-orange-700',
      audioDescription: 'Share Location. Press Enter to send your current GPS coordinates to emergency contacts via text message.'
    },
    {
      id: 'text',
      name: 'Send Help Message',
      icon: MessageSquare,
      action: () => sendHelpText(),
      color: 'bg-green-500 hover:bg-green-600 focus:bg-green-700',
      audioDescription: 'Send Help Message. Press Enter to send an automated distress message to your emergency contacts.'
    }
  ];

  // Helper to get contact phone numbers (except 911, which should not be in SMS lists)
  const getSmsContacts = () =>
    emergencyContacts
      .filter((c) => c.id !== "911")
      .map((c) => c.number.replace(/[^+\d]/g, ""))
      .join(",");

  const announceAction = (actionName: string, details: string) => {
    speak(`${actionName}. ${details}. This action will help emergency responders or your contacts locate and assist you.`);
  };

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      const errorMsg = "Location sharing is not supported on this device. Please try using a different device or browser that supports GPS location services.";
      speak(errorMsg);
      toast.error("Location services not supported", { 
        description: "GPS not available on this device" 
      });
      return;
    }

    try {
      announceAction("Sharing Location", "Getting your current GPS position");
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const locationUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
          const timestamp = new Date().toLocaleString();
          const smsBody = encodeURIComponent(
            `EMERGENCY: I need assistance. This is an automated message from my Vision Guide app sent at ${timestamp}. My current location is: ${locationUrl}. Please contact me or come to my location if possible.`
          );
          const smsRecipients = getSmsContacts();
          const smsLink = `sms:${smsRecipients}?&body=${smsBody}`;

          const locationInfo = `Location acquired successfully. Latitude: ${latitude.toFixed(4)}, Longitude: ${longitude.toFixed(4)}`;
          setLastLocationUpdate(locationInfo);
          
          speak(`${locationInfo}. Opening your text messaging app now. Your location with emergency message is ready to send to your contacts. Please review and press send.`);
          
          toast.success("Location Ready to Share", { 
            description: "SMS app opening with location and emergency message",
            duration: 5000
          });

          if (typeof window !== "undefined") {
            window.location.href = smsLink;
          }
        },
        (error) => {
          let errorMsg = "";
          let actionAdvice = "";
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = "Location permission was denied.";
              actionAdvice = "Please go to your browser settings, allow location access for this website, then refresh and try again.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = "Your location could not be determined.";
              actionAdvice = "Please move to an area with better GPS signal, such as near a window or outdoors, then try again.";
              break;
            case error.TIMEOUT:
              errorMsg = "Location request timed out after 10 seconds.";
              actionAdvice = "Please ensure you have a stable internet connection and try again.";
              break;
            default:
              errorMsg = "An unexpected error occurred while getting your location.";
              actionAdvice = "Please try again in a moment, or contact emergency services directly if this is urgent.";
          }
          
          const fullMessage = `${errorMsg} ${actionAdvice}`;
          speak(fullMessage);
          toast.error("Location Error", { 
            description: fullMessage,
            duration: 8000
          });
        },
        { 
          timeout: 15000, 
          enableHighAccuracy: true,
          maximumAge: 60000
        }
      );
    } catch (e) {
      const errorMsg = "An unexpected error occurred during location sharing. Please try contacting emergency services directly if this is urgent.";
      speak(errorMsg);
      toast.error("Location Sharing Failed", { 
        description: errorMsg 
      });
    }
  };

  const sendHelpText = () => {
    const timestamp = new Date().toLocaleString();
    const helpMessage = `EMERGENCY: I need assistance. This is an automated distress message from my Vision Guide app sent at ${timestamp}. Please contact me immediately or come to my location if possible. This message was sent because I may be in a situation where I need help.`;
    const smsBody = encodeURIComponent(helpMessage);
    const smsRecipients = getSmsContacts();
    const smsLink = `sms:${smsRecipients}?&body=${smsBody}`;

    if (!smsRecipients) {
      const noContactsMsg = "No emergency contacts are set up in your system. Please add emergency contact numbers to use this feature, or call emergency services directly.";
      speak(noContactsMsg);
      toast.error("No Emergency Contacts", { 
        description: noContactsMsg 
      });
      return;
    }

    try {
      announceAction("Sending Help Message", "Preparing emergency text message for your contacts");
      
      speak("Opening your text messaging app with a pre-written emergency message. The message explains you need assistance and asks contacts to reach out immediately. Please review the message and press send.");
      
      toast.success("Emergency Message Ready", { 
        description: "SMS app opening with distress message for emergency contacts",
        duration: 5000
      });
      
      if (typeof window !== "undefined") {
        window.location.href = smsLink;
      }
    } catch (e) {
      const errorMsg = "Could not open your text messaging app. Please manually send a message to your emergency contacts, or call them directly if this is urgent.";
      speak(errorMsg);
      toast.error("SMS App Error", { 
        description: errorMsg 
      });
    }
  };

  const makeCall = (contact: typeof emergencyContacts[0]) => {
    setSelectedContact(contact.id);
    
    const callAnnouncement = `Initiating call to ${contact.name} at ${contact.number.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}. ${contact.description}`;
    speak(callAnnouncement);
    
    if (contact.number === '911') {
      setEmergencyActive(true);
      speak('Emergency services call initiated. When connected, stay calm, speak clearly, and provide your location and the nature of your emergency. Do not hang up unless instructed.');
      toast.error("EMERGENCY CALL ACTIVE", { 
        description: "Calling 911 - Stay on the line",
        duration: 10000
      });
    } else {
      toast.success(`Calling ${contact.name}...`, { 
        description: `Dialing ${contact.number}`,
        duration: 5000
      });
    }
    
    if (typeof window !== 'undefined') {
      window.location.href = `tel:${contact.number}`;
    }
  };

  const cancelEmergency = () => {
    setEmergencyActive(false);
    setSelectedContact(null);
    speak('Emergency mode has been cancelled. You are now in normal mode. All emergency features remain available if needed.');
    toast.info('Emergency Mode Cancelled', { 
      description: 'Returned to normal operation' 
    });
  };

  const repeatLastLocation = () => {
    if (lastLocationUpdate) {
      speak(`Last location update: ${lastLocationUpdate}. This was your most recently acquired GPS position.`);
    } else {
      speak("No location has been acquired yet. Use the Share Location button to get your current GPS coordinates.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Emergency Assistance Panel</h2>
        <p className="text-gray-300">Voice-controlled emergency help - All buttons provide audio feedback</p>
      </div>

      {/* Emergency Status */}
      {emergencyActive && (
        <Card className="bg-red-500/30 border-red-400/50 p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <div>
              <div className="text-red-200 font-bold text-lg">EMERGENCY MODE ACTIVE</div>
              <div className="text-red-300 text-sm">Emergency services have been contacted - Stay on the line</div>
            </div>
          </div>
          <Button
            onClick={cancelEmergency}
            className="mt-3 bg-red-600 hover:bg-red-700 focus:bg-red-800 text-white"
            onFocus={() => speak('Cancel Emergency Mode. Press Enter to return to normal operation.')}
          >
            Cancel Emergency
          </Button>
        </Card>
      )}

      {/* Last Location Display */}
      {lastLocationUpdate && (
        <Card className="bg-blue-500/20 border-blue-400/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-200">Last Location Acquired:</h3>
              <p className="text-blue-100 text-sm">{lastLocationUpdate}</p>
            </div>
            <Button
              onClick={repeatLastLocation}
              className="bg-blue-500 hover:bg-blue-600 focus:bg-blue-700 text-white"
              onFocus={() => speak('Repeat Last Location. Press Enter to hear your most recent GPS coordinates.')}
            >
              <Volume2 className="w-4 h-4 mr-2" />
              Repeat
            </Button>
          </div>
        </Card>
      )}

      {/* Emergency Contacts */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Emergency Contacts - Use Arrow Keys to Navigate</h3>
        <div className="grid grid-cols-1 gap-4">
          {emergencyContacts.map((contact) => {
            const IconComponent = contact.icon;
            return (
              <Button
                key={contact.id}
                onClick={() => makeCall(contact)}
                className={`${contact.color} text-white h-24 text-left p-4 transition-all duration-300 focus:ring-4 focus:ring-white/50`}
                onFocus={() => speak(contact.audioDescription)}
                onMouseEnter={() => speak(contact.name)}
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
        <h3 className="text-xl font-semibold text-white">Quick Emergency Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <Button
                key={action.id}
                onClick={action.action}
                className={`${action.color} text-white h-20 transition-all duration-300 focus:ring-4 focus:ring-white/50`}
                onFocus={() => speak(action.audioDescription)}
                onMouseEnter={() => speak(action.name)}
              >
                <IconComponent className="w-6 h-6 mr-3" />
                <span className="text-lg">{action.name}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Safety Information for Blind Users */}
      <Card className="bg-blue-500/20 border-blue-400/30 p-4">
        <h3 className="text-lg font-semibold text-blue-200 mb-3">Emergency Safety Tips for Blind Users:</h3>
        <ul className="text-blue-100 space-y-2 text-sm">
          <li>• When calling 911, immediately state "I am blind" and your location</li>
          <li>• Keep your phone charged and easily accessible at all times</li>
          <li>• Practice using voice commands regularly to build muscle memory</li>
          <li>• Share your location before describing the emergency to save time</li>
          <li>• Keep emergency contact numbers memorized as backup</li>
          <li>• If disoriented, stay where you are and call for help rather than wandering</li>
          <li>• Use landmarks and directional cues when describing your location</li>
        </ul>
      </Card>

      {/* Voice Commands for Emergency */}
      <Card className="bg-yellow-500/20 border-yellow-400/30 p-4">
        <h3 className="text-lg font-semibold text-yellow-200 mb-3">Voice Commands for Emergency Panel:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="text-yellow-100 text-sm">"Hey Vision Call Emergency" - Dial 911 immediately</div>
          <div className="text-yellow-100 text-sm">"Hey Vision Call Family" - Contact family member</div>
          <div className="text-yellow-100 text-sm">"Hey Vision Share Location" - Send GPS coordinates</div>
          <div className="text-yellow-100 text-sm">"Hey Vision Send Help" - Send distress message</div>
          <div className="text-yellow-100 text-sm">"Hey Vision Emergency Status" - Check current mode</div>
          <div className="text-yellow-100 text-sm">"Hey Vision Repeat Location" - Hear last GPS reading</div>
        </div>
      </Card>

      {/* Accessibility Instructions */}
      <Card className="bg-green-500/20 border-green-400/30 p-4">
        <h3 className="text-lg font-semibold text-green-200 mb-3">How to Use This Panel:</h3>
        <ul className="text-green-100 space-y-1 text-sm">
          <li>• Use Tab key to navigate between buttons</li>
          <li>• Press Enter or Space to activate focused button</li>
          <li>• Each button announces its function when focused</li>
          <li>• Voice commands work from anywhere in the app</li>
          <li>• All actions provide clear audio feedback</li>
          <li>• Emergency mode stays active until manually cancelled</li>
        </ul>
      </Card>
    </div>
  );
};
