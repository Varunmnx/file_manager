import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI | undefined | null;
  private model: GenerativeModel | undefined | null;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';

    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY is not configured. AI features will be disabled.');
      this.genAI = null;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      // this.initializeModel();
    }
  }

  private async initializeModel() {
    try {
      // First, list all available models
      this.logger.log('Fetching available models from Google AI...');

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to fetch models: ${error}`);
        this.model = null;
        return;
      }

      const data = await response.json();

      this.logger.log('============ Available Models ============');

      if (!data.models || data.models.length === 0) {
        this.logger.error('No models available with this API key!');
        this.logger.log('==========================================');
        this.model = null;
        return;
      }

      // Find models that support generateContent
      const supportedModels = data.models.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'));

      supportedModels.forEach((m: any) => {
        const modelName = m.name.replace('models/', '');
        this.logger.log(`✅ ${modelName}`);
        this.logger.log(`   Methods: ${m.supportedGenerationMethods?.join(', ')}`);
        if (m.displayName) this.logger.log(`   Display: ${m.displayName}`);
      });

      this.logger.log('==========================================');

      if (supportedModels.length === 0) {
        this.logger.error('No models support generateContent!');
        this.model = null;
        return;
      }

      // Try to use the first available model
      const firstModel = supportedModels[0];
      const modelName = firstModel.name.replace('models/', '');

      this.logger.log(`Attempting to use: ${modelName}`);

      this.model = this.genAI?.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
      });

      // Test it
      const testResult = await this.model?.generateContent('Say OK');
      testResult?.response.text();

      this.logger.log(`✅ Successfully initialized with: ${modelName}`);
    } catch (error) {
      this.logger.error('Error during model initialization:', error);
      this.model = null;
    }
  }

  async generateChangeSummary(oldContent: string, newContent: string, fileName: string): Promise<string> {
    if (!this.model) {
      return '';
    }

    if (!oldContent && !newContent) return '';
    if (oldContent === newContent) return 'No changes detected';

    const prompt = `You are a helpful AI assistant analyzing document changes.

File: ${fileName}

Analyze the differences between the OLD and NEW content below and provide a concise summary (1-3 sentences) of what changed.

OLD CONTENT:
${this.truncateContent(oldContent, 3000)}

NEW CONTENT:
${this.truncateContent(newContent, 3000)}

Summary:`;

    return this.generateContent(prompt, 'change summary');
  }

  async generateFileSummary(content: string, fileName: string): Promise<string> {
    if (!this.model) {
      return '';
    }

    if (!content || content.trim().length === 0) return '';

    const prompt = `Provide a brief summary (2-3 sentences) of this document.

File: ${fileName}

CONTENT:
${this.truncateContent(content, 5000)}

Summary:`;

    return this.generateContent(prompt, 'file summary');
  }

  private truncateContent(content: string, maxLength: number): string {
    if (!content) return '';

    if (content.length <= maxLength) {
      return content;
    }

    return content.slice(0, maxLength) + '\n... (truncated)';
  }

  private lastCallTime = 0;
  private readonly MIN_INTERVAL_MS = 6000; // 6 seconds between calls

  private async generateContent(prompt: string, type: string): Promise<string> {
    if (!this.model) {
      return '';
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    if (timeSinceLastCall < this.MIN_INTERVAL_MS) {
      const waitTime = this.MIN_INTERVAL_MS - timeSinceLastCall;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastCallTime = Date.now();

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        return '';
      }

      this.logger.debug(`Generated ${type}`);
      return text.trim();
    } catch (error) {
      this.logger.error(`Error generating ${type}:`, error.message);
      return '';
    }
  }
}
