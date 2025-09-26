import { GoogleGenAI } from '@google/genai';

// Note: In production, this should be handled via a backend proxy
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY || API_KEY === 'your_actual_api_key_here') {
  console.error('Gemini API key is missing or invalid. Please set VITE_GEMINI_API_KEY in your .env file.');
}

const genAI = new GoogleGenAI({ apiKey: API_KEY });

export interface GenerationRequest {
  prompt: string;
  referenceImages?: string[]; // base64 array
  temperature?: number;
  seed?: number;
}

export interface EditRequest {
  instruction: string;
  originalImage: string; // base64
  referenceImages?: string[]; // base64 array
  maskImage?: string; // base64
  temperature?: number;
  seed?: number;
}

export interface SegmentationRequest {
  image: string; // base64
  query: string; // "the object at pixel (x,y)" or "the red car"
}

export class GeminiService {
  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const testGenAI = new GoogleGenAI({ apiKey });
      
      // Make a minimal request to test the API key
      const response = await testGenAI.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: [{ text: "Test" }],
      });
      
      return true;
    } catch (error) {
      console.error('API key test failed:', error);
      throw new Error('Invalid API key');
    }
  }

  async generateImage(request: GenerationRequest): Promise<string[]> {
    if (!API_KEY || API_KEY === 'your_actual_api_key_here') {
      throw new Error('Gemini API key is not configured. Please add your API key to the .env file.');
    }

    try {
      const contents: any[] = [{ text: request.prompt }];
      
      // Add reference images if provided
      if (request.referenceImages && request.referenceImages.length > 0) {
        request.referenceImages.forEach(image => {
          contents.push({
            inlineData: {
              mimeType: "image/png",
              data: image,
            },
          });
        });
      }

      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents,
      });

      const images: string[] = [];

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          images.push(part.inlineData.data);
        }
      }

      return images;
    } catch (error) {
      console.error('Error generating image:', error);
      
      // Handle specific API errors with helpful messages
      if (error && typeof error === 'object' && 'error' in error) {
        const apiError = error.error as any;
        
        if (apiError?.code === 429 || apiError?.status === 'RESOURCE_EXHAUSTED') {
          throw new Error('API quota exceeded. Please check your Google AI Studio billing and quota limits, or try again later. For production use, consider implementing a backend proxy to manage API calls.');
        }
        
        if (apiError?.code === 400 || apiError?.status === 'INVALID_ARGUMENT') {
          throw new Error('Invalid API request. Please check your API key configuration and try again.');
        }
        
        if (apiError?.code === 401 || apiError?.status === 'UNAUTHENTICATED') {
          throw new Error('Authentication failed. Please verify your API key is valid and has the necessary permissions.');
        }
      }
      
      throw new Error('Failed to generate image. Please try again.');
    }
  }

  async editImage(request: EditRequest): Promise<string[]> {
    if (!API_KEY || API_KEY === 'your_actual_api_key_here') {
      throw new Error('Gemini API key is not configured. Please add your API key to the .env file.');
    }

    try {
      const contents = [
        { text: this.buildEditPrompt(request) },
        {
          inlineData: {
            mimeType: "image/png",
            data: request.originalImage,
          },
        },
      ];

      // Add reference images if provided
      if (request.referenceImages && request.referenceImages.length > 0) {
        request.referenceImages.forEach(image => {
          contents.push({
            inlineData: {
              mimeType: "image/png",
              data: image,
            },
          });
        });
      }

      if (request.maskImage) {
        contents.push({
          inlineData: {
            mimeType: "image/png",
            data: request.maskImage,
          },
        });
      }

      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents,
      });

      const images: string[] = [];

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          images.push(part.inlineData.data);
        }
      }

      return images;
    } catch (error) {
      console.error('Error editing image:', error);
      
      // Handle specific API errors with helpful messages
      if (error && typeof error === 'object' && 'error' in error) {
        const apiError = error.error as any;
        
        if (apiError?.code === 429 || apiError?.status === 'RESOURCE_EXHAUSTED') {
          throw new Error('API quota exceeded. Please check your Google AI Studio billing and quota limits, or try again later. For production use, consider implementing a backend proxy to manage API calls.');
        }
        
        if (apiError?.code === 400 || apiError?.status === 'INVALID_ARGUMENT') {
          throw new Error('Invalid API request. Please check your API key configuration and try again.');
        }
        
        if (apiError?.code === 401 || apiError?.status === 'UNAUTHENTICATED') {
          throw new Error('Authentication failed. Please verify your API key is valid and has the necessary permissions.');
        }
      }
      
      throw new Error('Failed to edit image. Please try again.');
    }
  }

  async segmentImage(request: SegmentationRequest): Promise<any> {
    if (!API_KEY || API_KEY === 'your_actual_api_key_here') {
      throw new Error('Gemini API key is not configured. Please add your API key to the .env file.');
    }

    try {
      const prompt = [
        { text: `Analyze this image and create a segmentation mask for: ${request.query}

Return a JSON object with this exact structure:
{
  "masks": [
    {
      "label": "description of the segmented object",
      "box_2d": [x, y, width, height],
      "mask": "base64-encoded binary mask image"
    }
  ]
}

Only segment the specific object or region requested. The mask should be a binary PNG where white pixels (255) indicate the selected region and black pixels (0) indicate the background.` },
        {
          inlineData: {
            mimeType: "image/png",
            data: request.image,
          },
        },
      ];

      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: prompt,
      });

      const responseText = response.candidates[0].content.parts[0].text;
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Error segmenting image:', error);
      
      // Handle specific API errors with helpful messages
      if (error && typeof error === 'object' && 'error' in error) {
        const apiError = error.error as any;
        
        if (apiError?.code === 429 || apiError?.status === 'RESOURCE_EXHAUSTED') {
          throw new Error('API quota exceeded. Please check your Google AI Studio billing and quota limits, or try again later. For production use, consider implementing a backend proxy to manage API calls.');
        }
        
        if (apiError?.code === 400 || apiError?.status === 'INVALID_ARGUMENT') {
          throw new Error('Invalid API request. Please check your API key configuration and try again.');
        }
        
        if (apiError?.code === 401 || apiError?.status === 'UNAUTHENTICATED') {
          throw new Error('Authentication failed. Please verify your API key is valid and has the necessary permissions.');
        }
      }
      
      throw new Error('Failed to segment image. Please try again.');
    }
  }

  private buildEditPrompt(request: EditRequest): string {
    const maskInstruction = request.maskImage 
      ? "\n\nIMPORTANT: Apply changes ONLY where the mask image shows white pixels (value 255). Leave all other areas completely unchanged. Respect the mask boundaries precisely and maintain seamless blending at the edges."
      : "";

    return `Edit this image according to the following instruction: ${request.instruction}

Maintain the original image's lighting, perspective, and overall composition. Make the changes look natural and seamlessly integrated.${maskInstruction}

Preserve image quality and ensure the edit looks professional and realistic.`;
  }
}

export const geminiService = new GeminiService();