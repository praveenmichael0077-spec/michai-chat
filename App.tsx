
import React, { useState, useEffect, useRef } from 'react';
import { Message, Sender } from './types';
import { createChatSession } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
// Fix: Removed non-exported member 'SendMessageRequest' from import.
import { Chat } from '@google/genai';

// Fix: Add missing type definitions for the Web Speech API to resolve compilation errors.
interface SpeechRecognitionAlternative {
  readonly transcript: string;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

const EMOJI_LIST = [
  '😀', '😂', '❤️', '👍', '🤔', '🎉', '🤯', '🙏', '🔥', '👋',
  '😊', '😍', '😭', '😎', '😮', '😴', '🙄', '💯', '🚀', '✨'
];

const App: React.FC = () => {
  const [isChatting, setIsChatting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [imageToSend, setImageToSend] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    chatRef.current = createChatSession();
    setMessages([
      {
        id: `initial-${Date.now()}`,
        text: "Hey! What's up? I'm Michai, your friendly AI friend. Send me a pic or ask me anything!",
        sender: Sender.Michai,
      },
    ]);
    
    // Fix: Rename variable from 'SpeechRecognition' to 'SpeechRecognitionAPI' to avoid shadowing the 'SpeechRecognition' type interface.
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setInput(finalTranscript + interimTranscript);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.sender === Sender.Michai) {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(lastMessage.text);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } else {
        console.warn("Text-to-speech is not supported in this browser.");
      }
    }
    
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowEmojiPicker(false);
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if ((!input.trim() && !imageToSend) || isLoading || !chatRef.current) return;

    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random()}`,
      text: input,
      sender: Sender.User,
      imageUrl: imageToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    const currentImage = imageToSend;
    setInput('');
    setImageToSend(null);
    setIsLoading(true);

    try {
      // Fix: Removed type annotation 'SendMessageRequest' as it is not an exported member.
      let payload;
      if (currentImage) {
        const [header, base64Data] = currentImage.split(',');
        const mimeTypeMatch = header.match(/:(.*?);/);
        if (!mimeTypeMatch || !base64Data) {
            throw new Error("Invalid image format");
        }
        const mimeType = mimeTypeMatch[1];
        
        const parts = [];
        if(currentInput.trim()) parts.push({ text: currentInput });
        parts.push({ inlineData: { mimeType, data: base64Data } });

        payload = { message: { parts } };
      } else {
        payload = { message: currentInput };
      }

      const result = await chatRef.current.sendMessage(payload);
      const michaiMessage: Message = {
        id: `michai-${Date.now()}-${Math.random()}`,
        text: result.text,
        sender: Sender.Michai,
      };
      setMessages((prev) => [...prev, michaiMessage]);
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}-${Math.random()}`,
        text: "Whoops, something went sideways. Let's try that again.",
        sender: Sender.Michai,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleListening = () => {
    setShowEmojiPicker(false);
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
    setIsListening(!isListening);
  };
  
  const handleEmojiSelect = (emoji: string) => {
    setInput(prev => prev + emoji);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToSend(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  if (!isChatting) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white font-sans animate-screen-fade-in">
        <div className="text-center p-8">
          <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-green-400 to-blue-500 mx-auto flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-blue-400">Michai Friend</h1>
          <p className="text-lg text-gray-400 mb-8">Your friendly AI companion</p>
          <button
            onClick={() => setIsChatting(true)}
            className="px-8 py-4 bg-gradient-to-r from-green-400 to-blue-500 text-white font-bold rounded-full hover:scale-105 transform transition-transform duration-300 shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            Tap to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-sans animate-screen-fade-in">
      <header className="p-4 border-b border-gray-700 shadow-md">
        <h1 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
          Chat with Michai
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex items-end gap-2 my-2 justify-start animate-pop-in">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex-shrink-0"></div>
              <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl bg-gray-700 text-gray-200 rounded-bl-none">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0s' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="p-4 border-t border-gray-700">
        <div className="max-w-3xl mx-auto relative">
           {imageToSend && (
            <div className="absolute bottom-full left-0 mb-2 p-2 bg-gray-800 rounded-lg shadow-xl animate-pop-in">
                <div className="relative">
                    <img src={imageToSend} alt="Preview" className="h-20 w-20 object-cover rounded-md" />
                    <button 
                        onClick={() => setImageToSend(null)} 
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold"
                        aria-label="Remove image"
                    >
                        &times;
                    </button>
                </div>
            </div>
           )}
          {showEmojiPicker && (
            <div className="absolute bottom-full right-0 mb-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-2 grid grid-cols-5 gap-2 animate-pop-in">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-2xl p-1 rounded-md hover:bg-gray-700 transition-colors"
                  aria-label={`Select emoji ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening..." : "Type your message..."}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              disabled={isLoading}
            />
             <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
             <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full hover:bg-gray-700 flex items-center justify-center transition flex-shrink-0 text-gray-400"
              aria-label="Attach a photo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-10 h-10 rounded-full hover:bg-gray-700 flex items-center justify-center transition flex-shrink-0 text-gray-400"
              aria-label="Toggle emoji picker"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleToggleListening}
              className={`w-10 h-10 rounded-full hover:bg-gray-700 flex items-center justify-center transition flex-shrink-0 ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.75 6.75 0 11-13.5 0v-1.5A.75.75 0 016 10.5z" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && !imageToSend)}
              className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center transition flex-shrink-0 text-white"
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
};

export default App;
