// src/components/Modal.tsx
import React from 'react';
import styles from '../styles/IncentiveFlow.module.css';

interface Props {
    isVisible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const Modal: React.FC<Props> = ({ isVisible, onClose, title, children }) => {
    if (!isVisible) {
        return null;
    }

    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>{title}</h3>
                    <button className={styles.modalClose} onClick={onClose}>&times;</button>
                </div>
                <div className={styles.modalBody}>
                    {children}
                </div>
                <div className={styles.modalFooter}>
                    <button onClick={onClose}>确认</button>
                </div>
            </div>
        </div>
    );
};

export default Modal;