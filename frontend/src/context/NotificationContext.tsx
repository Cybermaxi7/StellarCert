import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { apiClient, API_URL } from '../api';
import { tokenStorage } from '../api/tokens';

export type NotificationType = 'info' | 'success' | 'error';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

interface NotificationContextProps {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    fetchNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

/* eslint-disable react-refresh/only-export-components */
export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within NotificationProvider');
    return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const fetchNotifications = async () => {
        try {
            const token = tokenStorage.getAccessToken();
            if (!token) return;
            const data = await apiClient<Notification[]>('/notifications');
            setNotifications(data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    useEffect(() => {
        const token = tokenStorage.getAccessToken();
        if (!token) return;

        fetchNotifications();

        const socketUrl = API_URL.replace('/api/v1', '');
        const newSocket = io(socketUrl, { auth: { token } });

        newSocket.on('newNotification', (notification: Notification) => {
            setNotifications(prev => [notification, ...prev]);
        });

        return () => { newSocket.disconnect(); };
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await apiClient(`/notifications/${id}/read`, { method: 'PATCH' });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await apiClient(`/notifications/read-all`, { method: 'PATCH' });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications }}>
            {children}
        </NotificationContext.Provider>
    );
};