"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Brain, Database, Sparkles } from "lucide-react";

const loadingMessages = [
  { text: "Analyzing your sales data", icon: Database },
  { text: "Crunching the numbers", icon: BarChart3 },
  { text: "Identifying trends and patterns", icon: TrendingUp },
  { text: "Applying AI intelligence", icon: Brain },
  { text: "Preparing insights", icon: Sparkles },
];

export function AnimatedLoading() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    // Cycle through messages every 1.8 seconds
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 1800);

    return () => {
      clearInterval(messageInterval);
    };
  }, []);

  const CurrentIcon = loadingMessages[messageIndex].icon;

  return (
    <div className="flex items-center gap-2 p-4">
      {/* Animated Icon - simple pulse */}
      <div className="flex-shrink-0 animate-pulse-icon">
        <CurrentIcon className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Message Text with fade */}
      <span className="text-sm text-muted-foreground animate-text-fade">
        {loadingMessages[messageIndex].text}
      </span>

      {/* Pulsing Dots */}
      <div className="flex gap-1 flex-shrink-0">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
            style={{
              animationDelay: `${i * 0.15}s`,
              animationDuration: "0.6s",
            }}
          ></div>
        ))}
      </div>
    </div>
  );
}
