"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { FormEvent } from "react";

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
}: ChatInputProps) {
  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <Input
        value={input}
        onChange={handleInputChange}
        placeholder="Ask about sales data, trends, or request charts..."
        disabled={isLoading}
        className="flex-1 input-enhanced h-12 px-4 text-base rounded-xl border-2 focus-visible:ring-2 focus-visible:ring-offset-0 shadow-sm"
      />
      <Button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="button-enhanced h-12 px-6 rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">Send</span>
      </Button>
    </form>
  );
}
