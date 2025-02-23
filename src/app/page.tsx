"use client";

import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Article {
  title: string;
  content: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  references?: Article[];
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, [messages]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: data.response || "Sorry, no response was generated.",
          references: data.references || [],
        },
      ]);
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: "Sorry, I encountered an error processing your request." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-6">
      <Card className="w-full max-w-5xl h-[85vh] flex flex-col">
        <CardHeader className="border-b bg-white">
          <CardTitle className="text-xl text-gray-800">AI Chat Assistant</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden pt-6">
          <ScrollArea className="h-full pr-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((m) => (
                <div 
                  key={m.id} 
                  className={cn(
                    "p-4 rounded-lg",
                    m.role === "user" 
                      ? "bg-blue-50 ml-12" 
                      : "bg-white border border-gray-200 mr-12"
                  )}
                >
                  <p className="font-semibold text-sm text-gray-600 mb-2">
                    {m.role === "user" ? "You" : "AI Assistant"}
                  </p>
                  <p className="text-gray-800 leading-relaxed">{m.content}</p>
                  {m.role === "assistant" && m.references && m.references.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm font-medium text-gray-600 mb-2">Referenced Articles:</p>
                      <div className="flex flex-wrap gap-2">
                        {m.references.map((ref, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedArticle(prev => (prev?.title === ref.title ? null : ref))}
                            className="text-xs hover:bg-gray-50"
                          >
                            {ref.title}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="p-4 rounded-lg bg-white border border-gray-200 mr-12 animate-pulse">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="border-t bg-white p-4">
          <form onSubmit={handleSubmit} className="flex w-full space-x-2">
            <Input 
              value={input} 
              onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)} 
              placeholder="Type your message..." 
              className="flex-grow shadow-sm focus:ring-2 focus:ring-blue-100"
              disabled={isLoading} 
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="shadow-sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>

      {selectedArticle && (
        <div className="fixed right-6 top-6 w-96 border border-gray-200 bg-white shadow-xl rounded-lg">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="font-medium text-gray-800 line-clamp-1">{selectedArticle.title}</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSelectedArticle(null)}
              className="hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="p-4 max-h-[70vh]">
            <div className="text-gray-700 leading-relaxed">
              {selectedArticle.content}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}