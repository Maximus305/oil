"use client";

import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Article {
  id: string;
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

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }), // Fix: Should capture latest state
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      setMessages((prev) => [
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
      setMessages((prev) => [
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
        <CardHeader>
          <CardTitle>AI Chat Interface</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div ref={scrollRef} className="space-y-4">
              {messages.map((m) => (
                <div key={m.id} className="p-3 border rounded-lg bg-white shadow-sm">
                  <p className="font-semibold text-gray-700">{m.role === "user" ? "You" : "AI Assistant"}</p>
                  <p className="mt-1 text-gray-900">{m.content}</p>
                  {m.role === "assistant" && m.references && (
                    <div className="mt-2 text-sm text-gray-600">
                      <p className="font-medium">Referenced Articles:</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {m.references.map((ref) => (
                          <Button
                            key={ref.id}
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedArticle((prev) => (prev?.id === ref.id ? null : ref))}
                            className="text-xs"
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
                <div className="p-3 border rounded-lg bg-white shadow-sm text-gray-600">
                  AI is typing...
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter>
          <form onSubmit={handleSubmit} className="flex w-full space-x-2">
            <Input
              value={input}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow"
              disabled={isLoading}
            />
            <Button type="submit" disabled={!input.trim() || isLoading}>
              <Send className="w-5 h-5 text-white" />
            </Button>
          </form>
        </CardFooter>
      </Card>

      {/* Article Sidebar */}
      {selectedArticle && (
        <div className="absolute right-6 top-6 w-[400px] border border-gray-200 bg-white shadow-lg rounded-lg p-4">
          <div className="flex justify-between items-center">
            <h2 className="font-medium">{selectedArticle.title}</h2>
            <Button variant="ghost" size="icon" onClick={() => setSelectedArticle(null)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <ScrollArea className="mt-2 max-h-80 overflow-y-auto">
            <div className="p-2">{selectedArticle.content}</div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
