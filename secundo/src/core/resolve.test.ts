import { describe, it, expect } from 'vitest'
import {
  resolveInterpreter,
  resolveVersion,
  resolveName,
  resolveInterpreterArgs,
  resolveAppId
} from './resolve.js'
import type { ProjectMeta, SecundoSpec } from '../util/types.js'

describe('resolve utilities', () => {
  describe('resolveInterpreter', () => {
    it('should use spec override when provided', () => {
      const spec: SecundoSpec = { interpreter: 'custom-node' }
      const meta: ProjectMeta = {
        packageJson: { name: 'test' },
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveInterpreter(spec, meta)).toBe('custom-node')
    })

    it('should detect ts-node for TypeScript projects with tsconfig', () => {
      const meta: ProjectMeta = {
        tsconfig: true,
        files: [],
        tsFiles: ['index.ts'],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveInterpreter(null, meta)).toBe('ts-node')
    })

    it('should detect node for Node.js projects', () => {
      const meta: ProjectMeta = {
        packageJson: { name: 'test' },
        files: [],
        tsFiles: [],
        jsFiles: ['index.js'],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveInterpreter(null, meta)).toBe('node')
    })

    it('should detect python3 for Python projects', () => {
      const meta: ProjectMeta = {
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: ['main.py'],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveInterpreter(null, meta)).toBe('python3')
    })

    it('should detect ruby for Ruby projects', () => {
      const meta: ProjectMeta = {
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: ['main.rb'],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveInterpreter(null, meta)).toBe('ruby')
    })

    it('should detect /bin/sh for shell scripts', () => {
      const meta: ProjectMeta = {
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: ['script.sh'],
        executableScripts: []
      }
      expect(resolveInterpreter(null, meta)).toBe('/bin/sh')
    })

    it('should throw when no interpreter can be detected', () => {
      const meta: ProjectMeta = {
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(() => resolveInterpreter(null, meta)).toThrow('Could not detect interpreter')
    })
  })

  describe('resolveVersion', () => {
    it('should use spec override when provided', () => {
      const spec: SecundoSpec = { version: '2.0.0' }
      const meta: ProjectMeta = {
        packageJson: { version: '1.0.0' },
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveVersion(spec, meta)).toBe('2.0.0')
    })

    it('should use package.json version', () => {
      const meta: ProjectMeta = {
        packageJson: { version: '1.2.3' },
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveVersion(null, meta)).toBe('1.2.3')
    })

    it('should default to 0.1.0', () => {
      const meta: ProjectMeta = {
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveVersion(null, meta)).toBe('0.1.0')
    })
  })

  describe('resolveName', () => {
    it('should use spec override when provided', () => {
      const spec: SecundoSpec = { name: 'custom-name' }
      const meta: ProjectMeta = {
        packageJson: { name: 'pkg-name' },
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveName(spec, meta, '/path/to/project')).toBe('custom-name')
    })

    it('should use package.json name', () => {
      const meta: ProjectMeta = {
        packageJson: { name: 'my-package' },
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveName(null, meta, '/path/to/project')).toBe('my-package')
    })

    it('should fallback to directory name', () => {
      const meta: ProjectMeta = {
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveName(null, meta, '/path/to/my-project')).toBe('my-project')
    })
  })

  describe('resolveInterpreterArgs', () => {
    it('should use spec args when provided', () => {
      const spec: SecundoSpec = { interpreterArgs: ['--harmony', '--strict'] }
      const meta: ProjectMeta = {
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveInterpreterArgs(spec, meta)).toEqual(['--harmony', '--strict'])
    })

    it('should default to empty array', () => {
      const meta: ProjectMeta = {
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveInterpreterArgs(null, meta)).toEqual([])
    })
  })

  describe('resolveAppId', () => {
    it('should use spec override when provided', () => {
      const spec: SecundoSpec = { appId: 'com.example.app' }
      const meta: ProjectMeta = {
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveAppId(spec, meta, '/path/to/project')).toBe('com.example.app')
    })

    it('should sanitize package.json name', () => {
      const meta: ProjectMeta = {
        packageJson: { name: 'My_Package@123' },
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveAppId(null, meta, '/path/to/project')).toBe('my-package-123')
    })

    it('should generate appId from GitHub remote', () => {
      const meta: ProjectMeta = {
        gitRemote: 'git@github.com:user/repo.git',
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveAppId(null, meta, '/path/to/project')).toBe('com.github.user.repo')
    })

    it('should fallback to directory name with local prefix', () => {
      const meta: ProjectMeta = {
        files: [],
        tsFiles: [],
        jsFiles: [],
        pyFiles: [],
        rbFiles: [],
        shFiles: [],
        executableScripts: []
      }
      expect(resolveAppId(null, meta, '/path/to/my-project')).toBe('local.my-project')
    })
  })
})
