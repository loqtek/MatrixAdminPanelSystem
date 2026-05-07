'use client';

import { useEffect, useState, useRef } from 'react';
import { apiClient, Config } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { showToast, formatError } from '@/lib/toast';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  detectFormat, 
  formatContent, 
  validateContent, 
  getSyntaxLanguage,
} from '@/lib/configFormatter';
import { useThemeContext } from '@/components/ThemeProvider';

export default function ConfigPage() {
  const { resolvedTheme } = useThemeContext();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedConfig, setSelectedConfig] = useState<Config | null>(null);
  const [configContent, setConfigContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [cached, setCached] = useState(false);
  const [configFormatError, setConfigFormatError] = useState<string | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const hasAutoLoadedRef = useRef(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  // Auto-load first config when configs are loaded
  useEffect(() => {
    if (configs.length > 0 && !selectedConfig && !loading && !hasAutoLoadedRef.current) {
      hasAutoLoadedRef.current = true;
      loadConfigContent(configs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs.length, loading, selectedConfig]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getConfigs();
      setConfigs(data);
    } catch (err: unknown) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadConfigContent = async (config: Config, forceRefresh = false) => {
    try {
      setSelectedConfig(config);
      setIsEditing(false);
      setConfigContent('Loading...');
      setConfigFormatError(null);
      const data = await apiClient.getConfigContent(config.id, forceRefresh);
      setConfigContent(data.content || '');
      setCached(data.cached || false);
      
      // Validate content on load
      if (data.content) {
        const format = detectFormat(config.file_path, config.file_format);
        const validation = validateContent(data.content, format);
        if (!validation.valid) {
          setConfigFormatError(validation.error || 'Invalid format');
        }
      }
    } catch (err: unknown) {
      showToast.error(formatError(err));
      setConfigContent(`Error: ${formatError(err)}`);
      setCached(false);
      setConfigFormatError(null);
    }
  };

  const handleFormat = async () => {
    if (!selectedConfig || !configContent.trim()) return;
    
    setIsFormatting(true);
    try {
      const format = detectFormat(selectedConfig.file_path, selectedConfig.file_format);
      const result = await formatContent(configContent, format);
      
      if (result.valid) {
        setConfigContent(result.formatted);
        setConfigFormatError(null);
        showToast.success('Content formatted successfully');
      } else {
        setConfigFormatError(result.error || 'Formatting failed');
        showToast.error(result.error || 'Formatting failed');
      }
    } catch (err: unknown) {
      setConfigFormatError(formatError(err));
      showToast.error(formatError(err));
    } finally {
      setIsFormatting(false);
    }
  };

  const handleContentChange = (value: string) => {
    setConfigContent(value);
    
    // Validate on change (debounced)
    if (selectedConfig && value.trim()) {
      const format = detectFormat(selectedConfig.file_path, selectedConfig.file_format);
      const validation = validateContent(value, format);
      if (validation.valid) {
        setConfigFormatError(null);
      } else {
        setConfigFormatError(validation.error || 'Invalid format');
      }
    } else {
      setConfigFormatError(null);
    }
  };

  const handleSave = async () => {
    if (!selectedConfig) return;
    
    // Auto-format before saving if there's no error
    let contentToSave = configContent;
    if (!configFormatError) {
      const format = detectFormat(selectedConfig.file_path, selectedConfig.file_format);
      const result = await formatContent(configContent, format);
      if (result.valid) {
        contentToSave = result.formatted;
      }
    }
    
    try {
      setIsSaving(true);
      await apiClient.updateConfigContent(selectedConfig.id, contentToSave);
      setIsEditing(false);
      await loadConfigContent(selectedConfig, true);
      showToast.success('Config saved successfully');
    } catch (err: unknown) {
      showToast.error(formatError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddConfig = async (configData: { name: string; file_path: string; description?: string; file_format?: string; cache_ttl?: number }) => {
    try {
      await apiClient.createConfig(configData);
      showToast.success('Config created successfully');
      setShowAddModal(false);
      hasAutoLoadedRef.current = false; // Reset to allow auto-loading new configs
      await loadConfigs();
    } catch (err: unknown) {
      showToast.error(formatError(err));
    }
  };

  const handleDelete = async (configId: number) => {
    if (!confirm('Are you sure you want to delete this config?')) return;
    try {
      await apiClient.deleteConfig(configId);
      const wasSelected = selectedConfig?.id === configId;
      if (wasSelected) {
        setSelectedConfig(null);
        setConfigContent('');
      }
      await loadConfigs();
      // If we deleted the selected config and there are still configs, select the first one
      if (wasSelected && configs.length > 1) {
        const remainingConfigs = configs.filter(c => c.id !== configId);
        if (remainingConfigs.length > 0) {
          loadConfigContent(remainingConfigs[0]);
        }
      }
      showToast.success('Config deleted successfully');
    } catch (err: unknown) {
      showToast.error(formatError(err));
    }
  };

  if (loading && configs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      <div className="flex-1 flex flex-col">
        <Header
          title="Config Files"
          actions={
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              + Add Config
            </Button>
          }
        />

        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2">
          {configs.map((config) => (
            <Card
              key={config.id}
              hover
              className={`cursor-pointer transition-all ${
                selectedConfig?.id === config.id
                  ? 'border-[var(--color-border)] outline-none ring-0'
                  : ''
              }`}
              style={
                selectedConfig?.id === config.id
                  ? {
                      backgroundColor:
                        resolvedTheme === 'dark'
                          ? 'color-mix(in srgb, var(--color-surface) 90%, white 10%)'
                          : 'color-mix(in srgb, var(--color-surface) 96%, var(--color-accent) 4%)',
                    }
                  : undefined
              }
              onClick={() => loadConfigContent(config)}
            >
              <CardContent>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--color-foreground)] mb-1">{config.name}</h3>
                    <p className="text-sm text-[var(--color-muted)] mb-2">{config.file_path}</p>
                    {config.description && (
                      <p className="text-sm text-[var(--color-muted)]">{config.description}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="default">{config.file_format || 'text'}</Badge>
                      <Badge variant="default">Cache: {config.cache_ttl || 300}s</Badge>
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(config.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {selectedConfig && (
        <div className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-[var(--color-foreground)]">{selectedConfig.name}</h2>
                <Button variant="ghost" onClick={() => {
                  setSelectedConfig(null);
                  setConfigContent('');
                  setIsEditing(false);
                }}>
                  Close
                </Button>
              </div>
              <p className="text-sm text-[var(--color-muted)] mb-4">{selectedConfig.file_path}</p>
              {configFormatError && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  <strong>Format Error:</strong> {configFormatError}
                </div>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                {cached && <Badge variant="warning">Cached</Badge>}
                {selectedConfig.file_format && (
                  <Badge variant="default">{selectedConfig.file_format.toUpperCase()}</Badge>
                )}
                {!configFormatError && configContent.trim() && (
                  <Badge variant="success">Valid</Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => loadConfigContent(selectedConfig, true)}>
                  Refresh
                </Button>
                {!isEditing ? (
                  <>
                    <Button variant="primary" size="sm" onClick={() => setIsEditing(true)}>
                      Edit
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleFormat}
                      disabled={isFormatting || !configContent.trim()}
                      title="Format code"
                    >
                      {isFormatting ? <LoadingSpinner size="sm" /> : 'Format'}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving || !!configFormatError}
                    >
                      {isSaving ? <LoadingSpinner size="sm" /> : 'Save'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setConfigFormatError(null);
                        loadConfigContent(selectedConfig, true);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {isEditing ? (
                <textarea
                  value={configContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className={`w-full h-full font-mono text-sm bg-surface border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-accent text-[var(--color-foreground)] ${
                    configFormatError 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-border focus:ring-accent'
                  }`}
                  spellCheck={false}
                  style={{ fontFamily: 'monospace', lineHeight: '1.5' }}
                />
              ) : (
                <div className="bg-surface border border-border rounded-lg overflow-hidden h-full">
                  {configContent ? (
                    <SyntaxHighlighter
                      language={getSyntaxLanguage(detectFormat(selectedConfig.file_path, selectedConfig.file_format))}
                      style={resolvedTheme === 'dark' ? vscDarkPlus : oneLight}
                      customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: 'var(--color-surface)',
                        height: '100%',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                      }}
                      showLineNumbers
                      wrapLines
                      wrapLongLines
                    >
                      {configContent}
                    </SyntaxHighlighter>
                  ) : (
                    <div className="p-4 text-[var(--color-muted)] text-sm">No content</div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {showAddModal && (
        <AddConfigModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddConfig}
        />
      )}
    </div>
  );
}

function AddConfigModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: { name: string; file_path: string; description?: string; file_format?: string; cache_ttl?: number }) => void;
}) {
  const [name, setName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [description, setDescription] = useState('');
  const [fileFormat, setFileFormat] = useState('text');
  const [cacheTtl, setCacheTtl] = useState(300);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      name, 
      file_path: filePath, 
      description: description || undefined,
      file_format: fileFormat,
      cache_ttl: cacheTtl
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Add Config File"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Add
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="File Path"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          required
          placeholder="/path/to/config/file"
        />
        <div>
          <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">File Format</label>
          <select
            value={fileFormat}
            onChange={(e) => setFileFormat(e.target.value)}
            className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="text">Text</option>
            <option value="yaml">YAML</option>
            <option value="json">JSON</option>
            <option value="toml">TOML</option>
            <option value="ini">INI</option>
          </select>
        </div>
        <Input
          label="Cache TTL (seconds)"
          type="number"
          value={cacheTtl}
          onChange={(e) => setCacheTtl(parseInt(e.target.value) || 300)}
          min={0}
        />
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </form>
    </Modal>
  );
}
