import { create } from "zustand";

interface PlayerUIState {
  showControls: boolean;
  showDetails: boolean;
  showEpisodeModal: boolean;
  showSourceModal: boolean;
  showSpeedModal: boolean;
  showNextEpisodeOverlay: boolean;
  showRelatedVideos: boolean;

  setShowControls: (show: boolean) => void;
  setShowDetails: (show: boolean) => void;
  setShowEpisodeModal: (show: boolean) => void;
  setShowSourceModal: (show: boolean) => void;
  setShowSpeedModal: (show: boolean) => void;
  setShowNextEpisodeOverlay: (show: boolean) => void;
  setShowRelatedVideos: (show: boolean) => void;
  resetUI: () => void;
}

const usePlayerUIStore = create<PlayerUIState>((set) => ({
  showControls: false,
  showDetails: false,
  showEpisodeModal: false,
  showSourceModal: false,
  showSpeedModal: false,
  showNextEpisodeOverlay: false,
  showRelatedVideos: false,

  setShowControls: (show) => set({ showControls: show }),
  setShowDetails: (show) => set({ showDetails: show }),
  setShowEpisodeModal: (show) => set({ showEpisodeModal: show }),
  setShowSourceModal: (show) => set({ showSourceModal: show }),
  setShowSpeedModal: (show) => set({ showSpeedModal: show }),
  setShowNextEpisodeOverlay: (show) => set({ showNextEpisodeOverlay: show }),
  setShowRelatedVideos: (show) => set({ showRelatedVideos: show }),

  resetUI: () => set({
    showControls: false,
    showDetails: false,
    showEpisodeModal: false,
    showSourceModal: false,
    showSpeedModal: false,
    showNextEpisodeOverlay: false,
    showRelatedVideos: false,
  }),
}));

export default usePlayerUIStore;
