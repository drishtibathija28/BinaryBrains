import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import './styles.css';

const Chatbot = () => {
  const { isLoggedIn, email, role } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Ollama API configuration
  const OLLAMA_URL = "http://localhost:11434/api/generate";
  const MODEL = "llama3.2"; // Adjust to your model

  // System prompt tailored to your HR website
  const getSystemPrompt = () => {
    let basePrompt = `
      You are an HR assistant for OfficeOwl, a secure HR management system designed for effortless attendance tracking and leave management. 
      Provide helpful, concise, and accurate responses related to HR tasks, such as checking attendance, submitting leave requests, generating reports, or understanding system features. 
      Ensure responses are professional and suitable for both employees and admins. 
      Current date: March 03, 2025.
    `;

    if (isLoggedIn) {
      basePrompt += `
        The user is logged in as ${email} with role '${role}'. 
        Customize responses based on their role: 
        - For employees: Focus on personal attendance, leave requests, and dashboards.
        - For admins: Include options for managing employee data, approving leaves, and system oversight.
      `;
    } else {
      basePrompt += `
        The user is not logged in. Offer general help about OfficeOwl and suggest logging in for personalized assistance.
      `;
    }
    return basePrompt;
  };

  // Handle sending a message with streaming response and tokenized display
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const payload = {
        model: MODEL,
        prompt: `${getSystemPrompt()}\n\nUser: ${input}`,
        max_tokens: 200,
        stream: true,
      };

      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullResponse += parsed.response;
            }
          } catch (jsonError) {
            console.warn('Failed to parse JSON chunk:', jsonError, 'Chunk:', line);
          }
        }
      }

      // Add a placeholder bot message and animate the response
      const botMessageId = Date.now(); // Unique ID for the message
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: '', id: botMessageId, isTyping: true },
      ]);

      // Tokenized display effect
      let currentText = '';
      const typingSpeed = 50; // Milliseconds per character

      for (let i = 0; i < fullResponse.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, typingSpeed));
        currentText = fullResponse.slice(0, i + 1);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, text: currentText }
              : msg
          )
        );
      }

      // Mark typing as complete
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId ? { ...msg, isTyping: false } : msg
        )
      );
    } catch (error) {
      console.warn('Error in chatbot:', error);
      const errorMessage = {
        sender: 'bot',
        text: 'Oops! Something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to the latest message when open
  useEffect(() => {
    if (isOpen) {
      const chatWindow = document.querySelector('.chat-messages');
      if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
    }
  }, [messages, isOpen]);

  // Toggle chatbot visibility
  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="chatbot-wrapper">
      {!isOpen ? (
        <button className="chatbot-toggle-button" onClick={toggleChatbot}>
          <span className="chatbot-logo">OfficeOwl</span>
          <span className="chatbot-label">Chat</span>
        </button>
      ) : (
        <div className="chatbot-container">
          <div className="chat-header">
            <h3>OfficeOwl HR Assistant</h3>
            <button className="chat-close-button" onClick={toggleChatbot}>
              ×
            </button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                Welcome! How can I assist you with OfficeOwl today?
              </div>
            )}
            {messages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`chat-message ${msg.sender} ${msg.isTyping ? 'typing' : ''}`}
              >
                {msg.text}
              </div>
            ))}
          </div>
          <form className="chat-input-form" onSubmit={sendMessage}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? '...' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Chatbot;