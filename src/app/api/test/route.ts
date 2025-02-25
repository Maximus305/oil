// src/app/api/test/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: "API route is working!" });
}

export async function POST(request: Request) {
  const data = await request.json();
  return NextResponse.json({ 
    message: "POST endpoint is working!", 
    receivedData: data 
  });
}