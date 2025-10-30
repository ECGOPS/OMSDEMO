import { useEffect, useMemo, useState } from 'react';
import { BroadcastMessage, broadcastService } from '@/services/broadcastService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/sonner';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function BroadcastManager() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    broadcastService.list().then((list) => {
      if (mounted) setMessages(list.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1)));
    }).catch(console.error);
    return () => { mounted = false; };
  }, []);

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setImageUrl('');
    setVideoUrl('');
    setActive(true);
  };

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and Message are required');
      return;
    }
    setLoading(true);
    try {
      await broadcastService.create({ title, message, imageUrl: imageUrl || undefined, videoUrl: videoUrl || undefined, active });
      toast.success('Broadcast created');
      resetForm();
      const list = await broadcastService.list();
      setMessages(list.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1)));
    } catch (e) {
      console.error(e);
      toast.error('Failed to create broadcast');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id?: string) => {
    if (!id) return;
    await broadcastService.setActive(id);
    const list = await broadcastService.list();
    setMessages(list.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1)));
    toast.success('Broadcast activated');
  };

  const handleDeactivate = async (id?: string) => {
    if (!id) return;
    await broadcastService.deactivate(id);
    const list = await broadcastService.list();
    setMessages(list.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1)));
    toast.success('Broadcast deactivated');
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    await broadcastService.remove(id);
    setMessages(prev => prev.filter(m => m.id !== id));
    toast.success('Broadcast deleted');
  };

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-8">
      <Button onClick={() => navigate(-1)} variant="ghost" className="mb-2 flex items-center gap-2">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Create Broadcast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Image URL (optional)</Label>
              <Input id="image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="video">Video URL (optional)</Label>
              <Input id="video" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="YouTube/Vimeo link" />
            </div>
            <div className="flex items-end gap-3">
              <Switch id="active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="active">Set Active</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={resetForm}>Reset</Button>
            <Button onClick={handleCreate} disabled={loading}>{loading ? 'Saving...' : 'Save Broadcast'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Broadcasts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground">No broadcasts yet</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{m.title}</span>
                  {m.active && <span className="text-xs rounded bg-green-100 text-green-700 px-2 py-0.5">Active</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate max-w-xl">{m.message}</div>
              </div>
              <div className="flex gap-2">
                {!m.active && <Button size="sm" onClick={() => handleActivate(m.id)}>Activate</Button>}
                {m.active && <Button size="sm" variant="secondary" onClick={() => handleDeactivate(m.id)}>Deactivate</Button>}
                <Button size="sm" variant="destructive" onClick={() => handleDelete(m.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}


