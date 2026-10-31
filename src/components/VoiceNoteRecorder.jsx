/**
 * VoiceNoteRecorder — uses browser Web Speech API for voice notes.
 * Supports en-IN (English India) and hi-IN (Hindi) speech recognition.
 */
import { useState, useEffect, useRef } from 'react';

export default function VoiceNoteRecorder({ onTranscript, initialValue = '' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState('en-IN'); // 'en-IN' | 'hi-IN'
  const [transcript, setTranscript] = useState(initialValue);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsRecording(true);
      setErrorMessage('');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript + ' ';
      }
      finalTranscript = finalTranscript.trim();
      setTranscript(finalTranscript);
      if (onTranscript) {
        onTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions.');
      } else {
        setErrorMessage(`Voice input error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // Ignore stop errors on unmount
      }
    };
  }, [language, onTranscript]);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setErrorMessage('');
      try {
        recognitionRef.current.lang = language;
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Start recognition error:', err);
      }
    }
  };

  const handleClear = () => {
    setTranscript('');
    if (onTranscript) onTranscript('');
  };

  if (!isSupported) {
    return (
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
        🎙️ Voice notes not supported in this browser (use Chrome or Edge). You can type notes directly above.
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">🎙️ Voice Note (Optional)</span>
          {isRecording && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              Recording...
            </span>
          )}
        </div>

        {/* Language selector toggle */}
        <div className="flex items-center bg-gray-200 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setLanguage('en-IN')}
            disabled={isRecording}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              language === 'en-IN'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            English (IN)
          </button>
          <button
            type="button"
            onClick={() => setLanguage('hi-IN')}
            disabled={isRecording}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              language === 'hi-IN'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            हिन्दी (Hindi)
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleRecording}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-white hover:bg-blue-50 text-blue-600 border border-blue-200'
          }`}
        >
          {isRecording ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              Stop Speaking
            </>
          ) : (
            <>
              <span>🎤</span>
              Start Speaking
            </>
          )}
        </button>

        {transcript && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-500 hover:text-red-600 underline"
          >
            Clear voice note
          </button>
        )}
      </div>

      {errorMessage && (
        <p className="mt-2 text-xs text-red-600 font-medium">{errorMessage}</p>
      )}

      {transcript && (
        <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800">
          <p className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">
            Transcribed ({language}):
          </p>
          <p className="italic">"{transcript}"</p>
        </div>
      )}
    </div>
  );
}
