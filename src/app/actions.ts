'use server';

import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import fs from 'fs';
import path from 'path';

interface ChatMessage {
  role: string;
  content: string;
}

interface Article {
  title: string;
  content: string;
  publishDate?: string;
  source?: string;
  summary?: string;
  topics?: string[];
  id?: string;
}

export async function processChat(messages: ChatMessage[]) {
  try {
    // File reading and parsing
    const articlesDir = path.join(process.cwd(), 'data', 'articles');
    const filePath = path.join(articlesDir, 'article.json');
    
    if (!fs.existsSync(filePath)) {
      console.error('Articles file not found:', filePath);
      throw new Error('Articles data not found.');
    }

    let articles: Article[] = [];
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);
      
      // Collect articles from all articles_N arrays
      articles = Object.entries(jsonData)
        .filter(([key]) => key.startsWith('articles_'))
        .reduce((acc, [_, value]) => {
          if (Array.isArray(value)) {
            acc.push(...value);
          }
          return acc;
        }, [] as Article[]);

      // Validate articles format
      if (!articles.every(article => 
        article && 
        typeof article === 'object' && 
        typeof article.title === 'string' && 
        typeof article.content === 'string'
      )) {
        throw new Error('Invalid article format in data');
      }

      if (articles.length === 0) {
        throw new Error('No valid articles found.');
      }

    } catch (error) {
      console.error('Error reading or parsing articles:', error);
      throw new Error('Failed to load articles. Please check your JSON structure.');
    }

    // Convert messages to LangChain format
    const langChainMessages: BaseMessage[] = messages.map((msg: ChatMessage) =>
      msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    );

    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0.7,
    });

    // Build articles content string with additional metadata
    const articlesContent = articles
      .map((article: Article) => {
        const { title, content, publishDate, source, summary } = article;
        return `Title: ${title}
${publishDate ? `Date: ${publishDate}` : ''}
${source ? `Source: ${source}` : ''}
${summary ? `Summary: ${summary}` : ''}
Content: ${content.slice(0, 500)}...`;
      })
      .join('\n\n');

    // First prompt for relevance
    const relevancePrompt: BaseMessage[] = [
      new HumanMessage(
        `Here are some articles stored in JSON format. Based on the user's query, return ONLY a valid JSON array of article titles that best match the query. **Do not include any extra text, markdown, or explanations.**
Example valid response:
["Title 1", "Title 2"]
Articles:
${articlesContent}`
      ),
      ...langChainMessages
    ];

    const relevanceResponse = await model.call(relevancePrompt);

    // Parse AI response
    let relevantTitles: string[] = [];
    try {
      const cleanedResponse = (relevanceResponse.content as string)
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      
      // Add square brackets if they're missing
      const jsonString = cleanedResponse.startsWith('[') ? 
        cleanedResponse : 
        `[${cleanedResponse}]`;
      
      relevantTitles = JSON.parse(jsonString);
      
      if (!Array.isArray(relevantTitles)) {
        throw new Error('Response is not an array');
      }
    
      // Validate that all titles exist in the articles
      relevantTitles = relevantTitles.filter(title => 
        articles.some(article => article.title === title)
      );
    
    } catch (error) {
      console.error('Error parsing relevant article titles:', error);
      // Fallback: use all articles if parsing fails
      relevantTitles = articles.map(article => article.title);
    }

    // Filter articles
    const selectedArticles = articles.filter((article: Article) =>
      article.title && relevantTitles.includes(article.title)
    );

    if (selectedArticles.length === 0) {
        console.warn('No relevant articles found, using fallback response.');
        
        // Call the model directly with the user query
        const fallbackPrompt: BaseMessage[] = [
          new HumanMessage(
            `The user is asking a question but we don't have any relevant articles in our database.
            Please provide a helpful, general response based solely on your knowledge.
            
            Be honest that you don't have specific articles on this topic, but try to be as helpful
            as possible with general information.`
          ),
          ...langChainMessages
        ];
        
        const fallbackResponse = await model.call(fallbackPrompt);
        
        return {
          response: fallbackResponse.content,
          references: []
        };
      }
    // Second prompt with selected articles
    const answerPrompt: BaseMessage[] = [
      new HumanMessage(
        `Here are the full texts of the most relevant articles. Use these articles to generate the best response to the user's query. Do NOT include any unrelated text in your response.\n\n${
          selectedArticles
            .map((article: Article) => `Title: ${article.title}
${article.publishDate ? `Date: ${article.publishDate}` : ''}
${article.source ? `Source: ${article.source}` : ''}
${article.summary ? `Summary: ${article.summary}` : ''}
Content: ${article.content}`)
            .join('\n\n')
        }`
      ),
      ...langChainMessages
    ];

    const finalResponse = await model.call(answerPrompt);
    
    // Add IDs to articles if they don't have them
    const referencesWithIds = selectedArticles.map(article => ({
      ...article,
      id: article.id || Math.random().toString(36).substring(2, 15)
    }));

    return {
      response: finalResponse.content,
      references: referencesWithIds
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}