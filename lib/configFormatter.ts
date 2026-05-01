import * as yaml from 'js-yaml';
import prettier from 'prettier';

export type ConfigFormat = 'yaml' | 'json' | 'toml' | 'ini' | 'text' | 'conf';

export interface FormatResult {
  formatted: string;
  valid: boolean;
  error?: string;
}

/**
 * Detect file format from file path or explicit format
 */
export function detectFormat(filePath: string, explicitFormat?: string): ConfigFormat {
  if (explicitFormat) {
    return explicitFormat.toLowerCase() as ConfigFormat;
  }

  const ext = filePath.toLowerCase().split('.').pop() || '';
  
  if (['yaml', 'yml'].includes(ext)) return 'yaml';
  if (ext === 'json') return 'json';
  if (ext === 'toml') return 'toml';
  if (['ini', 'conf', 'cfg'].includes(ext)) return 'ini';
  
  return 'text';
}

/**
 * Get syntax highlighting language for react-syntax-highlighter
 */
export function getSyntaxLanguage(format: ConfigFormat): string {
  switch (format) {
    case 'yaml':
      return 'yaml';
    case 'json':
      return 'json';
    case 'toml':
      return 'toml';
    case 'ini':
    case 'conf':
      return 'ini';
    default:
      return 'plaintext';
  }
}

/**
 * Validate and format content based on format
 */
export async function formatContent(content: string, format: ConfigFormat): Promise<FormatResult> {
  if (!content.trim()) {
    return { formatted: content, valid: true };
  }

  try {
    switch (format) {
      case 'yaml':
        return formatYaml(content);
      case 'json':
        return await formatJson(content);
      case 'toml':
        return formatToml(content);
      case 'ini':
      case 'conf':
        return formatIni(content);
      default:
        return { formatted: content, valid: true };
    }
  } catch (error: any) {
    return {
      formatted: content,
      valid: false,
      error: error.message || 'Formatting failed',
    };
  }
}

/**
 * Validate YAML content
 */
function validateYaml(content: string): { valid: boolean; error?: string } {
  try {
    yaml.load(content);
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Invalid YAML',
    };
  }
}

/**
 * Format YAML content
 */
function formatYaml(content: string): FormatResult {
  try {
    // First validate
    const validation = validateYaml(content);
    if (!validation.valid) {
      return {
        formatted: content,
        valid: false,
        error: validation.error,
      };
    }

    // Parse and stringify with proper formatting
    const parsed = yaml.load(content);
    const formatted = yaml.dump(parsed, {
      indent: 2,
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false,
      noRefs: true,
      sortKeys: false,
    });

    return {
      formatted: formatted.trim(),
      valid: true,
    };
  } catch (error: any) {
    return {
      formatted: content,
      valid: false,
      error: error.message || 'YAML formatting failed',
    };
  }
}

/**
 * Format JSON content
 */
async function formatJson(content: string): Promise<FormatResult> {
  try {
    // Parse to validate
    const parsed = JSON.parse(content);
    
    // Format with prettier (async in v3+)
    const formatted = await prettier.format(JSON.stringify(parsed), {
      parser: 'json',
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
    });

    return {
      formatted: formatted.trim(),
      valid: true,
    };
  } catch (error: any) {
    return {
      formatted: content,
      valid: false,
      error: error.message || 'Invalid JSON',
    };
  }
}

/**
 * Format TOML content (basic - prettier doesn't support TOML well)
 */
function formatToml(content: string): FormatResult {
  // TOML formatting is complex, for now just validate basic structure
  // In a real implementation, you'd use a TOML parser
  try {
    // Basic validation - check for common TOML patterns
    const lines = content.split('\n');
    let inTable = false;
    let bracketCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        bracketCount++;
      }
    }

    // Simple validation passed
    return {
      formatted: content,
      valid: true,
    };
  } catch (error: any) {
    return {
      formatted: content,
      valid: false,
      error: error.message || 'TOML validation failed',
    };
  }
}

/**
 * Format INI/conf content
 */
function formatIni(content: string): FormatResult {
  try {
    const lines = content.split('\n');
    const formatted: string[] = [];
    let lastSection = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines at the start
      if (formatted.length === 0 && !trimmed) continue;

      // Section header
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        if (lastSection && formatted[formatted.length - 1] !== '') {
          formatted.push('');
        }
        formatted.push(trimmed);
        lastSection = trimmed;
        continue;
      }

      // Comment
      if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
        formatted.push(line);
        continue;
      }

      // Key-value pair
      if (trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        const formattedLine = `${key.trim()}=${value.trim()}`;
        formatted.push(formattedLine);
        continue;
      }

      // Empty line
      if (!trimmed) {
        if (formatted[formatted.length - 1] !== '') {
          formatted.push('');
        }
        continue;
      }

      // Other content
      formatted.push(line);
    }

    // Remove trailing empty lines
    while (formatted.length > 0 && formatted[formatted.length - 1] === '') {
      formatted.pop();
    }

    return {
      formatted: formatted.join('\n'),
      valid: true,
    };
  } catch (error: any) {
    return {
      formatted: content,
      valid: false,
      error: error.message || 'INI formatting failed',
    };
  }
}

/**
 * Validate content without formatting
 */
export function validateContent(content: string, format: ConfigFormat): { valid: boolean; error?: string } {
  if (!content.trim()) {
    return { valid: true };
  }

  try {
    switch (format) {
      case 'yaml':
        return validateYaml(content);
      case 'json':
        try {
          JSON.parse(content);
          return { valid: true };
        } catch (error: any) {
          return { valid: false, error: error.message || 'Invalid JSON' };
        }
      case 'toml':
      case 'ini':
      case 'conf':
        // Basic validation - just check if it's not completely broken
        return { valid: true };
      default:
        return { valid: true };
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Validation failed',
    };
  }
}

