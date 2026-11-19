export interface Prize {
  id: string;
  name: string;
  description: string | null;
  category: string;
  color: string | null;
  isAvailable: boolean;
  claimedAt: string | null;
  claimedByParticipantId: string | null;
  createdAt: string;
}

export interface RouletteSettings {
  eventTitle: string;
  allowMultipleSpinsPerCpf: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface PublicWinner {
  spinId: string;
  participantName: string;
  maskedCpf: string;
  prizeId: string;
  prizeName: string;
  prizeCategory: string;
  prizeColor: string | null;
  spunAt: string;
}

export interface AdminWinner extends PublicWinner {
  cpf: string;
  formattedCpf: string;
}

export type StorageMode = "supabase" | "demo";

export interface PublicRouletteState {
  mode: StorageMode;
  settings: RouletteSettings;
  availablePrizes: Prize[];
  totalPrizes: number;
  claimedCount: number;
  recentWinners: PublicWinner[];
}

export interface AdminRouletteState {
  mode: StorageMode;
  settings: RouletteSettings;
  prizes: Prize[];
  winners: AdminWinner[];
  totalParticipants: number;
}

export interface SpinSuccessResponse {
  mode: StorageMode;
  prize: Prize;
  spin: PublicWinner;
  preSpinPrizes: Prize[];
  state: PublicRouletteState;
}
