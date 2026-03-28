import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { VEG_FOOD_IMAGES, NON_VEG_FOOD_IMAGES } from "../constants";

const getApiKey = () => {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

// Helper to pick a consistent image from the pool based on restaurant name
const getAestheticImage = (name: string, diet: string) => {
  const pool = diet === 'veg' ? VEG_FOOD_IMAGES : NON_VEG_FOOD_IMAGES;
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return pool[hash % pool.length];
};

export interface DishSuggestion {
  dishName: string;
  restaurantName: string;
  address?: string;
  rating?: number;
  description: string;
  mapsUrl: string;
  price?: string;
  image?: string;
  diet?: string;
}

export interface FoodDiscoveryResponse {
  explanation: string;
  dishes: DishSuggestion[];
  filters: {
    cuisine?: string;
    diet?: string;
    maxPrice?: number;
    distance?: string;
  };
}

export interface LocationSuggestion {
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

export async function getLocationSuggestions(query: string): Promise<LocationSuggestion[]> {
  if (!query || query.length < 2) return [];

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the top 5 most relevant cities or major areas in India for the query: "${query}". 
      For each location, provide its name, full address, and approximate latitude and longitude.
      
      Format the output as a simple list where each line is:
      NAME | ADDRESS | LAT | LNG`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    const text = response.text || "";
    const lines = text.split('\n').filter(line => line.includes('|'));
    
    const suggestions: LocationSuggestion[] = lines.map(line => {
      const [name, address, lat, lng] = line.split('|').map(s => s.trim());
      return {
        name: name || "Unknown",
        address: address || "",
        lat: parseFloat(lat) || 0,
        lng: parseFloat(lng) || 0
      };
    }).filter(s => s.name !== "Unknown");

    if (suggestions.length > 0) {
      return suggestions.slice(0, 5);
    }

    // Fallback to grounding chunks if text parsing fails or is empty
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return groundingChunks
      .filter((chunk: any) => chunk.maps?.title && chunk.maps?.uri)
      .map((chunk: any) => ({
        name: chunk.maps.title,
        lat: 0,
        lng: 0,
        address: chunk.maps.address
      }))
      .slice(0, 5);
  } catch (error) {
    console.error("Error fetching location suggestions:", error);
    return [];
  }
}

export async function discoverFood(
  query: string, 
  location: { lat: number; lng: number } | null,
  cuisine?: string,
  diet?: 'veg' | 'non-veg'
): Promise<FoodDiscoveryResponse> {
  try {
    const cuisineContext = cuisine ? `Specifically look for ${cuisine} cuisine.` : "";
    const dietContext = diet === 'veg' 
      ? "IMPORTANT: Suggest ONLY vegetarian dishes and restaurants that are either pure veg or have excellent veg options. Avoid any meat or fish suggestions."
      : diet === 'non-veg'
      ? "Suggest a mix of dishes, including non-vegetarian options if available."
      : "";

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the best specific dishes for this query: "${query}". ${cuisineContext} ${dietContext}
      Use Google Maps to find real restaurants near the user's location. 
      Analyze the restaurant data (including reviews and menu snippets) to identify signature or highly-rated dishes that match the user's craving.
      
      Provide a friendly response that:
      1. Explains why these specific dishes match the query.
      2. Mentions the restaurant name and why that dish is special there.
      3. Use Markdown for formatting.
      
      For each restaurant found, suggest ONE specific signature dish name.
      `,
      config: {
        tools: [
          { googleMaps: {} }
        ],
        toolConfig: {
          retrievalConfig: {
            latLng: location ? {
              latitude: location.lat,
              longitude: location.lng
            } : undefined
          }
        },
      },
    });

    const text = response.text || "I couldn't find any specific dish results for your query.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Extract real restaurant data from grounding metadata and try to associate with dishes mentioned in text
    const dishes: DishSuggestion[] = groundingChunks
      .filter((chunk: any) => chunk.maps?.uri)
      .map((chunk: any) => {
        const restaurantName = chunk.maps.title || "Unknown Restaurant";
        // We'll try to find if a specific dish was mentioned in the AI text for this restaurant
        // This is a heuristic since the API doesn't perfectly link chunks to text parts in a simple array
        
        // Generate a descriptive dish name based on the query if we can't find one
        const dishName = query.length < 20 ? query : "Signature Dish";

        // Use the hardcoded aesthetic image pool for high quality and variety
        const image = getAestheticImage(restaurantName, diet);
        
        return {
          dishName: dishName,
          restaurantName: restaurantName,
          mapsUrl: chunk.maps.uri,
          rating: chunk.maps.rating,
          description: `Highly recommended at ${restaurantName}. Check their menu for the best version of ${query}.`,
          price: chunk.maps.priceLevel,
          image: image,
          diet: diet
        };
      });

    return {
      explanation: text,
      dishes,
      filters: {}
    };
  } catch (error) {
    console.error("Error discovering food with Gemini:", error);
    throw error;
  }
}
