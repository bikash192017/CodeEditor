// Test if .env file is being read at all
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');

console.log('=== Direct .env File Test ===\n');
console.log('Expected .env path:', envPath);
console.log('File exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('\nFile size:', content.length, 'bytes');
    console.log('Number of lines:', content.split('\n').length);

    console.log('\n--- Each line (with visible spaces) ---');
    content.split('\n').forEach((line, i) => {
        // Replace spaces with · to make them visible
        const visible = line.replace(/ /g, '·').replace(/\r/g, '<CR>').replace(/\t/g, '<TAB>');
        console.log(`Line ${i + 1}: ${visible}`);
    });

    console.log('\n--- Looking for GEMINI_API_KEY ---');
    const lines = content.split('\n');
    const geminiLine = lines.find(l => l.includes('GEMINI_API_KEY'));

    if (geminiLine) {
        console.log('✅ Found line:', geminiLine);
        console.log('Line length:', geminiLine.length);
        console.log('Has quotes:', geminiLine.includes('"') || geminiLine.includes("'"));
        console.log('Has spaces around =:', geminiLine.includes(' = '));

        // Try to extract the value
        const match = geminiLine.match(/GEMINI_API_KEY=(.+)/);
        if (match) {
            const value = match[1].trim();
            console.log('\nExtracted value:');
            console.log('  Length:', value.length);
            console.log('  Starts with AIza:', value.startsWith('AIza'));
            console.log('  First 15 chars:', value.substring(0, 15));
        }
    } else {
        console.log('❌ GEMINI_API_KEY line not found in file!');
    }
}

console.log('\n--- Testing dotenv ---');
import dotenv from 'dotenv';
const result = dotenv.config();

if (result.error) {
    console.log('❌ dotenv.config() error:', result.error);
} else {
    console.log('✅ dotenv.config() succeeded');
    console.log('Parsed keys:', Object.keys(result.parsed || {}));
}

console.log('\n--- Environment Variable Check ---');
console.log('process.env.GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
if (process.env.GEMINI_API_KEY) {
    console.log('Value length:', process.env.GEMINI_API_KEY.length);
} else {
    console.log('❌ NOT SET IN ENVIRONMENT');
}
