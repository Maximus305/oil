import { NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';
import fs from 'fs';
import path from 'path';

interface Article {
  title: string;
  content: string;
  publishDate?: string;
  source?: string;
  summary?: string;
  topics?: string[];
}

interface ChatMessage {
  role: string;
  content: string;
}

export async function POST(req: Request) {
  try {
    const { messages }: { messages: ChatMessage[] } = await req.json();

    // File reading and parsing
    const articlesDir = path.join(process.cwd(), 'data', 'articles');
    const filePath = path.join(articlesDir, 'article.json');
    
    if (!fs.existsSync(filePath)) {
      console.error('Articles file not found:', filePath);
      return NextResponse.json({ error: 'Articles data not found.' }, { status: 404 });
    }

    let articles: Article[] = [];
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);
      
      // Collect articles from all articles_N arrays
      articles = Object.entries(jsonData)
        .filter(([key]) => key.startsWith('articles_'))
        .reduce((acc, [, value]) => {
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
        return NextResponse.json({ error: 'No valid articles found.' }, { status: 404 });
      }

    } catch (error) {
      console.error('Error reading or parsing articles:', error);
      return NextResponse.json({ 
        error: 'Failed to load articles. Please check your JSON structure.' 
      }, { status: 500 });
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

    // First prompt for relevance with explicit system message
    const relevancePrompt: BaseMessage[] = [
      new SystemMessage(
        `You are a helpful assistant that identifies relevant articles based on user queries. 
        Your response must ONLY be a JSON array of article titles, with no additional text. 
        Example valid response: ["Title 1", "Title 2"]`
      ),
      new HumanMessage(
        `Based on the following user query, return ONLY a JSON array of relevant article titles from the provided articles.
        
Articles:
${articlesContent}

Query: ${langChainMessages[langChainMessages.length - 1].content}`
      )
    ];

    const relevanceResponse = await model.call(relevancePrompt);

    // Parse AI response with better error handling
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
      return NextResponse.json({ error: 'No relevant articles found.' }, { status: 404 });
    }

    // Second prompt with selected articles and system message
    const answerPrompt: BaseMessage[] = [
        new SystemMessage(
          `You are a scientific research assistant tasked with answering questions based on provided context. 
          Your goal is to provide accurate, well-reasoned responses drawing primarily from the information given in the context article.`
        ),
        new HumanMessage(
          `<context_article>
      ${selectedArticles
        .map((article: Article) => `Title: ${article.title}
      ${article.publishDate ? `Date: ${article.publishDate}` : ''}
      ${article.source ? `Source: ${article.source}` : ''}
      ${article.summary ? `Summary: ${article.summary}` : ''}
      Content: ${article.content}`)
        .join('\n\n')}
      </context_article>
      
      <user_prompt>
      ${langChainMessages[langChainMessages.length - 1].content}
      </user_prompt>
      
      Your task is to answer this question in a scientifically accurate manner. Follow these steps:
      
      1. Carefully analyze the user's question against the context provided in the article.
      2. Identify key information from the context article that is relevant to the question.
      3. Perform any necessary analysis or reasoning based on the information in the article. This may include:
         - Comparing and contrasting different pieces of information
         - Drawing logical conclusions from the provided data
         - Identifying patterns or trends
         - Evaluating the strength of evidence for different claims
      4. Formulate a clear, concise, and scientifically accurate answer to the user's question.
      
      Important guidelines:
      - Base your response primarily on the information provided in the context article.
      - If the article does not contain sufficient information to fully answer the question, state this clearly and explain what additional information would be needed.
      - Do not introduce external information or speculation beyond what is provided in the context article.
      - If there are multiple interpretations or possibilities based on the given information, explain these clearly.
      - Use scientific terminology appropriately and explain any complex concepts in a way that is accessible to a general audience.
      
      Remember to maintain a neutral, objective tone throughout your response and prioritize scientific accuracy above all else.`
        ),
        ...langChainMessages
      ];
      

    const finalResponse = await model.call(answerPrompt);

    return NextResponse.json({
      response: finalResponse.content,
      references: selectedArticles
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process request.' 
    }, { status: 500 });
  }
}