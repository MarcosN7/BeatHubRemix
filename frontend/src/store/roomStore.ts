import { create } from 'zustand';

interface Room {
    id: string;
    name: string;
    host: { id: string; username: string };
    listeners?: number;
    currentSong?: { title: string; youtubeVideoId: string } | null;
    createdAt?: string;
}

interface RoomState {
    currentRoom: Room | null;
    participants: Array<{ userId: string; username: string; role: string }>;
    setCurrentRoom: (room: Room | null) => void;
    setParticipants: (participants: any[]) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
    currentRoom: null,
    participants: [],
    setCurrentRoom: (room) => set({ currentRoom: room }),
    setParticipants: (participants) => set({ participants }),
}));
