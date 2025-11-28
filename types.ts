export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  origin: string;
  type: 'API_ERROR' | 'VALIDATION' | 'DATABASE';
}

export interface QueueItem {
  id: string;
  clientName: string;
  installmentValue: string;
  dueDate: string;
  scheduledDate?: string;
  sentDate?: string;
  errorDate?: string;
  code: string;
  cpf: string;
  status: 'PENDING' | 'SENT' | 'ERROR';
}

export interface UserPermission {
  name: string;
  permissions: {
    loginApi: boolean;
    connection: boolean;
    paramsQuery: boolean;
    msgConfig: boolean;
    historyQueue: boolean;
    errorLogs: boolean;
  };
}
