"use client";

import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { Send, X, BookOpen, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, [messages]);

  // Focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch all articles using the same method as the backend
  const fetchAllArticles = async () => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
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
      // Focus back on input after response
      inputRef.current?.focus();
    }
  };

  // Custom components for ReactMarkdown rendering using proper Components type
  const MarkdownComponents: Components = {
    // Style code blocks with syntax highlighting class
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      // Check if this is an inline code or a code block based on the HTML tag
      const isInline = !(props.node?.tagName === 'pre');
      
      return !isInline ? (
        <pre className={`rounded-lg bg-gray-50 p-4 overflow-x-auto ${match ? `language-${match[1]}` : ''}`}>
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      ) : (
        <code className={`bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-800 ${className || ''}`} {...props}>
          {children}
        </code>
      );
    },
    // Style headings
    h1: ({ children, ...props }) => <h1 className="text-2xl font-medium mt-6 mb-3 text-gray-800" {...props}>{children}</h1>,
    h2: ({ children, ...props }) => <h2 className="text-xl font-medium mt-5 mb-2 text-gray-800" {...props}>{children}</h2>,
    h3: ({ children, ...props }) => <h3 className="text-lg font-medium mt-4 mb-1 text-gray-700" {...props}>{children}</h3>,
    // Style links
    a: ({ children, ...props }) => <a className="text-blue-500 hover:underline transition-colors" {...props}>{children}</a>,
    // Style lists
    ul: ({ children, ...props }) => <ul className="list-disc pl-6 my-3 space-y-1" {...props}>{children}</ul>,
    ol: ({ children, ...props }) => <ol className="list-decimal pl-6 my-3 space-y-1" {...props}>{children}</ol>,
    // Style blockquotes
    blockquote: ({ children, ...props }) => (
      <blockquote className="border-l-2 border-gray-200 pl-4 py-1 my-3 italic text-gray-600" {...props}>
        {children}
      </blockquote>
    ),
    // Style paragraphs
    p: ({children, ...props}) => <p className="my-2 leading-relaxed text-gray-700" {...props}>{children}</p>,
  };

  return (
    <div className="h-screen bg-gradient-to-br from-gray-100 to-green-50 flex flex-col">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-white bg-opacity-80 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-gray-700" />
          <h1 className="text-xl font-medium text-gray-800">Chat</h1>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchAllArticles} 
          className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm rounded-full px-4"
        >
          <BookOpen className="w-4 h-4 mr-2" /> Browse Articles
        </Button>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="max-w-3xl mx-auto py-6 px-4">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <div className="mb-4 flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <MessageSquare className="w-6 h-6 text-gray-500" />
                  </div>
                </div>
                <p className="text-gray-500">Start a conversation...</p>
              </div>
            )}
            
            {messages.map((m) => (
              <div key={m.id} className="mb-6">
                <div className="flex flex-col">
                  <div className="text-xs text-gray-500 mb-1 px-1">
                    {m.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className={`p-4 rounded-xl shadow-sm ${
                    m.role === "user" 
                      ? "bg-white text-gray-800" 
                      : "bg-white text-gray-800"
                  }`}>
                    <div>
                      {m.role === "assistant" ? (
                        <ReactMarkdown components={MarkdownComponents}>
                          {m.content}
                        </ReactMarkdown>
                      ) : (
                        m.content
                      )}
                    </div>
                    
                    {m.role === "assistant" && m.references && m.references.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500 mb-2">
                          Related articles:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {m.references.map((ref) => (
                            <button
                              key={ref.id}
                              onClick={() => setSelectedArticle(ref)}
                              className="px-3 py-1 text-xs bg-gray-50 rounded-full text-gray-700 hover:bg-gray-100 border border-gray-100 transition-colors"
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
                <div className="text-xs text-gray-500 mb-1 px-1">
                  Assistant
                </div>
                <div className="p-4 rounded-xl shadow-sm bg-white">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" style={{ animationDelay: "300ms" }}></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" style={{ animationDelay: "600ms" }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative">
          <div className="relative">
            <div className="bg-white rounded-full shadow-sm border border-gray-100 overflow-hidden">
              <Input 
                ref={inputRef}
                value={input} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)} 
                placeholder="Enter your message..." 
                className="border-0 focus-visible:ring-0 py-6 px-5"
                disabled={isLoading} 
              />
            </div>
            <div className="absolute right-1 top-1.5">
              <Button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="bg-gray-800 hover:bg-gray-700 rounded-full w-10 h-10 flex items-center justify-center shadow-sm"
              >
                <Send className="w-4 h-4 text-white" />
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Articles Sidebar - Only shows when explicitly requested */}
      {showAllArticles && (
        <div className="fixed inset-0 bg-black/10 z-20 flex justify-end backdrop-blur-sm">
          <div className="w-80 h-full bg-white shadow-lg flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-medium text-gray-800">Articles</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAllArticles(false)}
                className="text-gray-500 hover:bg-gray-100 rounded-full w-8 h-8 p-0"
              >
                <X className="w-4 h-4" />
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
                    className="w-full text-left p-3 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
                  >
                    {article.title}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Article Viewer with improved styling */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="font-medium text-gray-800">{selectedArticle.title}</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedArticle(null)}
                className="text-gray-500 hover:bg-gray-100 rounded-full w-8 h-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1 overflow-auto">
              <div className="p-6">
                <article className="prose max-w-none">
                  <ReactMarkdown components={MarkdownComponents}>
                    {selectedArticle.content}
                  </ReactMarkdown>
                </article>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}