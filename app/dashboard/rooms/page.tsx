'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { apiClient, MatrixRoom, MatrixRoomEvent, MatrixRoomMessagesResponse, RoomAdminDetails } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { showToast, formatError } from '@/lib/toast';
import DOMPurify from 'dompurify';

function safeFormattedHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function strVal(v: unknown, fallback = ''): string {
  if (v === undefined || v === null || v === '') return fallback;
  return String(v);
}

function safeMediaUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (/^https?:\/\//i.test(u) || /^mxc:\/\//i.test(u)) return u;
  return undefined;
}

function formatEncryptionAlgorithm(algorithm?: string): string {
  if (!algorithm) return 'Unknown algorithm';
  if (algorithm === 'm.megolm.v1.aes-sha2') return 'Megolm (m.megolm.v1.aes-sha2)';
  if (algorithm === 'm.olm.v1.curve25519-aes-sha2') return 'Olm (m.olm.v1.curve25519-aes-sha2)';
  return algorithm;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<MatrixRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomDetails, setRoomDetails] = useState<RoomAdminDetails | null>(null);
  const [roomMessages, setRoomMessages] = useState<MatrixRoomMessagesResponse | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showMessageMetadata, setShowMessageMetadata] = useState(false);

  const getEventTypeVariant = (eventType: string): 'default' | 'primary' | 'accent' | 'warning' => {
    if (eventType === 'm.room.message') return 'primary';
    if (eventType.startsWith('m.room.member')) return 'accent';
    if (eventType.startsWith('m.room.')) return 'warning';
    return 'default';
  };

  const formatMessagePreview = (event: MatrixRoomEvent): string => {
    if (event.type !== 'm.room.message') {
      const content = event.content ?? {};
      const target = strVal(event.state_key) || strVal(content.target_user_id);

      if (event.type === 'm.room.member') {
        const membership = strVal(content.membership, 'unknown');
        const displayName = content.displayname ? ` (${strVal(content.displayname)})` : '';
        return `${membership.toUpperCase()}: ${target || 'unknown user'}${displayName}`;
      }

      if (event.type === 'm.room.name') {
        return `Room name changed to: ${strVal(content.name, '(empty)')}`;
      }

      if (event.type === 'm.room.topic') {
        return `Topic updated: ${strVal(content.topic, '(empty)')}`;
      }

      if (event.type === 'm.room.join_rules') {
        return `Join rule: ${strVal(content.join_rule, 'unspecified')}`;
      }

      if (event.type === 'm.room.history_visibility') {
        return `History visibility: ${strVal(content.history_visibility, 'unspecified')}`;
      }

      if (event.type === 'm.room.guest_access') {
        return `Guest access: ${strVal(content.guest_access, 'unspecified')}`;
      }

      if (event.type === 'm.room.avatar') {
        return content.url ? 'Room avatar updated' : 'Room avatar removed';
      }

      if (event.type === 'm.room.encryption') {
        return `Encryption enabled (${strVal(content.algorithm, 'algorithm unknown')})`;
      }

      if (event.type === 'm.room.encrypted') {
        const alg = typeof content.algorithm === 'string' ? content.algorithm : undefined;
        return `Encrypted message (${formatEncryptionAlgorithm(alg)})`;
      }

      if (event.type === 'm.room.power_levels') {
        return 'Power levels updated';
      }

      if (event.type === 'm.room.redaction') {
        return `Event redacted: ${event.redacts || 'unknown event'}`;
      }

      if (event.type === 'm.reaction') {
        const relates = content['m.relates_to'];
        const key =
          relates &&
          typeof relates === 'object' &&
          relates !== null &&
          'key' in relates
            ? strVal((relates as { key?: unknown }).key)
            : '';
        return key ? `Reaction added: ${key}` : 'Reaction added';
      }

      if (event.type === 'm.room.create') {
        return `Room created${content.creator ? ` by ${strVal(content.creator)}` : ''}`;
      }

      const keys = Object.keys(content);
      if (keys.length === 0) return 'No event content';

      const compact = JSON.stringify(content);
      return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
    }

    const ec = event.content;
    const msgType = typeof ec?.msgtype === 'string' ? ec.msgtype : undefined;
    if (msgType === 'm.image') return strVal(ec?.body, 'Image');
    if (msgType === 'm.file')
      return `File: ${strVal(ec?.body) || strVal(ec?.filename) || 'Unknown file'}`;
    if (msgType === 'm.notice') return strVal(ec?.body, 'Notice');
    if (msgType === 'm.emote') return strVal(ec?.body, 'Emote');
    return strVal(ec?.body, '(empty message)');
  };

  const loadRooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getRooms(currentPage * pageSize, pageSize);
      setRooms(response.rooms || []);
      setTotal(response.total || 0);
    } catch (err: unknown) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const filteredRooms = useMemo(() => {
    if (!searchTerm) return rooms;
    const term = searchTerm.toLowerCase();
    return rooms.filter((room) =>
      room.room_id.toLowerCase().includes(term) ||
      room.name?.toLowerCase().includes(term) ||
      room.canonical_alias?.toLowerCase().includes(term)
    );
  }, [rooms, searchTerm]);

  const totalPages = Math.ceil(total / pageSize);

  const handleDelete = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room? This action cannot be undone.')) return;
    try {
      await apiClient.deleteRoom(roomId);
      showToast.success('Room deleted successfully');
      loadRooms();
    } catch (err: unknown) {
      showToast.error(formatError(err));
    }
  };

  const handleShowDetails = async (roomId: string) => {
    setSelectedRoomId(roomId);
    setLoadingDetails(true);
    setShowDetailsModal(true);
    try {
      const details = await apiClient.getRoomDetails(roomId);
      setRoomDetails(details);
    } catch (err: unknown) {
      showToast.error(formatError(err));
      setShowDetailsModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleShowMessages = async (roomId: string) => {
    setSelectedRoomId(roomId);
    setLoadingMessages(true);
    setShowMessageMetadata(false);
    setShowMessagesModal(true);
    try {
      const messages = await apiClient.getRoomMessages(roomId, undefined, 50);
      setRoomMessages(messages);
    } catch (err: unknown) {
      showToast.error(formatError(err));
      setShowMessagesModal(false);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!selectedRoomId || !roomMessages?.end) return;
    setLoadingMessages(true);
    try {
      const moreMessages = await apiClient.getRoomMessages(selectedRoomId, roomMessages.end, 50);
      setRoomMessages({
        ...moreMessages,
        chunk: [...(roomMessages.chunk || []), ...(moreMessages.chunk || [])],
      });
    } catch (err: unknown) {
      showToast.error(formatError(err));
    } finally {
      setLoadingMessages(false);
    }
  };

  if (loading && rooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <Header title="Rooms" />

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <Card className="mb-6">
        <div className="p-4">
          <Input
            placeholder="Search rooms by ID, name, or alias..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(0);
            }}
          />
        </div>
      </Card>

      <Table>
        <TableHeader>
          <TableHeaderCell>Room ID</TableHeaderCell>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Members</TableHeaderCell>
          <TableHeaderCell>Public</TableHeaderCell>
          <TableHeaderCell>Encrypted</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableHeader>
        <TableBody>
          {filteredRooms.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-[var(--color-muted)] py-8">
                No rooms found
              </TableCell>
            </TableRow>
          ) : (
            filteredRooms.map((room) => (
              <TableRow key={room.room_id}>
                <TableCell className="font-medium max-w-xs truncate" title={room.room_id}>
                  {room.room_id}
                </TableCell>
                <TableCell>{room.name || '-'}</TableCell>
                <TableCell>{room.joined_members || 0}</TableCell>
                <TableCell>
                  <Badge variant={room.public ? 'success' : 'default'}>
                    {room.public ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={room.encryption ? 'accent' : 'default'}>
                    {room.encryption ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleShowDetails(room.room_id)}
                    >
                      More Details
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleShowMessages(room.room_id)}
                    >
                      See Messages
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(room.room_id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-[var(--color-muted)]">
          Showing {filteredRooms.length} of {total} rooms
          {searchTerm && ` (filtered from ${rooms.length} loaded)`}
        </div>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              Previous
            </Button>
            <span className="px-3 py-2 text-sm text-[var(--color-muted)]">
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              variant="ghost"
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Room Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-background)] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="text-xl font-semibold">Room Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowDetailsModal(false)}>
                ✕
              </Button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="lg" />
                </div>
              ) : roomDetails ? (
                <div className="space-y-6">
                  {/* Room Info */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Room Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Room ID: </label>
                        <p className="font-mono text-sm break-all">{roomDetails.room?.room_id || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Name: </label>
                        <p>{roomDetails.room?.name || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Canonical Alias: </label>
                        <p>{roomDetails.room?.canonical_alias || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Creator: </label>
                        <p>{roomDetails.room?.creator || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Version: </label>
                        <p>{roomDetails.room?.version || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Joined Members: </label>
                        <p>{roomDetails.room?.joined_members || 0}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Local Members: </label>
                        <p>{roomDetails.room?.joined_local_members || 0}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Total Members: </label>
                        <p>{roomDetails.total_members || 0}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Encryption: </label>
                        <p>{roomDetails.room?.encryption || 'None'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Public: </label>
                        <Badge variant={roomDetails.room?.public ? 'success' : 'default'}>
                          {roomDetails.room?.public ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Federatable: </label>
                        <Badge variant={roomDetails.room?.federatable ? 'success' : 'default'}>
                          {roomDetails.room?.federatable ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Join Rules: </label>
                        <p>{roomDetails.room?.join_rules || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">Guest Access: </label>
                        <p>{roomDetails.room?.guest_access || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">History Visibility: </label>
                        <p>{roomDetails.room?.history_visibility || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-[var(--color-muted)]">State Events: </label>
                        <p>{roomDetails.room?.state_events || 0}</p>
                      </div>
                    </div>
                  </div>

                  {/* Members */}
                  {roomDetails.members && roomDetails.members.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Members ({roomDetails.members.length})</h3>
                      <div className="bg-[var(--color-surface)] rounded-lg p-4 max-h-48 overflow-y-auto">
                        <div className="space-y-1">
                          {roomDetails.members.map((member: string, idx: number) => (
                            <div key={idx} className="font-mono text-sm">{member}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* State Events */}
                  {roomDetails.state && roomDetails.state.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">State Events ({roomDetails.state.length})</h3>
                      <div className="bg-[var(--color-surface)] rounded-lg p-4 max-h-128 overflow-y-auto">
                        <div className="space-y-2">
                          {roomDetails.state.map((event: MatrixRoomEvent, idx: number) => (
                            <div key={idx} className="border-b border-[var(--color-border)] pb-2 last:border-0">
                              <div className="font-semibold text-sm">{event.type}</div>
                              <div className="text-xs text-[var(--color-muted)]">State Key: {event.state_key || '(empty)'}</div>
                              {event.content && (
                                <pre className="text-xs mt-1 overflow-x-auto">
                                  {JSON.stringify(event.content, null, 2)}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--color-muted)]">
                  No details available
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Room Messages Modal */}
      {showMessagesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-background)] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="text-xl font-semibold">Room Messages</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant={showMessageMetadata ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowMessageMetadata((prev) => !prev)}
                >
                  {showMessageMetadata ? 'Hide Metadata' : 'Show Metadata'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowMessagesModal(false)}>
                  ✕
                </Button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {loadingMessages && (!roomMessages || roomMessages.chunk?.length === 0) ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="lg" />
                </div>
              ) : roomMessages?.chunk && roomMessages.chunk.length > 0 ? (
                <div className="space-y-3">
                  {roomMessages.chunk.map((message: MatrixRoomEvent, idx: number) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-4 ${
                        message.type === 'm.room.message'
                          ? 'bg-[var(--color-background)] border-[var(--color-border)]'
                          : 'bg-[var(--color-surface)] border-[var(--color-border)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{message.sender || 'Unknown sender'}</div>
                          <div className="text-xs text-[var(--color-muted)]">
                            {message.origin_server_ts != null
                              ? new Date(message.origin_server_ts).toLocaleString()
                              : '—'}
                          </div>
                        </div>
                        <Badge variant={getEventTypeVariant(message.type ?? 'unknown')}>
                          {message.type ?? 'unknown'}
                        </Badge>
                      </div>

                      {message.type === 'm.room.message' ? (
                        <div className="space-y-2">
                          {strVal(message.content?.body) !== '' && (
                            <p className="whitespace-pre-wrap leading-relaxed">
                              {strVal(message.content?.body)}
                            </p>
                          )}
                          {strVal(message.content?.formatted_body) !== '' && (
                            <div
                              className="text-sm"
                              dangerouslySetInnerHTML={{
                                __html: safeFormattedHtml(strVal(message.content?.formatted_body)),
                              }}
                            />
                          )}
                          {message.content?.msgtype === 'm.image' &&
                            safeMediaUrl(strVal(message.content?.url)) && (
                            <div>
                              {/* External Matrix CDN / MXC URLs — skip Next image optimizer */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={safeMediaUrl(strVal(message.content?.url))!}
                                alt={strVal(message.content?.body, 'Image')}
                                className="max-w-full rounded border border-[var(--color-border)]"
                              />
                            </div>
                          )}
                          {message.content?.msgtype === 'm.file' && (
                            <div className="text-sm text-[var(--color-muted)]">
                              File:{' '}
                              {strVal(message.content?.body) ||
                                strVal(message.content?.filename) ||
                                'Unknown file'}
                            </div>
                          )}
                        </div>
                      ) : message.type === 'm.room.encrypted' ? (
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="font-semibold">Encrypted message</span>
                            <span className="text-[var(--color-muted)]">
                              {' '}
                              ({formatEncryptionAlgorithm(
                                typeof message.content?.algorithm === 'string'
                                  ? message.content.algorithm
                                  : undefined,
                              )})
                            </span>
                          </div>
                          <p className="text-sm text-[var(--color-muted)]">
                            Message body is end-to-end encrypted and cannot be previewed here.
                          </p>
                          {!showMessageMetadata && (
                            <p className="text-xs text-[var(--color-muted)]">
                              Enable metadata to inspect algorithm, sender key, and session identifiers.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-[var(--color-muted)]">
                          {formatMessagePreview(message)}
                        </div>
                      )}

                      {showMessageMetadata && (
                        <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-2">
                          <div className="text-xs font-mono text-[var(--color-muted)] break-all">
                            event_id: {message.event_id || '(missing)'}
                          </div>
                          {message.state_key !== undefined && (
                            <div className="text-xs text-[var(--color-muted)]">
                              state_key: {message.state_key === '' ? '(empty)' : message.state_key}
                            </div>
                          )}
                          {message.content && (
                            <pre className="text-xs overflow-x-auto bg-[var(--color-surface)] rounded p-2">
                              {JSON.stringify(message.content, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {roomMessages.end && (
                    <div className="mt-4 text-center">
                      <Button 
                        variant="ghost" 
                        onClick={loadMoreMessages}
                        disabled={loadingMessages}
                      >
                        {loadingMessages ? <LoadingSpinner size="sm" /> : 'Load More Messages'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--color-muted)]">
                  No messages found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
