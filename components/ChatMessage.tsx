import React from 'react';
import { Message, Sender } from '../types';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.sender === Sender.User;

  return (
    <div className={`flex items-end gap-2 my-2 animate-pop-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex-shrink-0"></div>
      )}
      <div
        className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl flex flex-col ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-gray-700 text-gray-200 rounded-bl-none'
        }`}
      >
        {message.imageUrl && (
            <img 
                src={message.imageUrl} 
                alt="User upload" 
                className="rounded-lg mb-2 max-h-60 w-full object-cover" 
            />
        )}
        {message.text && <p className="text-sm">{message.text}</p>}
      </div>
    </div>
  );
};

export default ChatMessage;
