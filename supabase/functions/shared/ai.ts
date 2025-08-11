import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.3";

interface HealthData {
  sleep?: {
    duration: number;
    efficiency: number;
    score: number;
    bedtime: string;
  };
  activity?: {
    type: string;
    duration: number;
    distance: number;
    calories: number;
  }[];
  weather?: {
    temperature: number;
    condition: string;
    humidity: number;
  };
  date: string;
}

export async function generateHealthBriefing(data: HealthData): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({
    apiKey: anthropicKey,
  });

  const prompt = `Generate a personalized daily health briefing based on this data:

**Sleep Data:**
${data.sleep ? `
- Duration: ${Math.round(data.sleep.duration / 3600)} hours ${Math.round((data.sleep.duration % 3600) / 60)} minutes
- Sleep efficiency: ${data.sleep.efficiency}%
- Sleep score: ${data.sleep.score}/100
- Bedtime: ${data.sleep.bedtime}
` : "No sleep data available"}

**Activity Data:**
${data.activity && data.activity.length > 0 ? 
  data.activity.map(a => `- ${a.type}: ${Math.round(a.duration / 60)} minutes, ${Math.round(a.distance / 1000)} km, ${a.calories} calories`).join('\n')
  : "No activity data available"}

**Weather:**
${data.weather ? `
- Temperature: ${data.weather.temperature}°C
- Condition: ${data.weather.condition}
- Humidity: ${data.weather.humidity}%
` : "No weather data available"}

**Date:** ${data.date}

Create a brief, encouraging, and actionable health briefing (2-3 paragraphs) that:
1. Summarizes their sleep and recovery
2. Acknowledges their activity/exercise
3. Provides 1-2 specific recommendations for today
4. Considers weather conditions for outdoor activities
5. Maintains a positive, motivational tone

Keep it conversational and under 200 words.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const briefing = response.content[0]?.type === 'text' ? response.content[0].text : 'Unable to generate briefing';
    return briefing;
  } catch (error) {
    console.error("Error generating AI briefing:", error);
    return "Sorry, I couldn't generate your briefing right now. Please try again later.";
  }
}

export async function generateHealthAdvice(
  question: string,
  userData: {
    sleep: any[];
    activities: any[];
    userQuestion: string;
  }
): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({
    apiKey: anthropicKey,
  });

  const prompt = `You are a knowledgeable health and fitness assistant. Answer this user's question based on their recent data and best practices.

**User Question:** "${question}"

**Recent Sleep Data:**
${userData.sleep.length > 0 ? 
  userData.sleep.map(s => `- ${s.date}: ${Math.round(s.duration / 3600)}h ${Math.round((s.duration % 3600) / 60)}m sleep, ${s.efficiency}% efficiency, score: ${s.score}/100`).join('\n')
  : "No recent sleep data available"}

**Recent Activities:**
${userData.activities.length > 0 ? 
  userData.activities.map(a => `- ${a.date}: ${a.activity_type}, ${Math.round(a.duration / 60)} minutes, ${a.calories} calories`).join('\n')
  : "No recent activity data available"}

Provide a helpful, personalized response that:
1. Directly addresses their question
2. References their actual data when relevant
3. Gives specific, actionable advice
4. Maintains a supportive, encouraging tone
5. Includes safety considerations if needed

Keep the response concise (under 250 words) and conversational.

Important: Always remind users to consult healthcare professionals for medical concerns.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const advice = response.content[0]?.type === 'text' ? response.content[0].text : 'Unable to generate advice';
    return advice + "\n\n_💡 Remember: Always consult healthcare professionals for medical concerns._";
  } catch (error) {
    console.error("Error generating health advice:", error);
    return "Sorry, I couldn't generate personalized advice right now. Please try again later.";
  }
}
