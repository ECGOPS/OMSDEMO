import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Minimize2, Maximize2, Edit, Trash2, Paperclip, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ChatService, ChatMessage } from "@/services/ChatService";

export function ChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const chatService = ChatService.getInstance();

  useEffect(() => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support desktop notification');
    } else {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // IMPORTANT: Do NOT add 'messages' to the dependency array below!
  // Including it will cause the subscription to re-initialize on every message update,
  // breaking real-time updates and causing missed messages.
  useEffect(() => {
    const unsubscribe = chatService.subscribeToMessages((updatedMessages) => {
      const messagesFromOthers = updatedMessages.filter(m => m.senderId !== user?.id);
      setMessages(updatedMessages);
      setIsLoading(false);
      if (messagesFromOthers.length > 0) {
        if (notificationPermission === 'granted' && !document.hasFocus()) {
          const currentMessageIds = new Set(messages.map(m => m.id));
          const newlyArrivedMessages = updatedMessages.filter(m => 
            !currentMessageIds.has(m.id) && m.senderId !== user?.id
          );
          newlyArrivedMessages.forEach(message => {
            const notification = new Notification(`New Message from ${message.sender}`, {
              body: message.text || '[Attachment]',
            });
          });
        }
        if (isMinimized || !document.hasFocus()) {
          setUnreadCount(prevCount => prevCount + messagesFromOthers.length);
        }
      }
    });
    return () => unsubscribe();
  }, [chatService, user?.id, notificationPermission, isMinimized]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.hasFocus()) {
        setUnreadCount(0);
      }
    };

    window.addEventListener('focus', handleFocus);
    
    if (!isMinimized && unreadCount > 0) {
        setUnreadCount(0);
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isMinimized, unreadCount]);

  useEffect(() => {
    if (scrollRef.current && !editingMessageId) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, editingMessageId]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploading(true);

    try {
      console.log('Uploading file:', file.name);
      const fileDetails = await chatService.uploadFile(file, user.id);

      console.log('File uploaded, sending message with details:', fileDetails);
      await chatService.sendMessage(
        newMessage.trim() === '' ? undefined : newMessage.trim(),
        user.name || 'Anonymous',
        user.id,
        fileDetails.url,
        fileDetails.name,
        fileDetails.type,
        user.region,
        user.district
      );

      setNewMessage('');
      console.log('Message with attachment sent.');

    } catch (error) {
      console.error('Error uploading file or sending message:', error);
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleAttachmentClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || isUploading) return;

    try {
      await chatService.sendMessage(
        newMessage.trim(),
        user.name || 'Anonymous',
        user.id,
        undefined,
        undefined,
        undefined,
        user.region,
        user.district
      );
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isUploading) {
        if (editingMessageId) {
          handleSaveEdit();
        } else {
          if (newMessage.trim()) {
            handleSendMessage();
          }
        }
      }
    }
  };

  const handleEditClick = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditingMessageText(message.text);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingMessageText.trim()) {
        console.log("Save edit aborted: No message selected or text is empty.");
        return;
    }

    try {
      console.log(`Attempting to update message ${editingMessageId} with text: ${editingMessageText}`);
      await chatService.updateMessage(editingMessageId, editingMessageText);
      console.log("Message updated successfully.");
      handleCancelEdit();
    } catch (error) {
      console.error('Error saving edit:', error);
    }
  };

  const handleDeleteClick = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      console.log(`Attempting to delete message with ID: ${messageId}`);
      await chatService.deleteMessage(messageId);
      console.log(`Message ${messageId} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  return (
    <>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .blinking-text {
          animation: blink 1s linear infinite;
        }
      `}</style>
      <Card className={`w-80 shadow-lg transition-all duration-300 ${isMinimized ? 'h-12 bg-blue-500 text-primary-foreground' : 'h-96'}`}>
        <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMinimized ? 'py-2' : 'pb-2'} px-4 relative`}>
          <CardTitle className={`text-base font-semibold truncate ${isMinimized ? 'text-primary-foreground' : ''}`}>Team Chat</CardTitle>
          
          {isMinimized && (
             <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                   <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                   </span>
                )}
                {unreadCount > 0 && (
                  <span className="ml-1 text-xs font-bold text-primary-foreground">{unreadCount}</span>
                )}
                 <Bell className={`h-4 w-4 ${isMinimized ? 'text-primary-foreground' : ''}`} />
             </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className={`flex-shrink-0 w-8 h-8 ${isMinimized ? 'text-primary-foreground hover:bg-blue-600' : ''}`}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {!isMinimized && (
          <CardContent 
            className="flex flex-col h-[calc(100%-3rem)] p-4"
            style={{
              backgroundImage: "url('/images/gina.png')",
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
          >
            <ScrollArea ref={scrollRef} className="flex-1 pr-4">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="text-center text-sm text-muted-foreground">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground">No messages yet. Start the conversation!</div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      {editingMessageId === message.id ? (
                        <div className="flex flex-col w-full">
                          <Input
                            value={editingMessageText}
                            onChange={(e) => setEditingMessageText(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="mb-2"
                            autoFocus
                          />
                          <div className="flex justify-end space-x-2 text-xs">
                            <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                            <Button variant="default" size="sm" onClick={handleSaveEdit} disabled={!editingMessageText.trim()}>
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`flex flex-col max-w-[80%] group relative ${
                            message.senderId === user?.id
                              ? 'bg-primary text-primary-foreground rounded-lg rounded-br-none'
                              : 'bg-muted rounded-lg rounded-tl-none'
                          } px-3 py-2 text-sm`}
                        >
                          <div className={`text-xs opacity-80 mb-1 ${message.senderId === user?.id ? 'text-right' : 'text-left'}`}>
                            {message.sender}
                          </div>
                          {(message.senderRegion || message.senderDistrict) && (
                            <div className={`text-[10px] mt-0.5 mb-1 ${message.senderId === user?.id ? 'text-right' : 'text-left'}`}
                              style={{ lineHeight: 1 }}
                            >
                              <span className="inline-block px-1.5 py-0.5 rounded bg-blue-600 text-white font-medium border border-blue-700 shadow-sm blinking-text">
                                {message.senderRegion ? message.senderRegion : ''}
                                {message.senderRegion && message.senderDistrict ? ', ' : ''}
                                {message.senderDistrict ? message.senderDistrict : ''}
                              </span>
                            </div>
                          )}
                          {message.text && <p className="break-words">{message.text}</p>}
                          {message.fileUrl && message.fileName && (
                            <a
                              href={message.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline break-words"
                            >
                              {message.fileName}
                            </a>
                          )}
                          <div className={`text-xs opacity-60 mt-1 ${message.senderId === user?.id ? 'text-right' : 'text-left'}`}>
                            {message.timestamp?.toDate().toLocaleTimeString()}
                          </div>
                          {message.senderId === user?.id && (
                            <div className={`absolute ${message.senderId === user?.id ? '-left-12' : '-right-12'} top-1/2 transform -translate-y-1/2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity items-center`}>
                              <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => handleEditClick(message)}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="w-6 h-6 text-red-500 hover:text-red-700" onClick={() => handleDeleteClick(message.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center space-x-2 mt-auto pt-3 border-t">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAttachmentClick}
                className="flex-shrink-0"
                disabled={isUploading}
              >
                {isUploading ? (
                  <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l2-2.647z"></path></svg>
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isUploading ? "Uploading..." : "Type a message..."}
                className="flex-grow"
                disabled={isUploading}
              />
              <Button type="submit" onClick={handleSendMessage} size="icon" disabled={!newMessage.trim() || isUploading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </>
  );
} 