import { useEffect, useRef } from 'react';

export function usePageGreeting(text) {
  const hasSpoken = useRef(false);

  useEffect(() => {
    hasSpoken.current = false;

    const setVoiceAndSpeak = (voices, utterance) => {
      if (hasSpoken.current) return;
      
      let selectedVoice = voices.find(voice => 
        voice.lang.includes('en-IN') && 
        (voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('veena'))
      );
      
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          voice.name.toLowerCase().includes('female') || 
          voice.name.toLowerCase().includes('samantha') || 
          voice.name.toLowerCase().includes('victoria') || 
          voice.name.toLowerCase().includes('karen') ||
          voice.name.toLowerCase().includes('zira') ||
          voice.name.toLowerCase().includes('moira') ||
          voice.name.toLowerCase().includes('google uk english female')
        );
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.pitch = 1.1; // Slightly higher but natural
      utterance.rate = 1.0; // Normal speaking rate so it doesn't sound forced
      
      hasSpoken.current = true;
      window.speechSynthesis.speak(utterance);
    };

    const speak = () => {
      if (hasSpoken.current || !('speechSynthesis' in window)) return;
      
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        let voices = window.speechSynthesis.getVoices();
        
        if (voices.length === 0) {
          const onVoicesChanged = () => {
            voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                setVoiceAndSpeak(voices, utterance);
                window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
            }
          };
          window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
          
          setTimeout(() => {
             if (!hasSpoken.current) {
                voices = window.speechSynthesis.getVoices();
                setVoiceAndSpeak(voices, utterance);
             }
          }, 1000);
          return;
        }

        setVoiceAndSpeak(voices, utterance);
      } catch (err) {
        console.error('Speech playback failed:', err);
      }
    };

    const timer = setTimeout(speak, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [text]);
}
