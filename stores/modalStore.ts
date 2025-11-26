import { create } from 'zustand';

interface ModalState {
    isVisible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    showDeleteModal: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void;
    hideModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
    isVisible: false,
    title: '',
    message: '',
    onConfirm: () => { },
    onCancel: () => { },
    showDeleteModal: (title, message, onConfirm, onCancel) => {
        set({
            isVisible: true,
            title,
            message,
            onConfirm,
            onCancel: onCancel || (() => { }),
        });
    },
    hideModal: () => {
        set({ isVisible: false });
    },
}));
