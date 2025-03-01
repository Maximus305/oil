import { NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import {  HumanMessage, BaseMessage } from '@langchain/core/messages';
import fs from 'fs';
import path from 'path';

interface Article {
  id: string;
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
    const userPrompt = messages.find(msg => msg.role === 'user')?.content || '';

    // Fetching articles
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
      
      articles = Object.entries(jsonData)
        .filter(([key]) => key.startsWith('articles_'))
        .reduce((acc, [, value]) => {
          if (Array.isArray(value)) {
            acc.push(...value);
          }
          return acc;
        }, [] as Article[]);

      if (articles.length === 0) {
        return NextResponse.json({ error: 'No valid articles found.' }, { status: 404 });
      }

    } catch (error) {
      console.error('Error reading or parsing articles:', error);
      return NextResponse.json({ error: 'Failed to load articles. Please check JSON structure.' }, { status: 500 });
    }

    // **Return all articles when explicitly requested**
    if (userPrompt.toLowerCase().includes("fetch all articles")) {
      return NextResponse.json({ articles });
    }

    // Convert messages to LangChain format
   

    // AI Query (Find relevant articles)
    const modelFirstCall = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0.7,
    });

    const articlesContent = articles
      .map((article: Article) => `Title: ${article.title}
${article.publishDate ? `Date: ${article.publishDate}` : ''}
${article.source ? `Source: ${article.source}` : ''}
${article.summary ? `Summary: ${article.summary}` : ''}
Content: ${article.content.slice(0, 500)}...`)
      .join('\n\n');

    const relevancePrompt: BaseMessage[] = [
      new HumanMessage(
        `Here are some articles stored in JSON format. Based on the user's query below, return ONLY a valid JSON array of article titles that best match the query. **Do not include any extra text, markdown, or explanations.**
        
        **ALWAYS CHOOSE AT LEAST ONE MATCHING ARTICLE.** If the user's query contains a company or keyword (e.g., "Baker Hughes"), you MUST include the most relevant article for it. 
    
        **User's Query:**
        "${userPrompt}"
    
        **Example Valid Response:**
        ["Title 1", "Title 2"]
    
        **Articles:**
        ${articlesContent}`
      )
    ];

    const relevanceResponse = await modelFirstCall.call(relevancePrompt);
    console.log("GPT-4o First Response:", relevanceResponse.content);

    let relevantTitles: string[] = [];
    try {
      const cleanedResponse = (relevanceResponse.content as string)
        .replace(/```json/g, '') 
        .replace(/```/g, '')
        .trim();

      const jsonMatch = cleanedResponse.match(/\[.*\]/s); 
      if (!jsonMatch) throw new Error('No valid JSON array found in AI response');

      relevantTitles = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(relevantTitles)) throw new Error('Response is not an array');

    } catch (error) {
      console.error('Error parsing relevant article titles:', error);
      return NextResponse.json({ error: 'Invalid AI response format.' }, { status: 500 });
    }

    const selectedArticles = articles.filter(article => relevantTitles.includes(article.title));

    if (selectedArticles.length === 0) {
      console.warn("AI did not find any relevant articles, returning fallback response.");
      return NextResponse.json({
        error: 'No relevant articles found.',
        articlesAvailable: articles.map(a => a.title) 
      }, { status: 404 });
    }

    // **🔄 Second AI Query (Processing with GPT-o1)**
    const modelSecondCall = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'o1', // Second call uses GPT-o1
      temperature: 1,
    });

    const contextArticle = selectedArticles
      .map((article: Article) => `Title: ${article.title}
${article.publishDate ? `Date: ${article.publishDate}` : ''}
${article.source ? `Source: ${article.source}` : ''}
${article.summary ? `Summary: ${article.summary}` : ''}
Content: ${article.content}`)
      .join('\n\n');

    const answerPrompt: BaseMessage[] = [
      new HumanMessage(
        `Use MARKDOWN with things like bold. You are a scientific research assistant tasked with answering questions based on provided context. Your goal is to provide accurate, well-reasoned responses drawing primarily from the information given in the context article.

First, carefully read and analyze the following context article:

<context_article>
${contextArticle}
</context_article>

Now, consider the following question from a user:

<user_prompt>
${userPrompt}
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

Maintain a neutral, objective tone and prioritize scientific accuracy.`
      )
    ];

    const finalResponse = await modelSecondCall.call(answerPrompt);

    return NextResponse.json({
      response: finalResponse.content,
      references: selectedArticles
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to process request.' }, { status: 500 });
  }
}
