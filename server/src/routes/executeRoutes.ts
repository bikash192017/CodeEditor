import express from 'express'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { ExecutionHistory } from '../models/ExecutionHistory.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

/**
 * @route   POST /api/execute
 * @desc    Execute code using Piston API (does NOT auto-save)
 * @access  Private
 */
router.post('/', protect, async (req, res) => {
  try {
    const { language, code, stdin, roomId } = req.body

    if (!language || !code) {
      return res.status(400).json({
        success: false,
        message: 'Language and code are required',
      })
    }

    // ✅ Language and version map for Piston API
    const langMap: Record<string, string> = {
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
    }

    const versionMap: Record<string, string> = {
      javascript: '18.15.0',
      typescript: '5.0.3',
      python: '3.10.0',
      java: '15.0.2',
      cpp: '10.2.0',
      c: '10.2.0',
    }

    const runtime = langMap[language] || 'python'
    const version = versionMap[runtime]

    // ✅ Correct file naming for Piston
    const fileName =
      runtime === 'java'
        ? 'Main.java'
        : runtime === 'cpp'
        ? 'main.cpp'
        : runtime === 'c'
        ? 'main.c'
        : runtime === 'typescript'
        ? 'main.ts'
        : 'main.js'

    const EXECUTION_API = 'https://emkc.org/api/v2/piston/execute'

    // ✅ Execute code through Piston
    const response = await axios.post(EXECUTION_API, {
      language: runtime,
      version,
      files: [{ name: fileName, content: code }],
      stdin: stdin || '',
    })

    const result = response.data
    const output = result.run?.output?.trim() || ''
    const stderr = result.run?.stderr?.trim() || ''
    const time = result.run?.time || null

    // ✅ Return result only (no DB save)
    res.status(200).json({
      success: true,
      message: 'Code executed successfully',
      data: {
        output: output || stderr || 'No output received.',
        stderr,
        time,
      },
    })
  } catch (error: any) {
    console.error('❌ Execution Error:', error.response?.data || error.message)
    res.status(500).json({
      success: false,
      message:
        error.response?.data?.message ||
        error.message ||
        'Code execution failed',
    })
  }
})

/**
 * @route   POST /api/execute/save
 * @desc    Save executed code to file + database (only on confirmation)
 * @access  Private
 */
router.post('/save', protect, async (req, res) => {
  try {
    const { language, code, output, roomId } = req.body

    if (!language || !code) {
      return res.status(400).json({
        success: false,
        message: 'Language and code are required',
      })
    }

    // ✅ Extension mapping
    const extMap: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
    }

    const extension = extMap[language] || 'txt'

    // ✅ Directory setup
    const dir = path.resolve('./executions')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir)

    const fileName = `run_${Date.now()}.${extension}`
    const filePath = path.join(dir, fileName)

    // ✅ Write to local file
    fs.writeFileSync(filePath, code, 'utf-8')

    // ✅ Save metadata in MongoDB
    const savedRun = await ExecutionHistory.create({
      userId: req.user?.id || null,
      roomId: roomId || null,
      language,
      code,
      output,
      filePath,
    })

    res.status(201).json({
      success: true,
      message: 'Execution saved successfully as file',
      data: savedRun,
    })
  } catch (error: any) {
    console.error('❌ Save Error:', error.message)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save execution',
    })
  }
})

/**
 * @route   GET /api/execute/history
 * @desc    Fetch saved executions (if user saved them)
 * @access  Private
 */
router.get('/history', protect, async (req, res) => {
  try {
    const history = await ExecutionHistory.find({ userId: req.user?.id })
      .sort({ createdAt: -1 })
      .limit(20)

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch execution history',
    })
  }
})

/**
 * @route   GET /api/execute/history/:roomId
 * @desc    Get all saved executions in a specific room
 * @access  Private
 */
router.get('/history/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params
    const history = await ExecutionHistory.find({ roomId })
      .sort({ createdAt: -1 })
      .limit(50)

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch room execution history',
    })
  }
})

/**
 * @route   DELETE /api/execute/history
 * @desc    Clear all saved executions for a user
 * @access  Private
 */
router.delete('/history', protect, async (req, res) => {
  try {
    await ExecutionHistory.deleteMany({ userId: req.user?.id })
    res.status(200).json({
      success: true,
      message: 'Saved executions cleared successfully',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to clear execution history',
    })
  }
})
/**
 * @route   DELETE /api/execute/history/:id
 * @desc    Delete a specific saved execution by ID
 * @access  Private
 */
router.delete('/history/:id', protect, async (req, res) => {
  try {
    const { id } = req.params
    const result = await ExecutionHistory.findOneAndDelete({
      _id: id,
      userId: req.user?.id,
    })

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'File not found or unauthorized',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Execution file deleted successfully',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete execution file',
    })
  }
})

export default router
