// src/components/Toast.tsx
import React from 'react';
import styles from '../styles/IncentiveFlow.module.css';
import type { IToast } from './IncentiveFlow';

interface Props {
    toasts: IToast[];
}

const Toast: React.FC<Props> = ({ toasts }) => {
    return (
        <ul className={styles.toastContainer}>
            {toasts.map(toast => (
                <li key={toast.id} className={`${styles.toast} ${styles.toastSuccess}`}>
                    {toast.message}
                </li>
            ))}
        </ul>
    );
};

export default Toast;