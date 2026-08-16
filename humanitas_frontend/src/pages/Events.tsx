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
    Calendar,
    Users,
    Search,
    Loader2,
    MapPin,
    Clock,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { useEvents, type Event } from '@/hooks/useCommunication';

export default function Events() {
    const { hasPermission } = usePermissions();
    const canCreate = hasPermission('create_events');
    const canEdit = hasPermission('edit_events');
    const canDelete = hasPermission('delete_events');

    const {
        eventsQuery,
        rolesQuery,
        categoriesQuery,
        usersQuery,
        createMutation,
        updateMutation,
        deleteMutation,
    } = useEvents();

    const events = eventsQuery.data || [];
    const roles = rolesQuery.data || [];
    const categories = categoriesQuery.data || [];
    const users = usersQuery.data || [];
    const isLoading = eventsQuery.isLoading;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Event | null>(null);
    const [userSearch, setUserSearch] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        event_date: '',
        event_time: '',
        location: '',
        target_type: 'all',
        target_ids: [] as string[],
    });

    const openCreate = () => {
        setEditingItem(null);
        setFormData({
            title: '',
            content: '',
            event_date: '',
            event_time: '',
            location: '',
            target_type: 'all',
            target_ids: [],
        });
        setIsModalOpen(true);
    };

    const openEdit = (item: Event) => {
        setEditingItem(item);
        setFormData({
            title: item.title,
            content: item.content || '',
            event_date: item.event_date,
            event_time: item.event_time || '',
            location: item.location || '',
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
        if (!confirm('Are you sure you want to delete this event?')) return;
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

    const getTargetLabel = (item: Event) => {
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
                        <Calendar className="h-6 w-6" />
                        Events
                    </h1>
                    <p className="text-gray-500 mt-1">Schedule and manage company events</p>
                </div>
                {canCreate && (
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Event
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
                                    <TableHead>Date & Time</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Target</TableHead>
                                    <TableHead>Created By</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {events.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                            No events yet
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    events.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.title}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Calendar className="h-3 w-3" />
                                                    {item.event_date ? format(new Date(item.event_date), 'MMM d, yyyy') : '-'}
                                                    {item.event_time && (
                                                        <>
                                                            <Clock className="h-3 w-3 ml-2" />
                                                            {item.event_time.slice(0, 5)}
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {item.location ? (
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <MapPin className="h-3 w-3" />
                                                        {item.location}
                                                    </div>
                                                ) : (
                                                    '-'
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                                    <Users className="h-3 w-3" />
                                                    {getTargetLabel(item)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{item.created_by_name}</TableCell>
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
                            {editingItem ? 'Edit Event' : 'New Event'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Title</Label>
                            <Input
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Event title"
                            />
                        </div>

                        <div>
                            <Label>Description (Optional)</Label>
                            <Textarea
                                value={formData.content}
                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                placeholder="Event description..."
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={formData.event_date}
                                    onChange={e => setFormData({ ...formData, event_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Time (Optional)</Label>
                                <Input
                                    type="time"
                                    value={formData.event_time}
                                    onChange={e => setFormData({ ...formData, event_time: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Location (Optional)</Label>
                                <Input
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="Meeting room, etc."
                                />
                            </div>
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
                            {editingItem ? 'Save Changes' : 'Create Event'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
