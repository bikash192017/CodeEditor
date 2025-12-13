// ✅ server/src/controllers/executeController.ts

import { Request, Response } from 'express'
import axios from 'axios'

// ✅ Controller: Execute Code via Piston API
export const executeCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { language, code, stdin } = req.body

    if (!language || !code) {
      res.status(400).json({ success: false, message: 'Language and code are required' })
      return
    }

    // ✅ Map supported languages for Piston API
    const langMap: Record<string, string> = {
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
    }

    const runtime = langMap[language] || 'python'

    // ✅ Define runtime versions
    const versionMap: Record<string, string> = {
      javascript: '18.15.0',
      typescript: '5.0.3',
      python: '3.10.0',
      java: '15.0.2',
      cpp: '10.2.0',
      c: '10.2.0',
    }

    const version = versionMap[runtime]

    // ✅ Execute code via Piston public API
    const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
      language: runtime,
      version,
      files: [{ name: `Main.${runtime}`, content: code }],
      stdin: stdin || '',
    })

    const output = response.data.run.output || ''
    const stderr = response.data.run.stderr || ''

    res.status(200).json({
      success: true,
      output,
      stderr,
    })
  } catch (error: any) {
    console.error('❌ Code execution error:', error.message)
    res.status(500).json({
      success: false,
      message: 'Failed to execute code',
      error: error.message,
    })
  }
}
