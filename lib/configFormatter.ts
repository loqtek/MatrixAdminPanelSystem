import * as yaml from 'js-yaml';
import prettier from 'prettier';

export type ConfigFormat = 'yaml' | 'json' | 'toml' | 'ini' | 'text' | 'conf';

export interface FormatResult {
  formatted: string;
  valid: boolean;
  error?: string;
}

function messageFromUnknown(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
  } catch (error: unknown) {
    return {
      formatted: content,
      valid: false,
      error: messageFromUnknown(error, 'Formatting failed'),
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
  } catch (error: unknown) {
    return {
      valid: false,
      error: messageFromUnknown(error, 'Invalid YAML'),
    };
  }
}

/**
 * Format YAML content
 */
function formatYaml(content: string): FormatResult {
  try {
    const validation = validateYaml(content);
    if (!validation.valid) {
      return {
        formatted: content,
        valid: false,
        error: validation.error,
      };
    }

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
  } catch (error: unknown) {
    return {
      formatted: content,
      valid: false,
      error: messageFromUnknown(error, 'YAML formatting failed'),
    };
  }
}

/**
 * Format JSON content
 */
async function formatJson(content: string): Promise<FormatResult> {
  try {
    const parsed = JSON.parse(content);

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
  } catch (error: unknown) {
    return {
      formatted: content,
      valid: false,
      error: messageFromUnknown(error, 'Invalid JSON'),
    };
  }
}

/**
 * Format TOML content (basic - prettier doesn't support TOML well)
 */
function formatToml(content: string): FormatResult {
  try {
    return {
      formatted: content,
      valid: true,
    };
  } catch (error: unknown) {
    return {
      formatted: content,
      valid: false,
      error: messageFromUnknown(error, 'TOML validation failed'),
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

      if (formatted.length === 0 && !trimmed) continue;

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        if (lastSection && formatted[formatted.length - 1] !== '') {
          formatted.push('');
        }
        formatted.push(trimmed);
        lastSection = trimmed;
        continue;
      }

      if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
        formatted.push(line);
        continue;
      }

      if (trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        const formattedLine = `${key.trim()}=${value.trim()}`;
        formatted.push(formattedLine);
        continue;
      }

      if (!trimmed) {
        if (formatted[formatted.length - 1] !== '') {
          formatted.push('');
        }
        continue;
      }

      formatted.push(line);
    }

    while (formatted.length > 0 && formatted[formatted.length - 1] === '') {
      formatted.pop();
    }

    return {
      formatted: formatted.join('\n'),
      valid: true,
    };
  } catch (error: unknown) {
    return {
      formatted: content,
      valid: false,
      error: messageFromUnknown(error, 'INI formatting failed'),
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
        } catch (error: unknown) {
          return { valid: false, error: messageFromUnknown(error, 'Invalid JSON') };
        }
      case 'toml':
      case 'ini':
      case 'conf':
        return { valid: true };
      default:
        return { valid: true };
    }
  } catch (error: unknown) {
    return {
      valid: false,
      error: messageFromUnknown(error, 'Validation failed'),
    };
  }
}
