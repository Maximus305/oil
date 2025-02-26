"use client";

import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { Send, X, BookOpen } from "lucide-react";
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
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [showAllArticles, setShowAllArticles] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, [messages]);

  // Fetch all articles using the same method as the backend
  const fetchAllArticles = async () => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Fetch all articles" }] }),
      });

      if (!response.ok) throw new Error("Failed to fetch articles");

      const data = await response.json();
      if (!data.articles || data.articles.length === 0) throw new Error("No articles found");

      setAllArticles(data.articles);
      setShowAllArticles(true);
    } catch (error) {
      console.error("Error fetching articles:", error);
    }
  };

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
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-4">
        <h1 className="text-lg">Chat</h1>
        <Button 
          variant="outline" 
          onClick={fetchAllArticles} 
          className="border-gray-300 text-gray-700 hover:bg-gray-100"
        >
          <BookOpen className="w-4 h-4 mr-2" /> Browse Articles
        </Button>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="max-w-3xl mx-auto py-6 px-4">
            {messages.map((m) => (
              <div key={m.id} className="mb-6">
                <div className="flex flex-col">
                  <div className="text-sm text-gray-500 mb-1">
                    {m.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className={`p-3 rounded-md ${
                    m.role === "user" 
                      ? "bg-gray-100" 
                      : "bg-gray-50 border border-gray-200"
                  }`}>
                    <div className="text-gray-800">
                      {m.content}
                    </div>
                    
                    {m.role === "assistant" && m.references && m.references.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <div className="text-sm text-gray-500 mb-2">Related articles:</div>
                        <div className="flex flex-wrap gap-2">
                          {m.references.map((ref) => (
                            <button
                              key={ref.id}
                              onClick={() => setSelectedArticle(ref)}
                              className="px-2 py-1 text-sm bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                            >
                              {ref.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="mb-6">
                <div className="text-sm text-gray-500 mb-1">
                  Assistant
                </div>
                <div className="p-3 rounded-md bg-gray-50 border border-gray-200">
                  <div className="text-gray-400">Typing...</div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
          <Input 
            value={input} 
            onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)} 
            placeholder="Type a message..." 
            className="border-gray-300"
            disabled={isLoading} 
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="bg-gray-800 hover:bg-gray-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* Articles Sidebar - Only shows when explicitly requested */}
      {showAllArticles && (
        <div className="fixed right-0 top-0 h-full shadow-lg border-l border-gray-200 bg-white z-10">
          <div className="w-80 h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-medium">Articles</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAllArticles(false)}
                className="text-gray-500"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {allArticles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => {
                      setSelectedArticle(article);
                      setShowAllArticles(false);
                    }}
                    className="w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 text-gray-700"
                  >
                    {article.title}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Article Viewer with improved scrolling */}
      {selectedArticle && (
        <div className="fixed inset-0 flex items-center justify-center z-20 p-4 pointer-events-none">
          <div className="w-full max-w-2xl bg-white rounded shadow-md border border-gray-200 pointer-events-auto flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-3 border-b border-gray-200 flex-shrink-0">
              <h2 className="font-medium">{selectedArticle.title}</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedArticle(null)}
                className="text-gray-500"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <ScrollArea className="flex-1 overflow-auto">
              <div className="p-4">
                <article className="text-gray-700">
                  {selectedArticle.content}
                </article>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}