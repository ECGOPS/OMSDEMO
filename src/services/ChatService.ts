import { db } from "@/config/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export interface ChatMessage {
  id: string;
  text?: string;
  sender: string;
  senderId: string;
  timestamp: Timestamp;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  senderRegion?: string;
  senderDistrict?: string;
}

export class ChatService {
  private static instance: ChatService;
  private chatCollection = collection(db, "chat_messages");
  private storage = getStorage();

  private constructor() {}

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  async sendMessage(text: string | undefined, sender: string, senderId: string, fileUrl?: string, fileName?: string, fileType?: string, senderRegion?: string, senderDistrict?: string): Promise<void> {
    if (!text?.trim() && !fileUrl) {
        console.warn("Cannot send empty message or message without attachment.");
        return;
    }
    try {
      const messageData: any = {
        sender,
        senderId,
        timestamp: serverTimestamp(),
        senderRegion,
        senderDistrict,
      };
      if (text?.trim()) {
          messageData.text = text.trim();
      }
      if (fileUrl && fileName && fileType) {
          messageData.fileUrl = fileUrl;
          messageData.fileName = fileName;
          messageData.fileType = fileType;
      }
      await addDoc(this.chatCollection, messageData);
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  subscribeToMessages(callback: (messages: ChatMessage[]) => void): () => void {
    const q = query(this.chatCollection, orderBy("timestamp", "asc"));
    
    return onSnapshot(q, (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as ChatMessage;
        messages.push({
          id: doc.id,
          text: data.text,
          sender: data.sender,
          senderId: data.senderId,
          timestamp: data.timestamp,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileType: data.fileType,
          senderRegion: data.senderRegion,
          senderDistrict: data.senderDistrict,
        });
      });
      callback(messages);
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      const messageRef = doc(db, "chat_messages", messageId);
      console.log(`Attempting to delete document ${messageId} from chat_messages collection.`);
      await deleteDoc(messageRef);
      console.log("Document deleted successfully from Firestore.");
    } catch (error) {
      console.error("Error deleting message from Firestore:", error);
      throw error;
    }
  }

  async updateMessage(messageId: string, newText: string): Promise<void> {
    try {
      const messageRef = doc(db, "chat_messages", messageId);
      console.log(`Updating document ${messageId} in chat_messages collection.`);
      await updateDoc(messageRef, {
        text: newText,
      });
      console.log("Document updated in Firestore.");
    } catch (error) {
      console.error("Error updating message in Firestore:", error);
      throw error;
    }
  }

  async uploadFile(file: File, senderId: string): Promise<{ url: string; name: string; type: string }> {
    const storageRef = ref(this.storage, `chat_attachments/${senderId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
        },
        (error) => {
          console.error('File upload failed:', error);
          reject(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            console.log('File available at', downloadURL);
            resolve({ url: downloadURL, name: file.name, type: file.type });
          }).catch(reject);
        }
      );
    });
  }
}

 