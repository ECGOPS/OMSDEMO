import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Bell, AlertCircle, Info } from "lucide-react";
import { db } from "@/config/firebase";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface BroadcastMessage {
  id: string;
  message: string;
  createdAt: Timestamp | null;
  createdBy: string;
  priority: "low" | "medium" | "high";
}

export function BroadcastMessage() {
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const q = query(
      collection(db, "broadcastMessages"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BroadcastMessage[];
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, []);

  const handleDismiss = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, "broadcastMessages", messageId));
    } catch (error) {
      console.error("Error dismissing message:", error);
    }
  };

  const formatTimestamp = (timestamp: Timestamp | null) => {
    if (!timestamp) return "Unknown time";
    try {
      return format(timestamp.toDate(), "MMM d, yyyy 'at' h:mm a");
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return "Invalid time";
    }
  };

  const getPriorityIcon = (priority: "low" | "medium" | "high") => {
    switch (priority) {
      case "high":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "medium":
        return <Bell className="h-5 w-5 text-yellow-500" />;
      case "low":
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  if (messages.length === 0) return null;

  return (
    <div className="relative overflow-hidden mb-6 h-[120px]">
      <style>
        {`
          @keyframes scroll {
            0% {
              transform: translateX(100%);
            }
            100% {
              transform: translateX(-100%);
            }
          }
          .scrolling-message {
            animation: scroll 20s linear infinite;
            white-space: nowrap;
          }
          .scrolling-message:hover {
            animation-play-state: paused;
          }
        `}
      </style>
      <div className="scrolling-message absolute top-0 left-0 w-full">
        <div className="flex space-x-4">
          {messages.map((message) => (
            <Card 
              key={message.id}
              className={`flex-shrink-0 shadow-sm transition-all duration-200 hover:shadow-md ${
                message.priority === "high" 
                  ? "border-l-4 border-red-500 bg-white dark:bg-gray-900" 
                  : message.priority === "medium"
                  ? "border-l-4 border-yellow-500 bg-white dark:bg-gray-900"
                  : "border-l-4 border-blue-500 bg-white dark:bg-gray-900"
              }`}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {getPriorityIcon(message.priority)}
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                        {message.message}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium">{message.createdBy}</span>
                        <span>•</span>
                        <span>{formatTimestamp(message.createdAt)}</span>
                        <span>•</span>
                        <span className="capitalize">{message.priority} priority</span>
                      </div>
                    </div>
                  </div>
                  {(user?.role === "system_admin" || user?.role === "global_engineer") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      onClick={() => handleDismiss(message.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
} 