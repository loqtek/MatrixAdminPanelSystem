'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { apiClient, MatrixUser, ThreePID, ExternalID } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card } from '@/components/ui/Card';
import { showToast, formatError } from '@/lib/toast';

type FilterType = 'all' | 'admin' | 'deactivated' | 'active' | 'locked' | 'shadow_banned' | 'bot' | 'support';

export default function UsersPage() {
  const [users, setUsers] = useState<MatrixUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<MatrixUser | null>(null);
  const [viewingUser, setViewingUser] = useState<MatrixUser | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUsers(currentPage * pageSize, pageSize, searchTerm || undefined);
      setUsers(response.users || []);
      setTotal(response.total || 0);
    } catch (err: unknown) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const loadUserDetails = async (userId: string) => {
    try {
      const userDetails = await apiClient.getUser(userId);
      setViewingUser(userDetails);
    } catch (err: unknown) {
      showToast.error(formatError(err));
    }
  };

  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    if (filter === 'admin') {
      filtered = filtered.filter(u => u.admin === true || u.admin === 1);
    } else if (filter === 'deactivated') {
      filtered = filtered.filter(u => u.deactivated === true || u.deactivated === 1);
    } else if (filter === 'active') {
      filtered = filtered.filter(u => !u.deactivated || u.deactivated === 0);
    } else if (filter === 'locked') {
      filtered = filtered.filter(u => u.locked === true);
    } else if (filter === 'shadow_banned') {
      filtered = filtered.filter(u => u.shadow_banned === 1 || (u.shadow_banned !== undefined && u.shadow_banned !== 0));
    } else if (filter === 'bot') {
      filtered = filtered.filter(u => u.user_type === 'bot');
    } else if (filter === 'support') {
      filtered = filtered.filter(u => u.user_type === 'support');
    }
    
    return filtered;
  }, [users, filter]);

  const totalPages = Math.ceil(total / pageSize);

  const handleAddUser = async (userData: Partial<MatrixUser>) => {
    try {
      await apiClient.createUser(userData);
      showToast.success('User created successfully');
      setShowAddModal(false);
      loadUsers();
    } catch (err: unknown) {
      showToast.error(formatError(err));
    }
  };

  const handleUpdateUser = async (userId: string, userData: Partial<MatrixUser>) => {
    try {
      await apiClient.updateUser(userId, userData);
      showToast.success('User updated successfully');
      setEditingUser(null);
      loadUsers();
    } catch (err: unknown) {
      showToast.error(formatError(err));
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await apiClient.deactivateUser(userId);
      showToast.success('User deactivated successfully');
      loadUsers();
    } catch (err: unknown) {
      showToast.error(formatError(err));
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;
    try {
      await apiClient.deleteUser(userId);
      showToast.success('User deleted successfully');
      loadUsers();
    } catch (err: unknown) {
      showToast.error(formatError(err));
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Users"
        actions={
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            + Add User
          </Button>
        }
      />

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <Card className="mb-6">
        <div className="p-4 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search users by name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(0);
              }}
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <option value="all">All Users</option>
            <option value="active">Active</option>
            <option value="admin">Admins</option>
            <option value="deactivated">Deactivated</option>
            <option value="locked">Locked</option>
            <option value="shadow_banned">Shadow Banned</option>
            <option value="bot">Bots</option>
            <option value="support">Support</option>
          </select>
        </div>
      </Card>

      <Table>
        <TableHeader>
          <TableHeaderCell>User ID</TableHeaderCell>
          <TableHeaderCell>Display Name</TableHeaderCell>
          <TableHeaderCell>Type</TableHeaderCell>
          <TableHeaderCell>Admin</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Created</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableHeader>
        <TableBody>
          {filteredUsers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-[var(--color-muted)] py-8">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            filteredUsers.map((user) => (
              <TableRow key={user.name}>
                <TableCell className="font-medium max-w-xs truncate" title={user.name}>
                  {user.name}
                </TableCell>
                <TableCell>{user.displayname || '-'}</TableCell>
                <TableCell>
                  {user.user_type ? (
                    <Badge variant="accent">{user.user_type}</Badge>
                  ) : (
                    <Badge variant="default">user</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={(user.admin === true || user.admin === 1) ? 'primary' : 'default'}>
                    {(user.admin === true || user.admin === 1) ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {(user.deactivated === true || user.deactivated === 1) && (
                      <Badge variant="danger">Deactivated</Badge>
                    )}
                    {user.locked && <Badge variant="warning">Locked</Badge>}
                    {user.shadow_banned === 1 && (
                      <Badge variant="danger">Shadow Banned</Badge>
                    )}
                    {!user.deactivated && !user.locked && (
                      <Badge variant="success">Active</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{formatDate(user.creation_ts)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadUserDetails(user.name)}
                    >
                      Details
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingUser(user)}
                    >
                      Edit
                    </Button>
                    {!user.deactivated && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeactivate(user.name)}
                      >
                        Deactivate
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(user.name)}
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
          Showing {filteredUsers.length} of {total} users
          {filter !== 'all' && ` (filtered from ${users.length} loaded)`}
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

      {showAddModal && (
        <UserModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddUser}
        />
      )}

      {editingUser && (
        <UserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(data) => handleUpdateUser(editingUser.name, data)}
        />
      )}

      {viewingUser && (
        <UserDetailsModal
          user={viewingUser}
          onClose={() => setViewingUser(null)}
        />
      )}
    </div>
  );
}

function UserDetailsModal({
  user,
  onClose,
}: {
  user: MatrixUser;
  onClose: () => void;
}) {
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="User Details"
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <h3 className="font-semibold text-[var(--color-foreground)] mb-2">Basic Information</h3>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">User ID:</span> {user.name}</div>
            <div><span className="font-medium">Display Name:</span> {user.displayname || 'Not set'}</div>
            <div><span className="font-medium">Avatar URL:</span> {user.avatar_url || 'Not set'}</div>
            <div><span className="font-medium">User Type:</span> {user.user_type || 'user'}</div>
            <div><span className="font-medium">Created:</span> {formatDate(user.creation_ts)}</div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-[var(--color-foreground)] mb-2">Status</h3>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Admin:</span> {user.admin ? 'Yes' : 'No'}</div>
            <div><span className="font-medium">Deactivated:</span> {user.deactivated ? 'Yes' : 'No'}</div>
            <div><span className="font-medium">Erased:</span> {user.erased ? 'Yes' : 'No'}</div>
            <div><span className="font-medium">Locked:</span> {user.locked ? 'Yes' : 'No'}</div>
            <div><span className="font-medium">Shadow Banned:</span> {user.shadow_banned ? 'Yes' : 'No'}</div>
            <div><span className="font-medium">Is Guest:</span> {user.is_guest ? 'Yes' : 'No'}</div>
          </div>
        </div>

        {user.threepids && user.threepids.length > 0 && (
          <div>
            <h3 className="font-semibold text-[var(--color-foreground)] mb-2">Third-Party IDs</h3>
            <div className="space-y-2">
              {user.threepids.map((tpid, idx) => (
                <div key={idx} className="text-sm p-2 bg-[var(--color-surface)] rounded">
                  <div><span className="font-medium">Type:</span> {tpid.medium}</div>
                  <div><span className="font-medium">Address:</span> {tpid.address}</div>
                  {tpid.added_at && <div><span className="font-medium">Added:</span> {formatDate(tpid.added_at / 1000)}</div>}
                  {tpid.validated_at && <div><span className="font-medium">Validated:</span> {formatDate(tpid.validated_at / 1000)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {user.external_ids && user.external_ids.length > 0 && (
          <div>
            <h3 className="font-semibold text-[var(--color-foreground)] mb-2">External IDs (SSO)</h3>
            <div className="space-y-2">
              {user.external_ids.map((eid, idx) => (
                <div key={idx} className="text-sm p-2 bg-[var(--color-surface)] rounded">
                  <div><span className="font-medium">Provider:</span> {eid.auth_provider}</div>
                  <div><span className="font-medium">External ID:</span> {eid.external_id}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold text-[var(--color-foreground)] mb-2">Additional Information</h3>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">App Service ID:</span> {user.appservice_id || 'N/A'}</div>
            <div><span className="font-medium">Consent Version:</span> {user.consent_version || 'N/A'}</div>
            {user.consent_ts && <div><span className="font-medium">Consent Timestamp:</span> {formatDate(user.consent_ts)}</div>}
            {user.consent_server_notice_sent && <div><span className="font-medium">Consent Notice Sent:</span> {user.consent_server_notice_sent}</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

type UserFormSavePayload = Partial<MatrixUser> & {
  password?: string;
  logout_devices?: boolean;
  username?: string;
};

function UserModal({
  user,
  onClose,
  onSave,
}: {
  user?: MatrixUser;
  onClose: () => void;
  onSave: (data: UserFormSavePayload) => void;
}) {
  const [username, setUsername] = useState(user?.name?.split(':')[0]?.replace('@', '') || '');
  const [displayname, setDisplayname] = useState(user?.displayname || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [password, setPassword] = useState('');
  const [logoutDevices, setLogoutDevices] = useState(true);
  const [admin, setAdmin] = useState(user?.admin === true || user?.admin === 1 || false);
  const [deactivated, setDeactivated] = useState(user?.deactivated === true || user?.deactivated === 1 || false);
  const [locked, setLocked] = useState(user?.locked || false);
  const [userType, setUserType] = useState(user?.user_type || '');
  const [threepids, setThreepids] = useState<ThreePID[]>(user?.threepids?.map(t => ({ medium: t.medium, address: t.address })) || []);
  const [externalIds, setExternalIds] = useState<ExternalID[]>(user?.external_ids || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: UserFormSavePayload = {
      displayname: displayname || undefined,
      avatar_url: avatarUrl || undefined,
      admin,
      logout_devices: logoutDevices,
    };

    if (!user) {
      // Creating new user
      if (username && password) {
        data.username = username;
        data.password = password;
      }
    } else {
      // Updating existing user
      if (password) {
        data.password = password;
      }
      // Only set deactivated/locked if explicitly changed
      if (deactivated !== (user.deactivated === true || user.deactivated === 1)) {
        data.deactivated = deactivated;
      }
      if (locked !== user.locked) {
        data.locked = locked;
      }
    }

    if (userType) {
      data.user_type = userType === 'null' ? null : userType;
    } else if (user && user.user_type) {
      data.user_type = null; // Clear if was set
    }

    if (threepids.length > 0) {
      data.threepids = threepids;
    }

    if (externalIds.length > 0) {
      data.external_ids = externalIds;
    }

    onSave(data);
  };

  const addThreePID = () => {
    setThreepids([...threepids, { medium: 'email', address: '' }]);
  };

  const removeThreePID = (index: number) => {
    setThreepids(threepids.filter((_, i) => i !== index));
  };

  const updateThreePID = (index: number, field: 'medium' | 'address', value: string) => {
    const updated = [...threepids];
    updated[index] = { ...updated[index], [field]: value };
    setThreepids(updated);
  };

  const addExternalID = () => {
    setExternalIds([...externalIds, { auth_provider: '', external_id: '' }]);
  };

  const removeExternalID = (index: number) => {
    setExternalIds(externalIds.filter((_, i) => i !== index));
  };

  const updateExternalID = (index: number, field: 'auth_provider' | 'external_id', value: string) => {
    const updated = [...externalIds];
    updated[index] = { ...updated[index], [field]: value };
    setExternalIds(updated);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={user ? 'Edit User' : 'Add User'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {user ? 'Update' : 'Create'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
        {!user && (
          <>
            <Input
              label="Username (localpart)"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="user"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </>
        )}

        {user && (
          <>
            <div className="text-sm text-[var(--color-muted)]">
              <strong>User ID:</strong> {user.name}
            </div>
            <Input
              label="New Password (optional)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty to keep current password"
            />
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={logoutDevices}
                onChange={(e) => setLogoutDevices(e.target.checked)}
                className="mr-2 rounded"
                id="logoutDevices"
              />
              <label htmlFor="logoutDevices" className="text-sm font-medium text-[var(--color-foreground)]">
                Logout all devices when password is changed
              </label>
            </div>
          </>
        )}

        <Input
          label="Display Name"
          type="text"
          value={displayname}
          onChange={(e) => setDisplayname(e.target.value)}
          placeholder="Leave empty to remove display name"
        />

        <Input
          label="Avatar URL (MXC URI)"
          type="text"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="mxc://example.com/abcde12345 or leave empty to remove"
        />

        <div>
          <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
            User Type
          </label>
          <select
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
            className="w-full px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <option value="">user (default)</option>
            <option value="bot">bot</option>
            <option value="support">support</option>
            <option value="null">Clear (null)</option>
          </select>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={admin}
            onChange={(e) => setAdmin(e.target.checked)}
            className="mr-2 rounded"
            id="admin"
          />
          <label htmlFor="admin" className="text-sm font-medium text-[var(--color-foreground)]">
            Admin
          </label>
        </div>

        {user && (
          <>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={deactivated}
                onChange={(e) => setDeactivated(e.target.checked)}
                className="mr-2 rounded"
                id="deactivated"
              />
              <label htmlFor="deactivated" className="text-sm font-medium text-[var(--color-foreground)]">
                Deactivated
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
                className="mr-2 rounded"
                id="locked"
              />
              <label htmlFor="locked" className="text-sm font-medium text-[var(--color-foreground)]">
                Locked
              </label>
            </div>
          </>
        )}

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-[var(--color-foreground)]">
              Third-Party IDs (Email/Phone)
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={addThreePID}>
              + Add
            </Button>
          </div>
          {threepids.map((tpid, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <select
                value={tpid.medium}
                onChange={(e) => updateThreePID(idx, 'medium', e.target.value)}
                className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm text-[var(--color-foreground)]"
              >
                <option value="email">Email</option>
                <option value="msisdn">Phone (MSISDN)</option>
              </select>
              <Input
                value={tpid.address}
                onChange={(e) => updateThreePID(idx, 'address', e.target.value)}
                placeholder={tpid.medium === 'email' ? 'email@example.com' : '447470274584'}
                className="flex-1"
              />
              <Button type="button" variant="danger" size="sm" onClick={() => removeThreePID(idx)}>
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-[var(--color-foreground)]">
              External IDs (SSO)
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={addExternalID}>
              + Add
            </Button>
          </div>
          {externalIds.map((eid, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <Input
                value={eid.auth_provider}
                onChange={(e) => updateExternalID(idx, 'auth_provider', e.target.value)}
                placeholder="Provider ID"
                className="flex-1"
              />
              <Input
                value={eid.external_id}
                onChange={(e) => updateExternalID(idx, 'external_id', e.target.value)}
                placeholder="External ID"
                className="flex-1"
              />
              <Button type="button" variant="danger" size="sm" onClick={() => removeExternalID(idx)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
