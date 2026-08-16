import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Plus,
    Pencil,
    Trash2,
    Megaphone,
    Users,
    Search,
    Loader2,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { useAnnouncements, type Announcement } from '@/hooks/useCommunication';

export default function Announcements() {
    const { hasPermission } = usePermissions();
    const canCreate = hasPermission('create_announcements');
    const canEdit = hasPermission('edit_announcements');
    const canDelete = hasPermission('delete_announcements');

    const {
        announcementsQuery,
        rolesQuery,
        categoriesQuery,
        usersQuery,
        createMutation,
        updateMutation,
        deleteMutation,
    } = useAnnouncements();

    const announcements = announcementsQuery.data || [];
    const roles = rolesQuery.data || [];
    const categories = categoriesQuery.data || [];
    const users = usersQuery.data || [];
    const isLoading = announcementsQuery.isLoading;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Announcement | null>(null);
    const [userSearch, setUserSearch] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        priority: 'normal',
        target_type: 'all',
        target_ids: [] as string[],
    });

    const openCreate = () => {
        setEditingItem(null);
        setFormData({ title: '', content: '', priority: 'normal', target_type: 'all', target_ids: [] });
        setIsModalOpen(true);
    };

    const openEdit = (item: Announcement) => {
        setEditingItem(item);
        setFormData({
            title: item.title,
            content: item.content,
            priority: item.priority,
            target_type: item.target_type,
            target_ids: item.target_ids || [],
        });
        setIsModalOpen(true);
    };

    const handleSubmit = () => {
        if (editingItem) {
            updateMutation.mutate({ id: editingItem.id, data: formData }, {
                onSuccess: () => setIsModalOpen(false),
            });
        } else {
            createMutation.mutate(formData, {
                onSuccess: () => setIsModalOpen(false),
            });
        }
    };

    const handleDelete = (id: string) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return;
        deleteMutation.mutate(id);
    };

    const toggleTargetId = (id: string) => {
        setFormData(prev => ({
            ...prev,
            target_ids: prev.target_ids.includes(id)
                ? prev.target_ids.filter(i => i !== id)
                : [...prev.target_ids, id],
        }));
    };

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase())
    );

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return <Badge className="bg-red-100 text-red-700">Urgent</Badge>;
            case 'important':
                return <Badge className="bg-orange-100 text-orange-700">Important</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-700">Normal</Badge>;
        }
    };

    const getTargetLabel = (item: Announcement) => {
        if (item.target_type === 'all') return 'All Users';
        if (item.target_type === 'role') return `${item.target_ids?.length || 0} Role(s)`;
        if (item.target_type === 'category') return `${item.target_ids?.length || 0} Category(ies)`;
        if (item.target_type === 'individual') return `${item.target_ids?.length || 0} User(s)`;
        return item.target_type;
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Megaphone className="h-6 w-6" />
                        Announcements
                    </h1>
                    <p className="text-gray-500 mt-1">Create and manage company announcements</p>
                </div>
                {canCreate && (
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Announcement
                    </Button>
                )}
            </div>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Target</TableHead>
                                    <TableHead>Created By</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {announcements.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                            No announcements yet
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    announcements.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.title}</TableCell>
                                            <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                                    <Users className="h-3 w-3" />
                                                    {getTargetLabel(item)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{item.created_by_name}</TableCell>
                                            <TableCell>{format(new Date(item.created_at), 'MMM d, yyyy')}</TableCell>
                                            <TableCell className="text-right space-x-2">
                                                {canEdit && (
                                                    <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {canDelete && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingItem ? 'Edit Announcement' : 'New Announcement'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Title</Label>
                            <Input
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Announcement title"
                            />
                        </div>

                        <div>
                            <Label>Content</Label>
                            <Textarea
                                value={formData.content}
                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                placeholder="Announcement content..."
                                rows={4}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Priority</Label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={v => setFormData({ ...formData, priority: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="important">Important</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Target Audience</Label>
                                <Select
                                    value={formData.target_type}
                                    onValueChange={v => setFormData({ ...formData, target_type: v, target_ids: [] })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Users</SelectItem>
                                        <SelectItem value="role">By Role</SelectItem>
                                        <SelectItem value="category">By Category</SelectItem>
                                        <SelectItem value="individual">Individual Users</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Target Selection */}
                        {formData.target_type === 'role' && (
                            <div>
                                <Label>Select Roles</Label>
                                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                                    {roles.map(role => (
                                        <div key={role.id} className="flex items-center gap-2">
                                            <Checkbox
                                                checked={formData.target_ids.includes(role.id)}
                                                onCheckedChange={() => toggleTargetId(role.id)}
                                            />
                                            <span>{role.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {formData.target_type === 'category' && (
                            <div>
                                <Label>Select Categories</Label>
                                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                                    {categories.map(cat => (
                                        <div key={cat.id} className="flex items-center gap-2">
                                            <Checkbox
                                                checked={formData.target_ids.includes(cat.id)}
                                                onCheckedChange={() => toggleTargetId(cat.id)}
                                            />
                                            <span>{cat.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {formData.target_type === 'individual' && (
                            <div>
                                <Label>Select Users</Label>
                                <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                        placeholder="Search users..."
                                        className="pl-9"
                                    />
                                </div>
                                <ScrollArea className="border rounded-md p-3 h-48">
                                    {filteredUsers.map(user => (
                                        <div key={user.id} className="flex items-center gap-2 py-1">
                                            <Checkbox
                                                checked={formData.target_ids.includes(user.id)}
                                                onCheckedChange={() => toggleTargetId(user.id)}
                                            />
                                            <div>
                                                <span className="font-medium">{user.full_name}</span>
                                                <span className="text-xs text-gray-500 ml-2">{user.email}</span>
                                            </div>
                                        </div>
                                    ))}
                                </ScrollArea>
                                {formData.target_ids.length > 0 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {formData.target_ids.length} user(s) selected
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit}>
                            {editingItem ? 'Save Changes' : 'Create Announcement'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
