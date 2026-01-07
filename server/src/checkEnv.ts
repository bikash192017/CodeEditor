import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

console.log('=== Environment Variable Check ===');
console.log('Current directory:', process.cwd());
console.log('');

// Check if GEMINI_API_KEY exists
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is NOT set');
    console.error('');
    console.error('Please ensure your .env file contains:');
    console.error('GEMINI_API_KEY=your_actual_api_key_here');
    console.error('');
    console.error('The .env file should be located at:');
    console.error(join(process.cwd(), '.env'));
    process.exit(1);
} else {
    console.log('✅ GEMINI_API_KEY is set');
    console.log('   Length:', apiKey.length, 'characters');
    console.log('   First 10 chars:', apiKey.substring(0, 10) + '...');
    console.log('   Last 5 chars: ...', apiKey.substring(apiKey.length - 5));

    // Validate format (Gemini API keys typically start with "AIza")
    if (apiKey.startsWith('AIza')) {
        console.log('✅ API key format looks correct (starts with AIza)');
    } else {
        console.warn('⚠️  API key does not start with "AIza" - this might not be a valid Gemini API key');
        console.warn('   Expected format: AIzaSy...');
    }
}

console.log('');
console.log('Other environment variables:');
console.log('PORT:', process.env.PORT || 'not set');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'set' : 'not set');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'set' : 'not set');
