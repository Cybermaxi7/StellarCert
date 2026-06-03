import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiClient, API_URL } from '../api';
import { tokenStorage } from '../api/tokens';
import { useAuth } from './AuthContext';

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
    const socketRef = useRef<Socket | null>(null);
    const { isAuthenticated } = useAuth();

    const fetchNotifications = async () => {
        try {
            const token = tokenStorage.getAccessToken();
            if (!token) return;
            const response = await apiClient<{ data: Notification[]; total: number; page: number; limit: number }>('/notifications');
            setNotifications(response.data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    // Effect to handle socket connection when user authenticates
    useEffect(() => {
        const token = tokenStorage.getAccessToken();

        // If no token, disconnect socket if it exists
        if (!token) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        // Prevent creating duplicate sockets
        if (socketRef.current?.connected) {
            return;
        }

        fetchNotifications();

        const socketUrl = API_URL.replace('/api/v1', '');
        const newSocket = io(socketUrl, {
            auth: { token },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
        });

        newSocket.on('newNotification', (notification: Notification) => {
            setNotifications(prev => [notification, ...prev]);
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        socketRef.current = newSocket;

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [isAuthenticated]);

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