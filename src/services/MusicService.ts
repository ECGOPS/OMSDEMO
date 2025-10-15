import { storage } from "@/config/firebase";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db } from "@/config/firebase";
import { collection, addDoc, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";

export interface MusicFile {
  id: string;
  name: string;
  path: string;
  url: string;
  isPlaying?: boolean;
}

export class MusicService {
  private static instance: MusicService;
  private musicCollection = collection(db, "music_files");

  private constructor() {}

  public static getInstance(): MusicService {
    if (!MusicService.instance) {
      MusicService.instance = new MusicService();
    }
    return MusicService.instance;
  }

  async uploadMusic(file: File): Promise<MusicFile> {
    const storageRef = ref(storage, `music/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log("Upload is " + progress + "% done");
        },
        (error) => {
          console.error("File upload failed:", error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const docRef = await addDoc(this.musicCollection, {
              name: file.name,
              path: storageRef.fullPath,
              url: downloadURL,
              createdAt: new Date().toISOString(),
            });

            resolve({
              id: docRef.id,
              name: file.name,
              path: storageRef.fullPath,
              url: downloadURL,
            });
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  async deleteMusic(id: string): Promise<void> {
    try {
      const docRef = doc(this.musicCollection, id);
      const docSnap = await getDocs(query(this.musicCollection, where("__name__", "==", id)));
      
      if (!docSnap.empty) {
        const fileData = docSnap.docs[0].data();
        const storageRef = ref(storage, fileData.path);
        await deleteObject(storageRef);
        await deleteDoc(docRef);
      }
    } catch (error) {
      console.error("Error deleting music file:", error);
      throw error;
    }
  }

  async getAllMusic(): Promise<MusicFile[]> {
    try {
      const querySnapshot = await getDocs(this.musicCollection);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        path: doc.data().path,
        url: doc.data().url,
      }));
    } catch (error) {
      console.error("Error fetching music files:", error);
      throw error;
    }
  }
} 