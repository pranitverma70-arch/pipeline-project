/* eslint-disable */
// @ts-nocheck
"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatAssistant({ token }: { token: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: "user" | "assistant", text: string}[]>([
    { role: "assistant", text: "Hello! I'm your PHI Assistant. How can I help you analyze the pipeline data today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/nl-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ query: userText })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "assistant", text: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: "Sorry, I couldn't process that query." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: "Network error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-2xl transition-transform hover:scale-105 z-50 flex items-center justify-center"
          title="Ask PHI Assistant"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 sm:w-96 h-[500px] bg-card border shadow-2xl rounded-2xl flex flex-col z-50 overflow-hidden print-hide">
          {/* Header */}
          <div className="bg-amber-500 text-white px-4 py-3 flex justify-between items-center shadow-md">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <span className="font-semibold">PHI Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-amber-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div 
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    m.role === "user" 
                      ? "bg-amber-500 text-white rounded-br-sm" 
                      : "bg-white dark:bg-slate-800 border shadow-sm rounded-bl-sm text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-3 bg-card border-t flex gap-2">
            <Input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Ask about pipeline health..." 
              className="flex-1 rounded-full bg-slate-100 dark:bg-slate-800 border-transparent focus-visible:ring-amber-500"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="rounded-full bg-amber-500 hover:bg-amber-600 text-white shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
