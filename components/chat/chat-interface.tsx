"use client";

import { Message } from "./message";
import { ChatInput } from "./chat-input";
import { AnimatedLoading } from "./animated-loading";
import { AnimatedBackground } from "@/components/animated-background";
import { Card } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isGreetingStreaming, setIsGreetingStreaming] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Smooth scroll during streaming (but not during greeting)
  useEffect(() => {
    if (isLoading && !isGreetingStreaming) {
      const scrollInterval = setInterval(scrollToBottom, 100);
      return () => clearInterval(scrollInterval);
    }
  }, [isLoading, isGreetingStreaming]);

  // Add automatic greeting when chat first loads with streaming effect
  useEffect(() => {
    if (!hasGreeted && messages.length === 0) {
      const greetingText = "Hello! I'm your AI Sales Analyst Assistant. I can help you analyze sales data, create visualizations, identify trends, and generate forecasts.\n\nTry asking me:\n- \"Show me sales trends for the last 6 months\"\n- \"What are the top-selling categories?\"\n- \"Show regional sales breakdown as a pie chart\"\n- \"Analyze Electronics sales in North America\"\n\nWhat would you like to know?";

      const greetingId = "initial-greeting";

      // Start with empty message
      setMessages([{
        id: greetingId,
        role: "assistant",
        content: "",
      }]);
      setIsGreetingStreaming(true);

      // Stream the greeting character by character
      let currentIndex = 0;
      const streamGreeting = () => {
        if (currentIndex < greetingText.length) {
          // Add 2-4 characters at a time for smoother streaming
          const charsToAdd = Math.min(3, greetingText.length - currentIndex);
          currentIndex += charsToAdd;

          setMessages([{
            id: greetingId,
            role: "assistant",
            content: greetingText.substring(0, currentIndex),
          }]);

          // Continue streaming with smooth timing (15ms per chunk)
          requestAnimationFrame(() => {
            setTimeout(streamGreeting, 15);
          });
        } else {
          // Streaming complete
          setIsGreetingStreaming(false);
          setHasGreeted(true);
        }
      };

      // Start streaming after a short delay
      setTimeout(streamGreeting, 300);
    }
  }, [hasGreeted, messages.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    const assistantMessageId = (Date.now() + 1).toString();

    // Add user message AND empty assistant message immediately
    const newMessages = [
      ...messages,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant" as const,
        content: "", // Empty content, will show loading animation
      },
    ];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            ...messages,
            userMessage,
          ].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let pendingUpdate = "";
      let isUpdating = false;
      let hasStartedStreaming = false;

      // Smooth update function with throttling
      const updateMessage = () => {
        if (pendingUpdate) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: pendingUpdate }
                : m
            )
          );
        }
        isUpdating = false;
      };

      // Throttled update - only update UI every 30ms for smoothness
      // First update is immediate to show transition from animation
      const scheduleUpdate = (isFirstUpdate = false) => {
        if (isFirstUpdate) {
          // First update happens immediately for smooth transition
          updateMessage();
        } else if (!isUpdating) {
          isUpdating = true;
          requestAnimationFrame(() => {
            setTimeout(updateMessage, 30);
          });
        }
      };

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            // Final update to ensure all content is displayed
            updateMessage();
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("0:")) {
              // Extract content after "0:" prefix
              let content = line.substring(2);

              // Mark that streaming has started (for hiding loading animation)
              if (content.trim() && !hasStartedStreaming) {
                hasStartedStreaming = true;
              }

              // Try to parse as JSON to handle escaped characters
              try {
                content = JSON.parse(content);
              } catch (e) {
                // If parsing fails (incomplete chunk), strip outer quotes and unescape
                if (content.startsWith('"')) {
                  content = content.substring(1);
                }
                if (content.endsWith('"')) {
                  content = content.substring(0, content.length - 1);
                }
                // Unescape patterns - order matters!
                content = content
                  .replace(/\\n/g, '\n')
                  .replace(/\\"/g, '"')
                  .replace(/\\`/g, '`')  // Unescape backticks
                  .replace(/\\\\/g, '\\');
              }

              assistantMessage += content;
              pendingUpdate = assistantMessage;

              // Schedule throttled update
              scheduleUpdate();
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: "Sorry, I encountered an error. Please try again." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatedBackground />
      <div className="flex flex-col h-screen max-w-5xl mx-auto p-4 md:p-6 relative z-10">
        {/* Header */}
        <div className="mb-6 animate-slide-up">
          <h1 className="text-4xl font-bold gradient-text mb-2">AI Sales Analyst</h1>
          <p className="text-muted-foreground text-sm">
            Ask questions about sales data, request forecasts, or create visualizations
          </p>
        </div>

        {/* Messages Container */}
        <Card className="flex-1 overflow-y-auto p-6 space-y-4 mb-4 card-enhanced custom-scrollbar shadow-lg">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                const isLastMessage = index === messages.length - 1;
                const isEmptyAssistantMessage = message.role === "assistant" && !message.content;

                // Show loading animation ONLY when message is empty (before streaming starts)
                const showLoading = isLastMessage && isEmptyAssistantMessage && isLoading && !isGreetingStreaming;

                // Show streaming cursor when message has content AND streaming is active
                const isCurrentlyStreaming = isLastMessage && message.role === "assistant" && isLoading && !!message.content && !isGreetingStreaming;

                // Don't render empty assistant messages during greeting streaming
                if (isEmptyAssistantMessage && isGreetingStreaming) {
                  return null;
                }

                // Show loading animation for empty messages (waiting for stream to start)
                if (isEmptyAssistantMessage && showLoading) {
                  return <AnimatedLoading key={message.id} />;
                }

                // Skip rendering empty messages without loading
                if (isEmptyAssistantMessage) {
                  return null;
                }

                // Render message with streaming cursor if actively streaming
                return (
                  <Message
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    isStreaming={isCurrentlyStreaming}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </Card>

        {/* Input */}
        <div className="animate-fade-in">
          <ChatInput
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>
    </>
  );
}
