/// <reference types="vite/client" />

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

interface RequestOptions extends RequestInit {
    headers?: Record<string, string>;
}

class ApiService {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.token) {
                    headers['Authorization'] = `Bearer ${user.token}`;
                }
            } catch (e) {
                console.error('Error parsing user from localStorage', e);
            }
        }

        return headers;
    }

    private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = { ...this.getHeaders(), ...options.headers };

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            // Handle unauthorized access (e.g., redirect to login)
            // For now, we just throw, but we could dispatch an event or clear localStorage
            localStorage.removeItem('user');
            window.location.href = '/#/login';
            throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Erro na requisição: ${response.statusText}`);
        }

        // Some endpoints might return empty body
        const text = await response.text();
        return text ? JSON.parse(text) : ({} as T);
    }

    public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    public post<T>(endpoint: string, body: any, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    public put<T>(endpoint: string, body: any, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }

    public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }
}

export const api = new ApiService(API_URL);
