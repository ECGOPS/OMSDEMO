import { useEffect, useMemo, useState } from 'react';
import { broadcastService, BroadcastMessage } from '@/services/broadcastService';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export function BroadcastPopup() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<BroadcastMessage | null>(null);

  useEffect(() => {
    // Subscribe to active broadcast
    const unsubscribe = broadcastService.subscribeActive((m) => {
      setMessage(m);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!message?.id) {
      setOpen(false);
      return;
    }
    // Check time window (optional scheduling)
    const now = Date.now();
    const inWindow = (() => {
      const start = (message.startDate as any)?.toMillis ? (message.startDate as any).toMillis() : (message.startDate instanceof Date ? message.startDate.getTime() : undefined);
      const end = (message.endDate as any)?.toMillis ? (message.endDate as any).toMillis() : (message.endDate instanceof Date ? message.endDate.getTime() : undefined);
      if (start && now < start) return false;
      if (end && now > end) return false;
      return true;
    })();
    if (!inWindow) {
      setOpen(false);
      return;
    }

    // Show if not seen
    const seen = broadcastService.hasSeenLocal(message.id!, user?.uid);
    setOpen(!seen);
  }, [message, user?.uid]);

  const videoEmbed = useMemo(() => {
    if (!message?.videoUrl) return null;
    const url = message.videoUrl;
    // very light handling for YouTube share links
    if (url.includes('youtube.com') || url.includes('youtu.be')) return url;
    if (url.includes('vimeo.com')) return url;
    return url;
  }, [message?.videoUrl]);

  const handleClose = async () => {
    if (message?.id) {
      broadcastService.markSeenLocal(message.id, user?.uid);
      await broadcastService.markSeenRemote(message.id);
    }
    setOpen(false);
  };

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl">{message.title}</DialogTitle>
        </DialogHeader>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25 }}
              className="p-6 pt-2 space-y-4 max-h-[75vh] overflow-y-auto"
            >
              {message.imageUrl && (
                <img src={message.imageUrl} alt="Announcement" className="w-full h-auto rounded-md object-cover" />
              )}
              {videoEmbed && (
                <div className="aspect-video w-full">
                  <iframe
                    src={videoEmbed}
                    className="w-full h-full rounded-md"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{message.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex justify-end p-6 pt-2 border-t border-muted">
          <Button onClick={handleClose}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BroadcastPopup;


