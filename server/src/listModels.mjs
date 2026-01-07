import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
}

console.log('🔍 Testing different Gemini model names...\n');

const genAI = new GoogleGenerativeAI(apiKey);

async function testModels() {
    // Try common model names
    const modelsToTry = [
        'gemini-pro',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.0-pro',
        'models/gemini-pro',
        'models/gemini-1.5-pro',
        'models/gemini-1.5-flash'
    ];

    for (const modelName of modelsToTry) {
        try {
            console.log(`Testing: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Say hello');
            const response = await result.response;
            const text = response.text();
            console.log(`✅ ${modelName} - WORKS! Response: ${text.substring(0, 50)}...\n`);
            break; // Stop at first working model
        } catch (err) {
            console.log(`❌ ${modelName} - ${err.status || 'ERROR'}: ${err.message?.substring(0, 80)}\n`);
        }
    }
}

testModels().catch(console.error);
