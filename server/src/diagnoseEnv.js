const fs = require('fs');
const path = require('path');

console.log('=== .env File Diagnostic ===\n');

const envPath = path.join(__dirname, '..', '.env');
console.log('Looking for .env file at:', envPath);

if (!fs.existsSync(envPath)) {
    console.error('❌ .env file does NOT exist!');
    console.log('\nPlease create a .env file at:', envPath);
    process.exit(1);
}

console.log('✅ .env file exists\n');

// Read the file
const envContent = fs.readFileSync(envPath, 'utf8');
console.log('File size:', envContent.length, 'bytes');
console.log('Number of lines:', envContent.split('\n').length);
console.log('\n--- File Content (showing special characters) ---');

// Show each line with special characters visible
const lines = envContent.split('\n');
lines.forEach((line, index) => {
    const lineNum = (index + 1).toString().padStart(2, ' ');
    const visible = line
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/ /g, '·'); // Show spaces as dots

    console.log(`${lineNum}: ${visible}`);
});

console.log('\n--- Parsing Environment Variables ---');

// Try to parse GEMINI_API_KEY
const geminiLine = lines.find(line => line.trim().startsWith('GEMINI_API_KEY'));

if (!geminiLine) {
    console.error('❌ No line starting with GEMINI_API_KEY found!');
} else {
    console.log('✅ Found GEMINI_API_KEY line:', geminiLine);

    // Check for common issues
    const issues = [];

    if (geminiLine.includes('"') || geminiLine.includes("'")) {
        issues.push('⚠️  Line contains quotes - remove them!');
    }

    if (geminiLine.includes(' = ')) {
        issues.push('⚠️  Has spaces around = sign - remove them!');
    }

    if (geminiLine.endsWith(' ') || geminiLine.endsWith('\r')) {
        issues.push('⚠️  Has trailing whitespace - remove it!');
    }

    if (geminiLine.startsWith(' ') || geminiLine.startsWith('\t')) {
        issues.push('⚠️  Has leading whitespace - remove it!');
    }

    const parts = geminiLine.split('=');
    if (parts.length !== 2) {
        issues.push('❌ Invalid format - should be GEMINI_API_KEY=value');
    } else {
        const key = parts[0].trim();
        const value = parts[1].trim();

        console.log('\nParsed:');
        console.log('  Key:', key);
        console.log('  Value length:', value.length, 'characters');
        console.log('  Value starts with:', value.substring(0, 10) + '...');
        console.log('  Value ends with: ...', value.substring(value.length - 5));

        if (!value.startsWith('AIza')) {
            issues.push('⚠️  API key does not start with "AIza" - might be invalid');
        }

        if (value.length < 30) {
            issues.push('⚠️  API key seems too short (expected 39+ characters)');
        }
    }

    if (issues.length > 0) {
        console.log('\n❌ ISSUES FOUND:');
        issues.forEach(issue => console.log('  ' + issue));
    } else {
        console.log('\n✅ Format looks correct!');
    }
}

console.log('\n--- Testing with dotenv ---');
require('dotenv').config();

if (process.env.GEMINI_API_KEY) {
    console.log('✅ dotenv loaded GEMINI_API_KEY successfully');
    console.log('   Length:', process.env.GEMINI_API_KEY.length);
} else {
    console.log('❌ dotenv did NOT load GEMINI_API_KEY');
}
