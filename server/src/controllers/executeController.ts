// ✅ server/src/controllers/executeController.ts

import { Request, Response } from 'express'
import { runCode } from '../utils/codeRunner.js'

// ✅ Controller: Execute Code locally
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

    // ✅ Execute code locally
    const result = await runCode(runtime, code, stdin)

    res.status(200).json({
      success: true,
      output: result.output || '',
      stderr: '',
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
