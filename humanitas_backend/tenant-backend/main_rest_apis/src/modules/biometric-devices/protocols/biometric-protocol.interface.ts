export interface IBiometricDevice {
    ip: string;
    port: number;
    timeout?: number;
}

export interface IAttendanceLog {
    userId: string;
    timestamp: Date;
    status: 'CheckIn' | 'CheckOut' | 'BreakIn' | 'BreakOut' | 'OvertimeIn' | 'OvertimeOut';
    deviceId: string;
}

export interface IDeviceUser {
    userId: string;
    name: string;
    cardId?: string;
    password?: string;
    privilege?: 'User' | 'Admin';
}

export interface IBiometricProtocol {
    /**
     * Connect to the device
     */
    connect(config: IBiometricDevice): Promise<boolean>;

    /**
     * Disconnect from the device
     */
    disconnect(): Promise<void>;

    /**
     * Check if device is connected
     */
    isConnected(): boolean;

    /**
     * Get device information (serial number, firmware, etc.)
     */
    getDeviceInfo(): Promise<Record<string, any>>;

    /**
     * Sync date and time with the server
     */
    syncTime(): Promise<void>;

    /**
     * Get attendance logs from the device
     * @param clearAfterRead If true, logs will be cleared from the device after successful retrieval
     */
    getAttendanceLogs(clearAfterRead?: boolean): Promise<IAttendanceLog[]>;

    /**
     * Upload users to the device
     */
    uploadUsers(users: IDeviceUser[]): Promise<void>;

    /**
     * Delete users from the device
     */
    deleteUsers(userIds: string[]): Promise<void>;

    /**
     * Clear all administrative privileges
     */
    clearAdminPrivileges(): Promise<void>;

    /**
     * Restart the device
     */
    restart(): Promise<void>;
}
