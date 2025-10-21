import * as fs from 'fs'
import * as path from 'path'
import { StoredAuth } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const AUTH_FILE = path.join(DATA_DIR, 'auth.json')

class Storage {
  constructor() {
    this.ensureDataDir()
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  }

  async getAuth(): Promise<StoredAuth | null> {
    try {
      if (!fs.existsSync(AUTH_FILE)) {
        return null
      }
      const data = fs.readFileSync(AUTH_FILE, 'utf-8')
      return JSON.parse(data) as StoredAuth
    } catch (error) {
      console.error('Failed to read auth file:', error)
      return null
    }
  }

  async saveAuth(auth: StoredAuth): Promise<void> {
    try {
      this.ensureDataDir()
      fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save auth file:', error)
      throw error
    }
  }

  async clearAuth(): Promise<void> {
    try {
      if (fs.existsSync(AUTH_FILE)) {
        fs.unlinkSync(AUTH_FILE)
      }
    } catch (error) {
      console.error('Failed to clear auth file:', error)
      throw error
    }
  }

  async isAuthorized(): Promise<boolean> {
    const auth = await this.getAuth()
    return auth !== null && !!auth.accessToken
  }
}

export const storage = new Storage()
