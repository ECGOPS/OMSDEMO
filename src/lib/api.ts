import { doc, updateDoc, addDoc, collection } from "firebase/firestore";
import { db } from "../config/firebase";
import { OverheadLineInspection, VITAsset } from "./types";

interface Region {
  id: string;
  name: string;
}

interface District {
  id: string;
  name: string;
  regionId: string;
}

const regions: Region[] = [
  { id: "1", name: "Northern Region" },
  { id: "2", name: "Central Region" },
  { id: "3", name: "Southern Region" },
  { id: "4", name: "Eastern Region" },
  { id: "5", name: "Western Region" }
];

const districts: Record<string, District[]> = {
  "1": [
    { id: "1-1", name: "Northern District 1", regionId: "1" },
    { id: "1-2", name: "Northern District 2", regionId: "1" }
  ],
  "2": [
    { id: "2-1", name: "Central District 1", regionId: "2" },
    { id: "2-2", name: "Central District 2", regionId: "2" }
  ],
  "3": [
    { id: "3-1", name: "Southern District 1", regionId: "3" },
    { id: "3-2", name: "Southern District 2", regionId: "3" }
  ],
  "4": [
    { id: "4-1", name: "Eastern District 1", regionId: "4" },
    { id: "4-2", name: "Eastern District 2", regionId: "4" }
  ],
  "5": [
    { id: "5-1", name: "Western District 1", regionId: "5" },
    { id: "5-2", name: "Western District 2", regionId: "5" }
  ]
};

export async function getRegions(): Promise<Region[]> {
  // TODO: Replace with actual API call
  return regions;
}

export async function getDistricts(regionId: string): Promise<District[]> {
  // TODO: Replace with actual API call
  return districts[regionId] || [];
}

export function getRegionName(regionId: string): string {
  const region = regions.find(r => r.id === regionId);
  return region ? region.name : "Unknown Region";
}

export function getDistrictName(regionId: string, districtId: string): string {
  const regionDistricts = districts[regionId];
  if (!regionDistricts) return "Unknown District";
  
  const district = regionDistricts.find(d => d.id === districtId);
  return district ? district.name : "Unknown District";
} 

export const updateOverheadLineInspection = async (id: string, data: Partial<OverheadLineInspection>) => {
  const docRef = doc(db, "overheadLineInspections", id);
  await updateDoc(docRef, data);
};

export const addOverheadLineInspection = async (data: Omit<OverheadLineInspection, "id">) => {
  const docRef = await addDoc(collection(db, "overheadLineInspections"), data);
  return docRef.id;
};

export const addVITAsset = async (data: Omit<VITAsset, "id">) => {
  const docRef = await addDoc(collection(db, "vitAssets"), data);
  return docRef.id;
};

export const updateVITAsset = async (id: string, data: Partial<VITAsset>) => {
  const docRef = doc(db, "vitAssets", id);
  await updateDoc(docRef, data);
}; 