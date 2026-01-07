import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

console.log('Testing direct API call to Gemini...\n');
console.log('API Key format check:');
console.log('  Starts with AIza:', apiKey?.startsWith('AIza'));
console.log('  Length:', apiKey?.length);
console.log('\n');

// Try direct HTTPS request to the API
const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log('Fetching available models from API...\n');

https.get(testUrl, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
        console.log('\nResponse Body:');

        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));

            if (parsed.models) {
                console.log('\n✅ Available models:');
                parsed.models.forEach(model => {
                    console.log(`  - ${model.name}`);
                });
            }
        } catch (e) {
            console.log(data);
        }
    });
}).on('error', (err) => {
    console.error('❌ Request error:', err.message);
});
