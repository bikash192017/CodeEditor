import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy initialization - get API key when first needed, not during module import
let genAI: GoogleGenerativeAI | null = null;
let model: any = null;
let apiKeyChecked = false;

function initializeGemini() {
    if (apiKeyChecked) return;
    apiKeyChecked = true;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY is not set in environment variables!');
        console.error('Please add GEMINI_API_KEY to your .env file');
    } else {
        console.log('✅ GEMINI_API_KEY is loaded (length:', apiKey.length, 'characters)');
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    }
}

export const analyzeCode = async (req: Request, res: Response) => {
    // Initialize Gemini on first use
    initializeGemini();

    if (!model) {
        return res.status(500).json({
            success: false,
            message: 'Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file.',
            hasApiKey: false
        });
    }

    try {
        const { code, language } = req.body;

        const prompt = `
            Analyze the following ${language} code and identify any function or variable names that are used but not defined in this file. 
            Return the names as a JSON array of strings in the format: {"missing": [{"name": "varName", "type": "variable"}, {"name": "funcName", "type": "function"}]}. 
            If all functions and variables are defined, return an empty array for "missing".
            
            Code:
            ${code}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from the response text (Gemini might wrap it in markdown)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { missing: [] };

        res.json({ success: true, missing: parsedResult.missing || [] });
    } catch (error: any) {
        console.error('Gemini Analysis Error:', error);

        // Provide more specific error messages
        let errorMessage = 'Failed to analyze code with Gemini';

        if (error.status === 403) {
            errorMessage = !model
                ? 'Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file.'
                : 'Gemini API key is invalid or unauthorized. Please check your API key.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        res.status(error.status || 500).json({
            success: false,
            message: errorMessage,
            hasApiKey: !!model
        });
    }
};
